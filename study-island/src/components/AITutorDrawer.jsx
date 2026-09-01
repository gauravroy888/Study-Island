import React, { useState, useRef, useEffect, useCallback } from "react";
import useGeminiChat    from "../hooks/useGeminiChat";
import useVoiceIO       from "../hooks/useVoiceIO";
import useScreenCapture from "../hooks/useScreenCapture";

/* ── Inline SVG Icon Components (Zero external icon dependencies, zero TDZ errors) ── */
const IconX       = ({ size = 17, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconMic     = ({ size = 17, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
const IconMicOff  = ({ size = 17, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
const IconSend    = ({ size = 15, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IconTrash2  = ({ size = 15, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
const IconVolume2 = ({ size = 15, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>;
const IconVolumeX = ({ size = 15, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>;
const IconEye     = ({ size = 17, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconEyeOff  = ({ size = 17, color = "currentColor" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

const HINTS = [
  { label:"What is this?",          value:"What is this thing on my screen? Explain it simply." },
  { label:"Give me a hint",         value:"Give me a small hint without telling me the full answer." },
  { label:"Explain differently",    value:"Can you explain that in a simpler way?" },
  { label:"Check my thinking",      value:"Here is my thinking. Is it on the right track?" },
  { label:"Break it down",          value:"Can you break this into smaller steps for me?" },
];

function getStudentName() {
  try { return JSON.parse(localStorage.getItem("edtech_user") || "{}").name || "Student"; }
  catch { return "Student"; }
}

export default function AITutorDrawer({ isOpen, onClose, botState, setBotState, onNewMessage }) {
  const [input,       setInput     ] = useState("");
  const [voiceMode,   setVoiceMode ] = useState(false);
  const voiceModeRef = useRef(false);
  voiceModeRef.current = voiceMode;

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const sendRef        = useRef(null);

  const { messages, isLoading, sendMessage, clearHistory } = useGeminiChat();
  const {
    isListening, isSpeaking, isMuted, toggleMute, audioLevels,
    isSTTSupported, speak, stopSpeaking, startListening, stopListening
  } = useVoiceIO();
  const { isActive: isWatching, startCapture, stopCapture } = useScreenCapture();

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);
  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 320); }, [isOpen]);

  /* Sync bot avatar state */
  useEffect(() => {
    if (isListening)     setBotState("listening");
    else if (isLoading)  setBotState("thinking");
    else if (isSpeaking) setBotState("speaking");
    else                 setBotState("idle");
  }, [isListening, isLoading, isSpeaking, setBotState]);

  const voiceAudioResult = useCallback(async (audioPayload) => {
    if (!audioPayload || !audioPayload.data || isLoading) return;
    setInput("");
    onNewMessage?.();
    const reply = await sendMessage("", null, audioPayload);
    if (reply) speak(reply, voiceModeRef.current ? afterSpeak : undefined);
  }, [isLoading, sendMessage, speak, onNewMessage]);

  /* After speaking in voice mode, auto-listen again */
  const afterSpeak = useCallback(() => {
    if (!voiceModeRef.current) return;
    setTimeout(() => { if (voiceModeRef.current) startListening(voiceAudioResult); }, 400);
  }, [startListening, voiceAudioResult]);

  const handleSend = useCallback(async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || isLoading) return;
    setInput("");
    onNewMessage?.();
    const reply = await sendMessage(text, null); // screenCapture auto-handles the frame
    if (reply) speak(reply, voiceModeRef.current ? afterSpeak : undefined);
  }, [input, isLoading, sendMessage, speak, afterSpeak, onNewMessage]);

  useEffect(() => { sendRef.current = handleSend; }, [handleSend]);

  /* Auto-stop voice when unmounting / minimizing */
  const handleClose = useCallback(() => {
    stopSpeaking();
    stopListening();
    setVoiceMode(false);
    onClose?.();
  }, [stopSpeaking, stopListening, onClose]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
    };
  }, [stopSpeaking, stopListening]);

  const toggleVoiceMode = useCallback(() => {
    if (voiceMode) { setVoiceMode(false); stopListening(); stopSpeaking(); }
    else           { setVoiceMode(true);  startListening(voiceAudioResult); }
  }, [voiceMode, stopListening, stopSpeaking, startListening, voiceAudioResult]);

  /* Toggle auto-watch */
  const toggleWatch = useCallback(async () => {
    if (isWatching) { stopCapture(); return; }
    const ok = await startCapture();
    if (!ok) return; // user cancelled
  }, [isWatching, startCapture, stopCapture]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const statusLabel = voiceMode && isListening ? "Listening — speak now"
    : voiceMode && isSpeaking  ? (isMuted ? "Replying silently..." : "Speaking — will listen when done")
    : voiceMode && isLoading   ? "Thinking"
    : isListening              ? "Listening"
    : isLoading                ? "Thinking"
    : isSpeaking               ? (isMuted ? "Replying..." : "Speaking")
    : `Hi ${getStudentName()}! Ask me anything.`;

  if (!isOpen) return null;

  return (
    <div className="ai-drawer">
      {/* Header */}
      <div className="ai-drawer__header">
        <div className="ai-drawer__title">
          <span className={`ai-drawer__sdot ${botState !== "idle" ? "active" : ""}`} />
          <div>
            <div className="ai-drawer__name">
              Aria — AI Tutor
              {isWatching && (
                <span style={{
                  marginLeft:"8px", fontSize:"0.65rem", background:"rgba(16,185,129,0.15)",
                  color:"#10B981", border:"1px solid rgba(16,185,129,0.35)",
                  padding:"2px 7px", borderRadius:"10px", fontWeight:700, verticalAlign:"middle"
                }}>
                  WATCHING SCREEN
                </span>
              )}
            </div>
            <div className="ai-drawer__sub">{statusLabel}</div>
          </div>
        </div>
        <div className="ai-drawer__hdr-actions">
          <button
            className={`ai-drawer__icon-btn${isMuted ? " muted" : ""}`}
            onClick={toggleMute}
            title={isMuted ? "Unmute Aria's voice" : "Mute Aria's voice"}
          >
            {isMuted ? <IconVolumeX size={15} color="#f59e0b"/> : <IconVolume2 size={15}/>}
          </button>
          <button className="ai-drawer__icon-btn" onClick={clearHistory} title="Clear conversation"><IconTrash2 size={15}/></button>
          <button className="ai-drawer__icon-btn" onClick={handleClose} title="Close"><IconX size={17}/></button>
        </div>
      </div>

      {/* Messages */}
      <div className="ai-drawer__msgs">
        {messages.length === 0 && (
          <div className="ai-drawer__empty">
            <div className="ai-drawer__empty-icon">🎓</div>
            <p>I am <strong>Aria</strong>, your AI tutor.<br/>Ask me anything about what you are studying!</p>
            <p style={{ fontSize:"0.78rem", opacity:0.5 }}>
              Press <strong>Watch Screen</strong> once and I will automatically see your screen on every question.
              Press the mic button for hands-free voice chat.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id ?? i} className={`ai-drawer__msg ai-drawer__msg--${msg.role}`}>
            {msg.role === "model" && <span className="ai-drawer__avatar">🤖</span>}
            <div className={`ai-drawer__bubble${msg.streaming ? " streaming" : ""}`}>
              {msg.hasAutoScreen && (
                <div style={{ fontSize:"0.68rem", color:"#10B981", marginBottom:"4px", display:"flex", alignItems:"center", gap:"4px" }}>
                  <IconEye size={10}/> Aria saw your screen
                </div>
              )}
              {msg.text || (msg.streaming ? "" : "...")}
              {!msg.streaming && msg.role === "model" && msg.text && !isMuted && (
                <button className="ai-drawer__replay" onClick={() => speak(msg.text)} title="Replay">
                  <IconVolume2 size={11}/> play
                </button>
              )}
            </div>
          </div>
        ))}

        {isLoading && !messages.some(m => m.streaming) && (
          <div className="ai-drawer__msg ai-drawer__msg--model">
            <span className="ai-drawer__avatar">🤖</span>
            <div className="ai-drawer__bubble ai-drawer__bubble--thinking">
              <span className="thinking-dot"/><span className="thinking-dot"/><span className="thinking-dot"/>
            </div>
          </div>
        )}
        <div ref={messagesEndRef}/>
      </div>

      {/* Hint chips */}
      <div className="ai-drawer__hints">
        {HINTS.map(h => (
          <button key={h.label} className="ai-drawer__chip"
            onClick={() => handleSend(h.value)} disabled={isLoading || isListening}>
            {h.label}
          </button>
        ))}
      </div>

      {/* Watch-screen banner — shown when active */}
      {isWatching && (
        <div style={{
          padding:"7px 14px", display:"flex", alignItems:"center", gap:"8px",
          background:"rgba(16,185,129,0.07)", borderTop:"1px solid rgba(16,185,129,0.2)"
        }}>
          <IconEye size={14} color="#10B981"/>
          <span style={{ fontSize:"0.72rem", color:"#10B981", flex:1, fontWeight:600 }}>
            Aria sees your screen on every message
          </span>
          <button onClick={stopCapture}
            style={{ background:"none", color:"#64748b", cursor:"pointer", fontSize:"0.7rem", padding:"2px 6px",
                     border:"1px solid rgba(100,116,139,0.3)", borderRadius:"6px" }}>
            Stop
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="ai-drawer__input-area">

        {/* Watch Screen toggle */}
        <button
          className={`ai-drawer__mic-btn${isWatching ? " listening" : ""}`}
          onClick={toggleWatch}
          title={isWatching ? "Stop watching screen" : "Let Aria watch your screen automatically"}
          style={{
            color: isWatching ? "#10B981" : undefined,
            borderColor: isWatching ? "rgba(16,185,129,0.5)" : undefined,
            background: isWatching ? "rgba(16,185,129,0.1)" : undefined,
          }}
        >
          {isWatching ? <IconEyeOff size={17}/> : <IconEye size={17}/>}
        </button>

        {/* Voice Mode toggle — clean red mic button without Stop text */}
        {isSTTSupported && (
          <button
            className={`ai-drawer__mic-btn${voiceMode ? " active-voice" : ""}`}
            onClick={toggleVoiceMode}
            title={voiceMode ? "Stop voice conversation" : "Start hands-free voice conversation"}
          >
            {voiceMode ? <IconMicOff size={17}/> : <IconMic size={17}/>}
          </button>
        )}

        <textarea
          ref={inputRef}
          className="ai-drawer__input"
          placeholder={voiceMode ? "Voice mode on — speak or type..." : "Ask anything about your studies..."}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          disabled={isLoading}
        />

        <button className="ai-drawer__send-btn"
          onClick={() => handleSend()} disabled={isLoading || !input.trim()} title="Send">
          <IconSend size={15}/>
        </button>
      </div>

      {/* Voice mode status bar with Real-time Synced Audio Waveform */}
      {voiceMode && (
        <div className="ai-drawer__voice-footer">
          <div className="ai-drawer__waveform">
            {audioLevels.map((h, idx) => (
              <span
                key={idx}
                className={`ai-drawer__wave-bar ${isSpeaking ? "speaking" : ""}`}
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
          <span className="ai-drawer__voice-label">
            {isListening ? "Listening — speak now"
              : isSpeaking ? (isMuted ? "Replying silently..." : "Speaking — will auto-listen when done")
              : isLoading  ? "Thinking..."
              : "Voice mode on — I will listen after each reply"}
          </span>
        </div>
      )}
    </div>
  );
}
