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
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
    body: "Process information for underwriting.",
  },
  video_recording: {
    title: "Video recording",
    body: "Record for compliance & review.",
  },
  bureau_pull: {
    title: "Credit bureau",
    body: "Authorise a bureau enquiry.",
  },
  loan_terms: {
    title: "Loan terms",
    body: "Acknowledge final approval subject to policy.",
  },
};

// Moving DecisionPanel to the top to avoid hoisting/SSR ambiguity
function DecisionPanel({
  decision,
  onRestart,
  sessionId,
}: {
  decision: DecisionResult;
  onRestart: () => void;
  sessionId: string | null;
}) {
  const isApproved = decision.outcome === "approved";
  const isReview = decision.outcome === "manual_review";
  
  return (
    <div className="space-y-12 animate-slide-up max-w-6xl mx-auto">
      <Card padding="lg" className={[
        "border-l-8 shadow-card-hover bg-[var(--card)]",
        isApproved ? "border-l-success-500" : isReview ? "border-l-accent" : "border-l-danger-600"
      ].join(" ")}>
        <div className="flex flex-col md:flex-row items-start gap-8">
          <div className={[
            "flex h-20 w-20 shrink-0 items-center justify-center rounded-[2rem] shadow-lg",
            isApproved ? "bg-success-500 text-white shadow-success-500/30" : isReview ? "bg-accent text-white shadow-accent/30" : "bg-danger-600 text-white shadow-danger-600/30"
          ].join(" ")}>
            {isApproved ? <CheckCircleIcon className="h-10 w-10" /> : <XCircleIcon className="h-10 w-10" />}
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-extrabold capitalize tracking-tight text-[var(--foreground)]">
              {decision.outcome.replace("_", " ")}
            </h2>
            <div className="mt-3 flex gap-3">
              <Badge variant="neutral">Risk Band: <span className="font-black">{decision.risk_band}</span></Badge>
              <Badge variant="neutral" className="font-mono">ID: {sessionId}</Badge>
            </div>
            <p className="mt-6 text-lg leading-relaxed text-slate-500">
              {decision.explanation}
            </p>
            {decision.failed_rules?.length > 0 && (
              <div className="mt-8 rounded-2xl bg-danger-500/10 p-6 border border-danger-500/20">
                <p className="text-sm font-bold text-danger-500 uppercase tracking-widest mb-3">Policy Discrepancies</p>
                <ul className="grid gap-2 text-xs font-semibold text-danger-500/80">
                  {decision.failed_rules.map((r, i) => (
                    <li key={i} className="flex gap-2">
                       <span className="text-danger-400 opacity-50">•</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </Card>

      {decision.offers?.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-[var(--foreground)] uppercase tracking-[0.2em]">Personalized Credit Offers</h3>
            <span className="text-xs font-bold text-slate-400">{decision.offers.length} Eligible options</span>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {decision.offers.map((o, idx) => (
              <Card
                key={o.offer_id || o.offer_ref || `offer-${idx}`}
                hover
                padding="none"
                className="overflow-hidden group border-2 border-transparent hover:border-brand/20"
              >
                {/* Premium Card Header */}
                <div className="bg-brand px-6 py-6 text-brand-foreground relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <ShieldIcon className="h-24 w-24" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">
                    {o.offer_id || o.offer_ref || "OFFER REF"}
                  </p>
                  <p className="text-3xl font-black">
                    ₹{o.principal_amount.toLocaleString("en-IN")}
                  </p>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="flex justify-between items-center text-sm font-bold text-[var(--foreground)]">
                    <p>{o.tenure_months} Months</p>
                    <Badge variant="brand">{o.interest_rate_pa}% APR</Badge>
                  </div>
                  
                  <div className="space-y-3 pt-4 border-t border-[var(--border)]">
                    {[
                      { label: "Monthly EMI", val: `₹${(o.monthly_emi ?? 0).toLocaleString("en-IN")}` },
                      { label: "Proc. Fee", val: `₹${(o.processing_fee ?? 0).toLocaleString("en-IN")}` },
                      { label: "Total Payable", val: `₹${(o.total_payable ?? 0).toLocaleString("en-IN")}` },
                    ].map((row, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] sm:text-xs">
                        <span className="font-bold text-slate-400 uppercase tracking-widest">{row.label}</span>
                        <span className="font-black text-[var(--foreground)]">{row.val}</span>
                      </div>
                    ))}
                  </div>
                  
                  <Button className="w-full mt-2 shadow-soft" size="sm">Select This Offer</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center pt-8">
        <Button variant="secondary" onClick={onRestart} icon={<ChevronLeftIcon className="h-5 w-5" />}>
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}

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

  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameBufferRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { stream, start: startMedia, stop: stopMedia, error: mediaError } =
    useMediaStream();

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

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
      } catch { /* ignore */ }
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
          } catch { /* optional */ }
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
          } catch { /* ignore */ }
        }
      };
      try {
        mr.start(1000);
      } catch (recErr) {
        throw new Error(
          recErr instanceof Error ? recErr.message : "Audio capture failed."
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
      setError(e instanceof Error ? e.message : "Camera/Mic unavailable");
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
        canvas.toBlob((b) => {
          if (b) frameBufferRef.current.push(b);
          resolve();
        }, "image/jpeg", 0.85);
      });
      if (frameBufferRef.current.length >= 6) {
        const batch = frameBufferRef.current.splice(0, frameBufferRef.current.length);
        try {
          const r = await api.uploadFaceFrames(id, batch);
          setVision(r);
        } catch { /* ignore */ }
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
      const consentPromises = entries
        .filter(([, granted]) => granted)
        .map(([type]) => api.recordConsent(sessionId, type, true));

      await Promise.all(consentPromises);

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
    <div className="mx-auto max-w-7xl px-6 py-12 lg:py-20 animate-fade-in">
      {/* Page Header */}
      <div className="mb-14 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <Badge variant="brand" className="px-4 py-1.5 font-black uppercase text-[9px] tracking-[0.2em]">Risk Intelligence Suite</Badge>
          <h1 className="text-4xl font-black tracking-tighter text-[var(--foreground)] sm:text-6xl max-w-4xl leading-[1.1]">
            Automated Identity & Risk Verification
          </h1>
          <p className="text-lg font-medium text-slate-500 max-w-2xl leading-relaxed">
            Instant KYC verification and real-time underwriting through AI-driven voice and facial analysis.
          </p>
        </div>
        {geoSignals.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {geoSignals.map((s, i) => (
              <Badge key={i} variant="warning" dot className="font-bold">{s}</Badge>
            ))}
          </div>
        )}
      </div>

      {stage !== "error" && (
        <div className="mb-20">
          <StepIndicator steps={STEPS} current={stepIndex} />
        </div>
      )}

      {stage === "welcome" && (
        <div className="mx-auto max-w-4xl animate-slide-up">
          <Card padding="lg" className="border-2 border-brand/5 shadow-soft-xl bg-[var(--card)]">
            <CardHeader
              title="Identity Verification"
              subtitle="Secure, multi-modal verification powered by TenzorX Analytics."
            />
            <div className="my-10 grid gap-6 sm:grid-cols-3">
              {[
                { icon: <VideoIcon className="h-6 w-6" />, label: "Biometric OK", desc: "Face matching" },
                { icon: <MicIcon className="h-6 w-6" />, label: "Voice Print", desc: "STT Analysis" },
                { icon: <ShieldIcon className="h-6 w-6" />, label: "AML Check", desc: "Global safety" },
              ].map((f, i) => (
                <div key={i} className="rounded-[2rem] border border-[var(--border)] p-6 text-center transition-all hover:border-brand/30 hover:bg-brand/5 group">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand group-hover:bg-brand group-hover:text-brand-foreground transition-all">
                    {f.icon}
                  </div>
                  <p className="text-sm font-black text-[var(--foreground)] uppercase tracking-widest">{f.label}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">{f.desc}</p>
                </div>
              ))}
            </div>
            <Button onClick={beginSession} loading={busy} size="lg" className="w-full h-16 text-lg tracking-tight" icon={<ArrowRightIcon className="h-5 w-5" />}>
              Initiate Verification
            </Button>
          </Card>
        </div>
      )}

      {stage === "consent" && (
        <div className="mx-auto max-w-5xl animate-slide-up">
          <Card padding="lg" className="shadow-soft-xl bg-[var(--card)]">
            <CardHeader
              title="Consent & Privacy"
              subtitle="We require your explicit authorization for the following processing layers."
            />
            <div className="grid gap-5 sm:grid-cols-2 mt-4">
              {(Object.keys(CONSENT_COPY) as ConsentKey[]).map((key) => (
                <label
                  key={key}
                  className={[
                    "flex cursor-pointer gap-5 rounded-[2rem] border p-6 transition-all",
                    consents[key] 
                      ? "border-brand bg-brand/5 shadow-soft border-2" 
                      : "border-[var(--border)] hover:border-brand/40 bg-[var(--card)]"
                  ].join(" ")}
                >
                  <div className="mt-1">
                    <input
                      type="checkbox"
                      className="h-6 w-6 rounded-lg border-slate-300 text-brand focus:ring-brand accent-brand transition-all"
                      checked={consents[key]}
                      onChange={(e) => setConsents((c) => ({ ...c, [key]: e.target.checked }))}
                    />
                  </div>
                  <div>
                    <span className="block text-lg font-black text-[var(--foreground)] tracking-tight">
                      {CONSENT_COPY[key].title}
                    </span>
                    <span className="mt-2 block text-xs font-medium text-slate-500 leading-relaxed uppercase tracking-wider">
                      {CONSENT_COPY[key].body}
                    </span>
                  </div>
                </label>
              ))}
            </div>
            {mediaError && (
              <p className="mt-8 text-sm font-black text-danger-600 flex items-center gap-2 uppercase tracking-widest">
                <XCircleIcon className="h-4 w-4" /> {mediaError}
              </p>
            )}
            <div className="mt-12 flex flex-col sm:flex-row gap-5">
              <Button size="lg" onClick={enterLive} disabled={!allConsents} loading={busy} className="flex-1 h-14">
                Launch Secure Interview
              </Button>
              <Button variant="ghost" size="lg" onClick={resetFlow} className="h-14">Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {stage === "live" && (
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 animate-fade-in items-stretch min-h-[600px]">
          {/* Main Stage: Video with Overlays */}
          <div className="lg:col-span-8 flex flex-col h-full">
            <div className="relative flex-1 overflow-hidden rounded-[3rem] border-8 border-[var(--card)] bg-black shadow-card-hover ring-1 ring-[var(--border)] group">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover grayscale-[20%] brightness-[1.1] transition-all group-hover:grayscale-0"
              />
              
              {/* Top Status Overlays */}
              <div className="absolute left-8 top-8 flex gap-3">
                <Badge variant="danger" dot className="px-4 py-2 font-black shadow-lg">LIVE CAPTURE</Badge>
                {vision?.liveness?.is_live && <Badge variant="brand" dot className="px-4 py-2 font-black shadow-lg">TRUST INDEX HIGH</Badge>}
              </div>

              {vision?.age_estimation?.estimated_age != null && (
                <div className="absolute right-8 top-8 rounded-2xl bg-black/60 px-5 py-2.5 text-[10px] font-black tracking-widest text-white backdrop-blur-xl border border-white/20">
                   AGE: {vision.age_estimation.estimated_age} · CONF: {(vision.age_estimation.confidence * 100).toFixed(0)}%
                </div>
              )}

              {/* Bottom Prompt Overlay */}
              <div className="absolute inset-x-8 bottom-8 animate-slide-up">
                <div className="rounded-[2.5rem] bg-black/60 p-8 backdrop-blur-2xl border border-white/10 shadow-2xl">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 text-center md:text-left">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand/80 mb-3">
                        Inquiry Stage · {promptIdx + 1} / {PROMPTS.length}
                      </p>
                      <h2 className="text-xl md:text-2xl font-black text-white leading-snug tracking-tight">
                        {PROMPTS[promptIdx]}
                      </h2>
                    </div>
                    <div className="flex gap-3 shrink-0">
                      <button 
                        onClick={() => setPromptIdx((i) => Math.max(0, i - 1))}
                        disabled={promptIdx === 0}
                        className="p-4 rounded-2xl bg-white/10 text-white hover:bg-white/20 disabled:opacity-10 transition-all border border-white/10 shadow-lg"
                      >
                        <ChevronLeftIcon className="h-6 w-6" />
                      </button>
                      <button 
                        onClick={() => setPromptIdx((i) => Math.min(PROMPTS.length - 1, i + 1))}
                        disabled={promptIdx >= PROMPTS.length - 1}
                        className="p-4 rounded-2xl bg-white/10 text-white hover:bg-white/20 disabled:opacity-10 transition-all border border-white/10 shadow-lg"
                      >
                        <ChevronRightIcon className="h-6 w-6" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: Intelligence & Actions */}
          <div className="lg:col-span-4 flex flex-col gap-8 h-full">
            {/* Expanded Transcript Card */}
            <div className="flex-1 flex flex-col rounded-[3rem] border-2 border-[var(--border)] bg-[var(--card)] shadow-soft overflow-hidden h-full">
              <div className="border-b border-[var(--border)] px-8 py-5 flex items-center justify-between bg-brand/5 shrink-0">
                <div className="flex items-center gap-3">
                   <div className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Live Transcript</p>
                </div>
                <div className="animate-pulse flex gap-1">
                   {[1,2,3].map(i => <div key={i} className={`h-1.5 w-1 rounded-full bg-brand/30`} />)}
                </div>
              </div>
              <div ref={transcriptRef} className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth">
                {transcript.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-30">
                    <MicIcon className="h-10 w-10 text-slate-400 mb-4 animate-pulse" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Calibrating Audio...</p>
                  </div>
                )}
                {transcript.map((t, i) => (
                  <div key={`${t.start}-${i}`} className="animate-slide-up group">
                    <div className="flex items-center gap-2 mb-2 opacity-20 group-hover:opacity-100 transition-opacity">
                      <span className="text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {t.start.toFixed(1)}S
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--foreground)] font-bold tracking-tight">
                      {t.text}
                    </p>
                  </div>
                ))}
              </div>
              
              {/* Sidebar Footer Actions */}
              <div className="p-6 border-t border-[var(--border)] bg-slate-50/50 dark:bg-slate-900/50">
                {promptIdx === PROMPTS.length - 1 ? (
                  <Button variant="accent" size="lg" onClick={submitDecision} className="w-full text-xs font-black uppercase tracking-widest h-14 shadow-lg animate-pulse hover:animate-none">
                    Finish Interview
                  </Button>
                ) : (
                  <div className="flex flex-col gap-4">
                     <p className="text-[9px] font-bold text-slate-400 uppercase text-center tracking-widest">Ongoing Analysis...</p>
                     <Button variant="ghost" size="sm" onClick={resetFlow} className="text-danger-600 font-bold uppercase tracking-widest text-[9px] hover:bg-danger-500/10">Abandon Session</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {stage === "processing" && (
        <Card padding="lg" className="text-center py-24 animate-fade-in shadow-soft-2xl max-w-3xl mx-auto bg-[var(--card)]">
          <Spinner size="lg" className="mx-auto text-brand mb-8 scale-150" />
          <h2 className="text-3xl font-black text-[var(--foreground)] tracking-tight">Finalizing Risk Assessment</h2>
          <p className="mt-5 text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
            Cross-referencing voice biometrics, facial liveness, and bureau data points...
          </p>
        </Card>
      )}

      {stage === "decision" && decision && (
        <DecisionPanel decision={decision} onRestart={resetFlow} sessionId={sessionId} />
      )}

      {stage === "error" && (
        <Card padding="lg" className="max-w-2xl mx-auto border-4 border-danger-500/20 bg-danger-500/5 shadow-soft-xl animate-slide-up bg-[var(--card)]">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-danger-600 text-white shadow-xl shadow-danger-600/30">
              <XCircleIcon className="h-10 w-10" />
            </div>
            <h2 className="text-3xl font-black text-danger-900 dark:text-danger-400 tracking-tighter">System Error</h2>
            <p className="mt-4 text-slate-500 font-medium leading-relaxed">{error}</p>
            <Button variant="danger" className="mt-10 px-12 h-14 font-black uppercase tracking-widest" onClick={resetFlow}>
              Resend Packet
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
