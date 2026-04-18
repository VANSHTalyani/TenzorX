"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  blobFilenameForMime,
  createSpeechMediaRecorder,
} from "@/lib/mediaRecorder";

interface UseAudioRecorderOpts {
  stream: MediaStream | null;
  timesliceMs?: number;
  onChunk: (blob: Blob, fileName: string) => void | Promise<void>;
}

/**
 * Records speech chunks using the same MIME/stream rules as onboarding.
 */
export default function useAudioRecorder({
  stream,
  timesliceMs = 2500,
  onChunk,
}: UseAudioRecorderOpts) {
  const [active, setActive] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const stop = useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") {
      try {
        r.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(() => {
    if (!stream) return;
    stop();
    setLastError(null);
    try {
      const { recorder: mr } = createSpeechMediaRecorder(stream);
      const name = blobFilenameForMime(mr.mimeType || "audio/webm");
      mr.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          try {
            await onChunk(e.data, name);
          } catch (err) {
            setLastError(
              err instanceof Error ? err.message : "Audio upload failed"
            );
          }
        }
      };
      mr.onerror = () => setLastError("Recorder error");
      mr.start(timesliceMs);
      recorderRef.current = mr;
      setActive(true);
    } catch (e: unknown) {
      setLastError(e instanceof Error ? e.message : "Could not start recorder");
    }
  }, [stream, timesliceMs, onChunk, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { start, stop, active, lastError };
}
