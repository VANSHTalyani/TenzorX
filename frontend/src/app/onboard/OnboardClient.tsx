"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  blobFilenameForMime,
  createSpeechMediaRecorder,
} from "@/lib/mediaRecorder";
import type { DecisionResult, TranscriptSegment, VisionResult } from "@/types";
import useMediaStream from "@/hooks/useMediaStream";
import Button from "@/components/ui/Button";
import Card, { CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import StepIndicator from "@/components/ui/StepIndicator";
import Spinner from "@/components/ui/Spinner";
import {
  CheckCircleIcon,
  MicIcon,
  ShieldIcon,
  VideoIcon,
  XCircleIcon,
} from "@/components/ui/IconSet";

type Stage =
  | "welcome"
  | "consent"
  | "live"
  | "processing"
  | "decision"
  | "error";

const STEPS = [
  { label: "Prepare", description: "Session & geo" },
  { label: "Consents", description: "Permissions" },
  { label: "Interview", description: "Video & STT" },
  { label: "Offers", description: "Decision" },
];

const PROMPTS = [
  "Introduce yourself with your full name and age.",
  "Describe your employment and approximate monthly income (INR).",
  "State the loan amount you need, tenure preference, and purpose.",
  "Confirm verbally that you agree to data processing, recording, bureau check, and loan terms review.",
];

type ConsentKey =
  | "data_processing"
  | "video_recording"
  | "bureau_pull"
  | "loan_terms";

const CONSENT_COPY: Record<
  ConsentKey,
  { title: string; body: string }
> = {
  data_processing: {
    title: "Data processing",
    body: "Allow us to process information you provide during this session for underwriting.",
  },
  video_recording: {
    title: "Video & audio recording",
    body: "Allow recording of this session for compliance, fraud prevention, and quality review.",
  },
  bureau_pull: {
    title: "Credit bureau",
    body: "Authorise a bureau enquiry to assess creditworthiness and repayment capacity.",
  },
  loan_terms: {
    title: "Loan terms & disclosures",
    body: "Acknowledge that offers are subject to verification, policy, and final approval.",
  },
};

export default function OnboardClient() {
  const params = useSearchParams();
  const campaignId = params.get("campaign") || "DEFAULT";
  const channel = params.get("channel") || "link";

  const [stage, setStage] = useState<Stage>("welcome");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [promptIdx, setPromptIdx] = useState(0);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [vision, setVision] = useState<VisionResult | null>(null);
  const [geoSignals, setGeoSignals] = useState<string[]>([]);
  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({
    data_processing: false,
    video_recording: false,
    bureau_pull: false,
    loan_terms: false,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameBufferRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { stream, start: startMedia, stop: stopMedia, error: mediaError } =
    useMediaStream();

  /**
   * `<video>` only exists when `stage === "live"`. We must attach `srcObject`
   * after that subtree mounts — doing it inline in `enterLive` always hit
   * `videoRef.current === null` (black preview).
   */
  useLayoutEffect(() => {
    if (stage !== "live" || !stream) return;
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [stage, stream]);

  const allConsents = useMemo(
    () => Object.values(consents).every(Boolean),
    [consents]
  );

  const stepIndex = useMemo(() => {
    if (stage === "welcome") return 0;
    if (stage === "consent") return 1;
    if (stage === "live") return 2;
    if (stage === "processing" || stage === "decision") return 3;
    return 0;
  }, [stage]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopRecording();
      stopMedia();
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
      abortRef.current?.abort();
    };
  }, [stopRecording, stopMedia]);

  async function beginSession() {
    setBusy(true);
    setError(null);
    try {
      const { session_id } = await api.createSession(campaignId, channel);
      setSessionId(session_id);
      await captureGeo(session_id);
      setStage("consent");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not start session");
      setStage("error");
    } finally {
      setBusy(false);
    }
  }

  async function captureGeo(id: string) {
    if (!navigator.geolocation) return;
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const r = await api.attachGeo(
              id,
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.accuracy
            );
            setGeoSignals(r.fraud_signals || []);
          } catch {
            /* optional */
          }
          resolve();
        },
        () => resolve(),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  async function enterLive() {
    if (!sessionId || !allConsents) return;
    setBusy(true);
    setError(null);
    try {
      const stream = await startMedia();
      setStage("live");

      startFaceLoop(sessionId);

      const { recorder: mr } = createSpeechMediaRecorder(stream);
      const uploadName = blobFilenameForMime(mr.mimeType || "audio/webm");

      const sid = sessionId;
      mr.ondataavailable = async (e) => {
        if (e.data.size > 0 && sid) {
          try {
            const segs = await api.uploadAudio(sid, e.data, uploadName);
            if (segs.length) setTranscript((p) => [...p, ...segs]);
          } catch {
            /* ignore */
          }
        }
      };
      try {
        /* Shorter timeslices → more upload rounds → steadier transcript lines. */
        mr.start(2500);
      } catch (recErr) {
        throw new Error(
          recErr instanceof Error
            ? recErr.message
            : "Could not start audio capture. Try Chrome/Edge or disable conflicting extensions."
        );
      }
      mediaRecorderRef.current = mr;
    } catch (e: unknown) {
      stopRecording();
      if (frameTimerRef.current) {
        clearInterval(frameTimerRef.current);
        frameTimerRef.current = null;
      }
      stopMedia();
      setError(
        e instanceof Error ? e.message : "Camera or microphone unavailable"
      );
      setStage("error");
    } finally {
      setBusy(false);
    }
  }

  function startFaceLoop(id: string) {
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    frameTimerRef.current = setInterval(async () => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      await new Promise<void>((resolve) => {
        canvas.toBlob(
          (b) => {
            if (b) frameBufferRef.current.push(b);
            resolve();
          },
          "image/jpeg",
          0.85
        );
      });
      if (frameBufferRef.current.length >= 6) {
        const batch = frameBufferRef.current.splice(
          0,
          frameBufferRef.current.length
        );
        try {
          const r = await api.uploadFaceFrames(id, batch);
          setVision(r);
        } catch {
          /* ignore */
        }
      }
    }, 2000);
  }

  async function submitDecision() {
    if (!sessionId) return;
    setStage("processing");
    stopRecording();
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    stopMedia();
    if (videoRef.current) videoRef.current.srcObject = null;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      await new Promise((r) => setTimeout(r, 1200));
      const entries = Object.entries(consents) as [ConsentKey, boolean][];
      for (const [type, granted] of entries) {
        if (granted) {
          await api.recordConsent(sessionId, type, true);
        }
      }
      const result = await api.finalize(sessionId, signal);
      setDecision(result);
      setStage("decision");
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Finalisation failed");
      setStage("error");
    }
  }

  function resetFlow() {
    stopRecording();
    stopMedia();
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    frameTimerRef.current = null;
    setSessionId(null);
    setTranscript([]);
    setPromptIdx(0);
    setDecision(null);
    setVision(null);
    setGeoSignals([]);
    setError(null);
    setConsents({
      data_processing: false,
      video_recording: false,
      bureau_pull: false,
      loan_terms: false,
    });
    setStage("welcome");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Video onboarding
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Guided loan interview
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Campaign <span className="font-mono font-medium">{campaignId}</span>
            {" · "}
            Channel <span className="font-medium">{channel}</span>
          </p>
        </div>
        {geoSignals.length > 0 && (
          <Badge variant="warning" dot>
            Geo checks: {geoSignals.join(", ")}
          </Badge>
        )}
      </div>

      {stage !== "error" && (
        <div className="mb-8 overflow-x-auto pb-2">
          <StepIndicator steps={STEPS} current={stepIndex} />
        </div>
      )}

      {stage === "welcome" && (
        <Card padding="lg" className="animate-slide-up">
          <CardHeader
            title="Before we begin"
            subtitle="This session captures audio and video for KYC and underwriting. You can leave at any time."
          />
          <ul className="mb-6 space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <VideoIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
              A short video interview with on-screen prompts.
            </li>
            <li className="flex gap-2">
              <MicIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
              Live speech-to-text; speak clearly toward the microphone.
            </li>
            <li className="flex gap-2">
              <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
              Automated checks and a central audit trail for compliance.
            </li>
          </ul>
          <Button onClick={beginSession} loading={busy} size="lg">
            Begin secure session
          </Button>
        </Card>
      )}

      {stage === "consent" && (
        <Card padding="lg" className="animate-slide-up">
          <CardHeader
            title="Consents & permissions"
            subtitle="Tick each box, then enable your camera and microphone to continue."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(CONSENT_COPY) as ConsentKey[]).map((key) => (
              <label
                key={key}
                className="flex cursor-pointer gap-3 rounded-xl border border-surface-200 bg-surface-50 p-4 transition hover:border-brand-200"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-surface-300 text-brand focus:ring-brand"
                  checked={consents[key]}
                  onChange={(e) =>
                    setConsents((c) => ({ ...c, [key]: e.target.checked }))
                  }
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {CONSENT_COPY[key].title}
                  </span>
                  <span className="mt-1 block text-xs text-slate-600 leading-relaxed">
                    {CONSENT_COPY[key].body}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {mediaError && (
            <p className="mt-4 text-sm text-danger-600">{mediaError}</p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={enterLive}
              disabled={!allConsents}
              loading={busy}
            >
              Enable camera & microphone
            </Button>
            <Button variant="ghost" onClick={resetFlow}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {stage === "live" && (
        <div className="grid animate-fade-in gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-card">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-video w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                <Badge variant="danger" dot>
                  Recording
                </Badge>
                {vision?.liveness?.is_live && (
                  <Badge variant="success" dot>
                    Liveness OK
                  </Badge>
                )}
              </div>
              {vision?.age_estimation?.estimated_age != null && (
                <div className="absolute right-3 top-3 rounded-lg bg-black/55 px-2 py-1 text-xs text-white backdrop-blur">
                  Age est. {vision.age_estimation.estimated_age}
                  <span className="text-white/70">
                    {" "}
                    · {(vision.age_estimation.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-slate-500">
              Tip: face the camera, avoid backlight, and keep answers concise.
            </p>
          </div>

          <Card
            padding="md"
            className="flex flex-col lg:max-h-[min(640px,70vh)]"
          >
            <CardHeader
              title="Current prompt"
              subtitle={`Step ${promptIdx + 1} of ${PROMPTS.length}`}
            />
            <p className="text-sm leading-relaxed text-slate-800">
              {PROMPTS[promptIdx]}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPromptIdx((i) => Math.max(0, i - 1))}
                disabled={promptIdx === 0}
              >
                Back
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setPromptIdx((i) => Math.min(PROMPTS.length - 1, i + 1))
                }
                disabled={promptIdx >= PROMPTS.length - 1}
              >
                Next prompt
              </Button>
            </div>
            <div className="mt-4 flex-1 overflow-hidden rounded-xl border border-surface-200 bg-surface-50">
              <div className="border-b border-surface-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Live transcript
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto p-3 text-xs text-slate-700 lg:max-h-80">
                {transcript.length === 0 && (
                  <p className="italic text-slate-400">Listening…</p>
                )}
                {transcript.map((t, i) => (
                  <p key={`${t.start}-${i}`}>
                    <span className="font-mono text-slate-400">
                      [{t.start.toFixed(1)}s]
                    </span>{" "}
                    {t.text}
                  </p>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 border-t border-surface-200 pt-4">
              <Button variant="accent" onClick={submitDecision}>
                Submit for decision & offers
              </Button>
              <Button variant="ghost" size="sm" onClick={resetFlow}>
                Abandon session
              </Button>
            </div>
          </Card>
        </div>
      )}

      {stage === "processing" && (
        <Card padding="lg" className="text-center">
          <Spinner size="lg" className="mx-auto text-brand" />
          <p className="mt-4 text-slate-700">
            Evaluating policy, risk, and generating personalised offers…
          </p>
          <p className="mt-2 text-xs text-slate-500">
            This may take up to a minute when the LLM is cold-starting.
          </p>
        </Card>
      )}

      {stage === "decision" && decision && (
        <DecisionPanel decision={decision} onRestart={resetFlow} />
      )}

      {stage === "error" && (
        <Card padding="lg" className="border-danger-200 bg-danger-50/50">
          <div className="flex items-start gap-3">
            <XCircleIcon className="h-6 w-6 shrink-0 text-danger-600" />
            <div>
              <h2 className="font-semibold text-danger-800">
                Something went wrong
              </h2>
              <p className="mt-1 text-sm text-danger-700">{error}</p>
              <Button variant="danger" className="mt-4" onClick={resetFlow}>
                Start over
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function DecisionPanel({
  decision,
  onRestart,
}: {
  decision: DecisionResult;
  onRestart: () => void;
}) {
  const tone =
    decision.outcome === "approved"
      ? "border-success-200 bg-success-50"
      : decision.outcome === "manual_review"
        ? "border-accent-200 bg-accent-50"
        : "border-danger-200 bg-danger-50";

  return (
    <div className="space-y-6 animate-slide-up">
      <Card padding="lg" className={tone}>
        <div className="flex flex-wrap items-start gap-3">
          {decision.outcome === "approved" ? (
            <CheckCircleIcon className="h-8 w-8 text-success-600" />
          ) : (
            <XCircleIcon className="h-8 w-8 text-danger-600" />
          )}
          <div>
            <h2 className="text-2xl font-bold capitalize text-slate-900">
              {decision.outcome.replace("_", " ")}
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Risk band:{" "}
              <span className="font-semibold">{decision.risk_band}</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              {decision.explanation}
            </p>
            {decision.failed_rules?.length > 0 && (
              <ul className="mt-3 list-inside list-disc text-xs text-slate-600">
                {decision.failed_rules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      {decision.offers?.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decision.offers.map((o, idx) => (
            <Card
              key={o.offer_id || o.offer_ref || `offer-${idx}`}
              hover
              padding="md"
            >
              <p className="font-mono text-[10px] text-slate-400">
                {o.offer_id || o.offer_ref}
              </p>
              <p className="mt-1 text-2xl font-bold text-brand-700">
                ₹{o.principal_amount.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {o.tenure_months} months · {o.interest_rate_pa}% p.a.
              </p>
              <dl className="mt-4 space-y-1.5 border-t border-surface-200 pt-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">EMI</dt>
                  <dd className="font-medium">
                    ₹{(o.monthly_emi ?? 0).toLocaleString("en-IN")}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Processing fee</dt>
                  <dd className="font-medium">
                    ₹{(o.processing_fee ?? 0).toLocaleString("en-IN")}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Total payable</dt>
                  <dd className="font-medium">
                    ₹{(o.total_payable ?? 0).toLocaleString("en-IN")}
                  </dd>
                </div>
              </dl>
              <Button className="mt-4 w-full" size="sm">
                Select offer
              </Button>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-center">
        <Button variant="secondary" onClick={onRestart}>
          Start a new session
        </Button>
      </div>
    </div>
  );
}
