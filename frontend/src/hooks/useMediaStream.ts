"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseMediaStreamOpts {
  video?: boolean | MediaTrackConstraints;
  audio?: boolean | MediaTrackConstraints;
}

const DEFAULT: UseMediaStreamOpts = {
  video: { width: 640, height: 480, facingMode: "user" },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 16000,
  },
};

export default function useMediaStream(opts: UseMediaStreamOpts = DEFAULT) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(async (): Promise<MediaStream> => {
    setError(null);
    stop();
    const s = await navigator.mediaDevices.getUserMedia({
      video: opts.video ?? DEFAULT.video,
      audio: opts.audio ?? DEFAULT.audio,
    });
    streamRef.current = s;
    setStream(s);
    return s;
  }, [opts.video, opts.audio, stop]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { stream, start, stop, error };
}
