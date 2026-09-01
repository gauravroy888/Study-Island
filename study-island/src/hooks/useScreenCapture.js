import { useState, useCallback, useEffect } from "react";

/**
 * useScreenCapture.js
 * Manages a persistent screen-share stream.
 * Permission is requested ONCE per session via getDisplayMedia().
 * After that, frames are captured silently (no dialog) on every AI message.
 *
 * Module-level singleton so the stream survives React re-renders/unmounts.
 */

// ── Singleton stream state ────────────────────────────────────────────────
let _stream    = null;
let _video     = null;
let _listeners = new Set();   // notify hook subscribers when state changes

function broadcast(active) {
  _listeners.forEach(fn => fn(active));
}

// ── Core API (used by both the hook and useGeminiChat directly) ───────────
export const screenCapture = {

  /** Request one-time permission and keep stream alive. Returns true on success. */
  async start() {
    if (this.isActive()) return true;
    try {
      _stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 3, max: 5 } },
        audio: false,
        preferCurrentTab: true,   // Chrome 94+: pre-selects the current tab
      });

      _video = document.createElement("video");
      _video.srcObject = _stream;
      _video.muted = true;
      await new Promise(r => { _video.onloadedmetadata = r; });
      _video.play();

      // Auto-cleanup when user clicks "Stop sharing" in browser toolbar
      _stream.getVideoTracks()[0].addEventListener("ended", () => {
        _stream = null; _video = null;
        broadcast(false);
      });

      broadcast(true);
      return true;
    } catch (e) {
      console.warn("Screen share cancelled:", e.message);
      _stream = null; _video = null;
      return false;
    }
  },

  /** Silently capture a JPEG frame. Returns base64 string or null. */
  capture(quality = 0.55) {
    if (!this.isActive() || !_video?.videoWidth) return null;
    try {
      const maxW = 1280;
      const c    = document.createElement("canvas");
      c.width    = Math.min(_video.videoWidth, maxW);
      c.height   = Math.round(c.width * _video.videoHeight / _video.videoWidth);
      c.getContext("2d").drawImage(_video, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", quality).split(",")[1]; // base64
    } catch { return null; }
  },

  /** Is the stream currently live? */
  isActive() {
    return !!(
      _stream &&
      _stream.getVideoTracks().length > 0 &&
      _stream.getVideoTracks()[0].readyState === "live"
    );
  },

  /** Stop sharing and release resources */
  stop() {
    if (_stream) _stream.getTracks().forEach(t => t.stop());
    _stream = null; _video = null;
    broadcast(false);
  },

  /** Subscribe to active-state changes. Returns unsubscribe fn. */
  subscribe(fn) { _listeners.add(fn); return () => _listeners.delete(fn); },
};

// ── React hook ────────────────────────────────────────────────────────────

export default function useScreenCapture() {
  const [isActive, setIsActive] = useState(() => screenCapture.isActive());

  useEffect(() => screenCapture.subscribe(setIsActive), []);

  const startCapture = useCallback(async () => {
    const ok = await screenCapture.start();
    return ok;
  }, []);

  const stopCapture = useCallback(() => screenCapture.stop(), []);

  const captureFrame = useCallback((quality) => screenCapture.capture(quality), []);

  return { isActive, startCapture, stopCapture, captureFrame };
}
