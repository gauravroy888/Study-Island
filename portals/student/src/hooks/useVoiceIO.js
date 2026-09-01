import { useState, useCallback, useRef, useEffect } from "react";

/* ── Strip markdown + emojis before TTS ──────────────────────────────────── */
function cleanForSpeech(raw) {
  if (!raw) return "";
  return raw
    .replace(/\p{Emoji_Presentation}/gu, "")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu,   "")
    .replace(/[\u{1F900}-\u{1FAFF}]/gu, "")
    .replace(/```[\s\S]*?```/g, "code block")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_\n]+)_{1,3}/g,   "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`#|\\]/g, "")
    .replace(/\n+/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* ── Indian English voice preference ───────────────────────────────────── */
function pickVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const vs = window.speechSynthesis.getVoices() || [];
  return (
    vs.find(v => v.lang === "en-IN" && /google/i.test(v.name)) ||
    vs.find(v => v.lang === "en-IN") ||
    vs.find(v => /neerja|heera|ravi/i.test(v.name)) ||
    vs.find(v => /india/i.test(v.name)) ||
    vs.find(v => v.lang && v.lang.startsWith("en")) || null
  );
}

export default function useVoiceIO() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking,  setIsSpeaking ] = useState(false);
  const [isMuted,     setIsMuted    ] = useState(() => {
    try { return localStorage.getItem("aria_muted") === "true"; } catch { return false; }
  });
  const [audioLevels, setAudioLevels] = useState([4, 4, 4, 4, 4]);

  const isMutedRef            = useRef(isMuted);
  isMutedRef.current          = isMuted;

  const mediaRecorderRef      = useRef(null);
  const audioChunksRef        = useRef([]);
  const listeningRef          = useRef(false);
  const audioCtxRef           = useRef(null);
  const analyserRef           = useRef(null);
  const micStreamRef          = useRef(null);
  const animFrameRef          = useRef(null);
  const silenceTimerRef       = useRef(null);
  const maxRecordTimerRef     = useRef(null);
  const activeAudioCbRef      = useRef(null);
  const hasSpokenRef          = useRef(false);
  const lastSpokenRef         = useRef("");

  const isSTTSupported = typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const isTTSSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      try { localStorage.setItem("aria_muted", String(next)); } catch {}
      if (next && isTTSSupported) window.speechSynthesis?.cancel();
      return next;
    });
  }, [isTTSSupported]);

  const stopAudioAnalyser = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    setAudioLevels([4, 4, 4, 4, 4]);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (isTTSSupported) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
  }, [isTTSSupported]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxRecordTimerRef.current) {
      clearTimeout(maxRecordTimerRef.current);
      maxRecordTimerRef.current = null;
    }
    listeningRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    setIsListening(false);
    stopAudioAnalyser();
  }, [stopAudioAnalyser]);

  useEffect(() => {
    if (isTTSSupported && !window.speechSynthesis.getVoices().length) {
      window.speechSynthesis.addEventListener("voiceschanged", () => {}, { once: true });
    }
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (maxRecordTimerRef.current) clearTimeout(maxRecordTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      if (isTTSSupported) window.speechSynthesis?.cancel();
      stopAudioAnalyser();
    };
  }, [isTTSSupported, stopAudioAnalyser]);

  /* ── TTS: speak(text, onEnd?) ── */
  const speak = useCallback((text, onEnd) => {
    stopListening();

    if (isMutedRef.current) {
      if (onEnd) setTimeout(onEnd, 1200);
      return;
    }
    const clean = cleanForSpeech(text);
    if (!clean || !isTTSSupported) { onEnd?.(); return; }
    lastSpokenRef.current = clean;
    window.speechSynthesis?.cancel();

    const doSpeak = () => {
      const utt = new SpeechSynthesisUtterance(clean);
      utt.lang    = "en-IN";
      utt.rate    = 0.95;
      utt.pitch   = 1.05;
      const v = pickVoice(); if (v) utt.voice = v;
      utt.onstart = () => setIsSpeaking(true);
      utt.onend   = () => {
        setIsSpeaking(false);
        if (onEnd) setTimeout(onEnd, 450);
      };
      utt.onerror = () => {
        setIsSpeaking(false);
        if (onEnd) setTimeout(onEnd, 450);
      };
      window.speechSynthesis?.speak(utt);
    };

    if (!window.speechSynthesis?.getVoices().length) {
      window.speechSynthesis?.addEventListener("voiceschanged", doSpeak, { once: true });
    } else { doSpeak(); }
  }, [isTTSSupported, stopListening]);

  /* ── Direct Multimodal Audio Recording with Real-time VAD ── */
  const startListening = useCallback(async (onAudioReady) => {
    if (isSpeaking || window.speechSynthesis?.speaking) return;
    if (onAudioReady) activeAudioCbRef.current = onAudioReady;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxRecordTimerRef.current) {
      clearTimeout(maxRecordTimerRef.current);
      maxRecordTimerRef.current = null;
    }

    if (listeningRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const ana = ctx.createAnalyser();
        ana.fftSize = 64;
        ana.smoothingTimeConstant = 0.3;
        src.connect(ana);
        analyserRef.current = ana;
      }

      let mimeType = "audio/webm;codecs=opus";
      if (typeof MediaRecorder !== "undefined") {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          if (MediaRecorder.isTypeSupported("audio/webm")) {
            mimeType = "audio/webm";
          } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
            mimeType = "audio/mp4";
          } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
            mimeType = "audio/ogg";
          } else {
            mimeType = "";
          }
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      hasSpokenRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        setIsListening(false);
        listeningRef.current = false;
        stopAudioAnalyser();

        const chunks = audioChunksRef.current;
        if (!chunks || chunks.length === 0) return;

        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 500) {
          console.warn("Recorded audio blob too small, skipping.");
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64DataUrl = reader.result;
          if (typeof base64DataUrl === "string") {
            const base64 = base64DataUrl.split(",")[1];
            const finalMime = recorder.mimeType ? recorder.mimeType.split(";")[0] : "audio/webm";
            const cb = activeAudioCbRef.current;
            if (cb && base64) {
              cb({ data: base64, mimeType: finalMime });
            }
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start(100);
      listeningRef.current = true;
      setIsListening(true);

      const dataArray = new Uint8Array(analyserRef.current ? analyserRef.current.frequencyBinCount : 32);
      let consecutiveSilenceCount = 0;

      const vadLoop = () => {
        if (!listeningRef.current || !analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / (dataArray.length || 1);

        const l1 = Math.max(4, Math.round((dataArray[1] || 0) / 6));
        const l2 = Math.max(4, Math.round((dataArray[3] || 0) / 6));
        const l3 = Math.max(4, Math.round((dataArray[5] || 0) / 6));
        const l4 = Math.max(4, Math.round((dataArray[7] || 0) / 6));
        const l5 = Math.max(4, Math.round((dataArray[9] || 0) / 6));
        setAudioLevels([l1, l2, l3, l4, l5]);

        if (avg > 8) {
          hasSpokenRef.current = true;
          consecutiveSilenceCount = 0;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (hasSpokenRef.current) {
          consecutiveSilenceCount++;
          // ~1000ms of silence after speaking
          if (consecutiveSilenceCount > 30 && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              if (listeningRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                try { mediaRecorderRef.current.stop(); } catch {}
              }
            }, 100);
          }
        }

        animFrameRef.current = requestAnimationFrame(vadLoop);
      };

      vadLoop();

      // Safeguard: auto-stop after 15s
      maxRecordTimerRef.current = setTimeout(() => {
        if (listeningRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          try { mediaRecorderRef.current.stop(); } catch {}
        }
      }, 15000);

    } catch (err) {
      console.warn("Microphone access / MediaRecorder error:", err);
      setIsListening(false);
      listeningRef.current = false;
      stopAudioAnalyser();
    }
  }, [isSpeaking, stopAudioAnalyser]);

  return {
    isListening, isSpeaking, isMuted, toggleMute, audioLevels,
    isSTTSupported, isTTSSupported, speak, stopSpeaking, startListening, stopListening
  };
}
