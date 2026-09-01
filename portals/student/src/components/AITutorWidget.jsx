import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import "./AITutorWidget.css";
import AITutorDrawer from "./AITutorDrawer";

// Original animated SVG bot states
import botIdle  from "../assets/bot/bot-idle.svg";
import botHover from "../assets/bot/bot-hover.svg";
import botClick from "../assets/bot/bot-click.svg";
import botFail  from "../assets/bot/bot-fail.svg";

const SVG_BY_STATE = {
  idle     : botIdle,
  listening: botHover,
  thinking : botClick,
  speaking : botHover,
  error    : botFail,
};

export default function AITutorWidget() {
  const [isOpen,         setIsOpen        ] = useState(false);
  const [botState,       setBotState      ] = useState("idle");
  const [isHovered,      setIsHovered     ] = useState(false);
  const [hasNewMessage,  setHasNewMessage ] = useState(false);

  // Pick the right SVG: hover preview when not open, else state-based
  const currentSvg = (isHovered && !isOpen)
    ? botHover
    : (SVG_BY_STATE[botState] ?? botIdle);

  const handleToggle = useCallback(() => {
    setIsOpen(prev => {
      if (prev) setBotState("idle");
      return !prev;
    });
    setHasNewMessage(false);
  }, []);

  const content = (
    <>
      {/* ── Floating Bot Orb ─────────────────────────────── */}
      <div
        className={`ai-tutor-widget${isOpen ? " open" : ""}${hasNewMessage ? " pulse" : ""}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        aria-label={isOpen ? "Close AI Tutor" : "Open AI Tutor — Aria"}
        onKeyDown={e => e.key === "Enter" && handleToggle()}
      >
        <img
          src={currentSvg}
          alt="Aria — AI Tutor"
          className="bot-svg"
          draggable={false}
        />
        <span className={`state-dot state-dot--${botState}`} />
        {!isOpen && (
          <div className="widget-tooltip">✨ Ask Aria — AI Tutor</div>
        )}
      </div>

      {/* ── Chat Drawer ──────────────────────────────────── */}
      {isOpen && (
        <AITutorDrawer
          isOpen={isOpen}
          onClose={() => { setIsOpen(false); setBotState("idle"); }}
          botState={botState}
          setBotState={setBotState}
          onNewMessage={() => setHasNewMessage(true)}
        />
      )}
    </>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}

