import type {
  AuditEvent,
  DecisionResult,
  SessionDetail,
  TranscriptSegment,
  VisionResult,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function http<T>(
  path: string,
  init?: RequestInit,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal: signal ?? init?.signal,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.detail || body.error || JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

async function upload<T>(
  path: string,
  formData: FormData,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: formData,
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }
  return res.json();
}

export const api = {
  createSession: (campaignId: string, channel: string, msisdn?: string) =>
    http<{ session_id: string }>("/sessions", {
      method: "POST",
      body: JSON.stringify({
        campaign: { campaign_id: campaignId, channel },
        customer_msisdn: msisdn,
      }),
    }),

  attachGeo: (id: string, lat: number, lon: number, accuracy?: number) =>
    http<{ fraud_signals: string[] }>(`/sessions/${id}/geo`, {
      method: "POST",
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        accuracy_m: accuracy,
      }),
    }),

  attachDevice: (id: string, meta: Record<string, unknown>) =>
    http(`/sessions/${id}/device`, {
      method: "POST",
      body: JSON.stringify(meta),
    }),

  uploadAudio: (
    id: string,
    blob: Blob,
    fileName = "chunk.webm",
    signal?: AbortSignal
  ) => {
    const fd = new FormData();
    fd.append("audio", blob, fileName);
    return upload<TranscriptSegment[]>(`/sessions/${id}/audio`, fd, signal);
  },

  uploadFaceFrames: (id: string, frames: Blob[], signal?: AbortSignal) => {
    const fd = new FormData();
    frames.forEach((b, i) => fd.append("frames", b, `frame_${i}.jpg`));
    return upload<VisionResult>(`/sessions/${id}/face`, fd, signal);
  },

  recordConsent: (
    id: string,
    type: string,
    granted: boolean,
    excerpt?: string
  ) =>
    http(`/sessions/${id}/consent`, {
      method: "POST",
      body: JSON.stringify({
        consent_type: type,
        granted,
        transcript_excerpt: excerpt,
      }),
    }),

  finalize: (id: string, signal?: AbortSignal) =>
    http<DecisionResult>(`/sessions/${id}/finalize`, { method: "POST" }, signal),

  getSession: (id: string) => http<SessionDetail>(`/sessions/${id}`),

  getAudit: (id: string) => http<AuditEvent[]>(`/sessions/${id}/audit`),

  getTranscript: (id: string) =>
    http<TranscriptSegment[]>(`/sessions/${id}/transcript`),
};
