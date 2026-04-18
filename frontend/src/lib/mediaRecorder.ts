/**
 * Browser-safe MediaRecorder for chunked speech upload.
 *
 * Recording with MIME `audio/webm;codecs=opus` on a **video+audio** stream
 * causes `start()` to throw in Chromium. Use a dedicated **audio-only**
 * `MediaStream` (same audio tracks) for audio containers, then fall back to
 * `video/webm` on the full stream if needed.
 */

const AUDIO_MIMES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
];

const VIDEO_MIMES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function audioOnlyStream(full: MediaStream): MediaStream {
  const tracks = full.getAudioTracks();
  if (tracks.length === 0) return full;
  return new MediaStream(tracks);
}

function firstSupported(mimes: string[]): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return undefined;
  }
  return mimes.find((m) => MediaRecorder.isTypeSupported(m));
}

function tryBuild(
  stream: MediaStream,
  mime?: string,
  audioBits?: number
): MediaRecorder | null {
  try {
    if (!mime && audioBits == null) {
      return new MediaRecorder(stream);
    }
    const o: MediaRecorderOptions = {};
    if (mime) o.mimeType = mime;
    if (mime?.startsWith("audio/") && audioBits != null) {
      o.audioBitsPerSecond = audioBits;
    }
    return new MediaRecorder(stream, o);
  } catch {
    return null;
  }
}

export interface SpeechRecorderResult {
  recorder: MediaRecorder;
  /** Effective MIME (may be empty if browser default). */
  mimeType: string;
}

/**
 * Build a MediaRecorder that is likely to accept `start(timeslice)` for STT chunks.
 */
export function createSpeechMediaRecorder(fullStream: MediaStream): SpeechRecorderResult {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder is not supported in this browser");
  }

  const audioStream = audioOnlyStream(fullStream);
  const useAudioOnly = audioStream.getAudioTracks().length > 0;

  if (useAudioOnly) {
    const mime = firstSupported(AUDIO_MIMES);
    const withMime =
      mime != null
        ? tryBuild(audioStream, mime, 64000) || tryBuild(audioStream, mime)
        : null;
    const plain = tryBuild(audioStream);
    const candidate = withMime || plain;
    if (candidate) {
      return {
        recorder: candidate,
        mimeType: candidate.mimeType || mime || "",
      };
    }
  }

  const vm = firstSupported(VIDEO_MIMES);
  const videoRec = vm
    ? tryBuild(fullStream, vm, undefined)
    : tryBuild(fullStream, undefined, undefined);
  if (!videoRec) {
    throw new Error("Could not create MediaRecorder for this device/browser");
  }
  return { recorder: videoRec, mimeType: videoRec.mimeType || vm || "" };
}

/** Filename for `FormData` — backend sniffs format from bytes. */
export function blobFilenameForMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("mp4") || m.includes("aac")) return "chunk.mp4";
  if (m.includes("ogg")) return "chunk.ogg";
  if (m.includes("video/")) return "chunk.webm";
  return "chunk.webm";
}
