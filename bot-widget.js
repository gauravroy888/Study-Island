/**
 * bot-widget.js — Aria AI Tutor (Standalone, Vanilla JS)
 * Full feature parity with Student Portal React AITutorWidget & AITutorDrawer:
 *   - Gemini 3.5 Flash Lite + Token SSE Streaming
 *   - Persistent Auto Screen Watch (Ask once, capture on every message)
 *   - Continuous Hands-Free Voice Conversation Loop (Listen -> Think -> Speak -> Listen)
 *   - Indian English TTS Voice (Neerja/Heera/Ravi with clean speech formatting)
 *   - Supabase Cloud Sync + 7-Day Rolling Memory Policy
 *   - Cross-Portal Session Sharing via localStorage + Supabase
 */
(function () {
  "use strict";

  // ── Standalone Bot Init ───────────────────────────────────────────

  var MODEL   = "gemini-3.6-flash";
  var MAX_H   = 12;
  var HINTS   = [
    { label:"What is this?",          value:"What is this thing on my screen? Explain it simply." },
    { label:"Give me a hint",         value:"Give me a small hint without telling me the full answer." },
    { label:"Explain differently",    value:"Can you explain that in a simpler way?" },
    { label:"Check my thinking",      value:"Here is my thinking. Is it on the right track?" },
    { label:"Break it down",          value:"Can you break this into smaller steps for me?" },
  ];

  // ── Gemini Key & URLs ───────────────────────────────────────────────────
  var KEY = "";
  var _FALLBACK_KEY = "";
  function initKey() {
    KEY = localStorage.getItem("aria_gemini_key")
       || (typeof window.ARIA_GEMINI_KEY === "string" ? window.ARIA_GEMINI_KEY : "")
       || _FALLBACK_KEY;
  }

  var SUPABASE_URL = window.SUPABASE_URL || "https://qmyrxvtbzlbnvzxypnus.supabase.co";
  var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo";

  // ── Chat History Persistence ───────────────────────────────────────────
  function saveHistoryToStorage() {
    try {
      var saved = (history || []).slice(-20);
      localStorage.setItem("aria_chat_history", JSON.stringify(saved));
    } catch (e) {}
  }

  function restoreHistoryFromStorage() {
    try {
      var raw = localStorage.getItem("aria_chat_history");
      if (!raw) return;
      var list = JSON.parse(raw);
      if (Array.isArray(list) && list.length) {
        var empty = $msgs ? $msgs.querySelector(".ai-drawer__empty") : null;
        if (empty) empty.remove();
        history = [];
        for (var i = 0; i < list.length; i++) {
          var item = list[i];
          var role = item.role === "user" ? "user" : "model";
          var txt = (item.parts && item.parts[0] && item.parts[0].text) || item.text || "";
          if (txt) {
            history.push({ role: role, parts: [{ text: txt }] });
            if ($msgs) addMsg(role, txt, false, false);
          }
        }
        if ($msgs) $msgs.scrollTop = $msgs.scrollHeight;
      }
    } catch (e) {}
  }

  // ── SVG Paths ───────────────────────────────────────────────────────────
  var BOT_DIR = (function() {
    var p = window.location.pathname || "";
    if (p.includes("/study-island")) return "/study-island/assets/bot/";
    return "assets/bot/";
  })();
  var SVG = {
    idle:  BOT_DIR + "bot-idle.svg",
    hover: BOT_DIR + "bot-hover.svg",
    click: BOT_DIR + "bot-click.svg",
    fail:  BOT_DIR + "bot-fail.svg"
  };

  // ── DOM References ──────────────────────────────────────────────────────
  var $w, $svg, $dot, $drawer, $statusSub, $msgs, $watchBanner, $watchBtn, $micBtn, $input, $sendBtn, $muteBtn, $voiceFooter, $voiceLabel;

  // ── State ───────────────────────────────────────────────────────────────
  var history = [];
  var isOpen = false;
  var botState = "idle"; // "idle" | "listening" | "thinking" | "speaking" | "error"
  var isLoading = false;
  var isListening = false;
  var isSpeaking = false;
  var voiceMode = false;
  var isMuted = (function () {
    try { return localStorage.getItem("aria_muted") === "true"; } catch (e) { return false; }
  })();

  // ── Web Audio Real-time Voice Synced Analyser ─────────────────────────────
  var audioCtx = null;
  var analyser = null;
  var micStream = null;
  var animFrameId = null;
  var $waveBars = [];

  function startAudioAnalyser() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (stream) {
        micStream = stream;
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioCtx = new AudioCtx();
        var source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);

        var dataArray = new Uint8Array(analyser.frequencyBinCount);

        function loop() {
          if (!isListening) return;
          analyser.getByteFrequencyData(dataArray);

          var b1 = Math.max(3, Math.min(18, Math.round(3 + (dataArray[2] || 0) / 255 * 15)));
          var b2 = Math.max(3, Math.min(18, Math.round(3 + (dataArray[5] || 0) / 255 * 15)));
          var b3 = Math.max(3, Math.min(18, Math.round(3 + (dataArray[8] || 0) / 255 * 15)));
          var b4 = Math.max(3, Math.min(18, Math.round(3 + (dataArray[12] || 0) / 255 * 15)));
          var b5 = Math.max(3, Math.min(18, Math.round(3 + (dataArray[15] || 0) / 255 * 15)));

          var heights = [b1, b2, b3, b4, b5];
          for (var i = 0; i < $waveBars.length; i++) {
            if ($waveBars[i]) $waveBars[i].style.height = (heights[i] || 4) + "px";
          }
          animFrameId = requestAnimationFrame(loop);
        }
        animFrameId = requestAnimationFrame(loop);
      }).catch(function (e) {
        console.warn("Audio analyser error:", e);
      });
    } catch (e) {}
  }

  function stopAudioAnalyser() {
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    if (micStream) {
      micStream.getTracks().forEach(function (t) { t.stop(); });
      micStream = null;
    }
    if (audioCtx) {
      try { audioCtx.close(); } catch (e) {}
      audioCtx = null;
    }
    for (var i = 0; i < $waveBars.length; i++) {
      if ($waveBars[i]) $waveBars[i].style.height = "4px";
    }
  }

  // ── Persistent Screen Watch Singleton ───────────────────────────────────
  var _stream = null;
  var _video = null;
  var _isWatching = false;

  function startScreenWatch(onReady) {
    if (_isWatching) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert("Screen sharing is not supported in this browser.");
      return;
    }
    navigator.mediaDevices
      .getDisplayMedia({ video: { frameRate: { ideal: 3, max: 5 } }, audio: false, preferCurrentTab: true })
      .then(function (s) {
        _stream = s;
        _video = document.createElement("video");
        _video.srcObject = s;
        _video.muted = true;
        _video.onloadedmetadata = function () {
          _video.play();
          _isWatching = true;
          syncWatchUI();
          if (onReady) onReady();
        };
        s.getVideoTracks()[0].addEventListener("ended", function () {
          _stream = null; _video = null; _isWatching = false;
          syncWatchUI();
        });
      })
      .catch(function (e) {
        console.warn("Screen share cancelled/error:", e.message);
      });
  }

  function stopScreenWatch() {
    if (_stream) {
      _stream.getTracks().forEach(function (t) { t.stop(); });
    }
    _stream = null; _video = null; _isWatching = false;
    syncWatchUI();
  }

  function captureAutoFrame() {
    if (!_isWatching || !_video || !_video.videoWidth) return null;
    try {
      var c = document.createElement("canvas");
      c.width = Math.min(_video.videoWidth, 1280);
      c.height = Math.round(c.width * _video.videoHeight / _video.videoWidth);
      c.getContext("2d").drawImage(_video, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.55).split(",")[1];
    } catch (e) { return null; }
  }

  // ── Context & Memory ────────────────────────────────────────────────────
  function getStudentUser() {
    try {
      return JSON.parse(localStorage.getItem("edtech_user") || localStorage.getItem("edtech_student_user") || "{}");
    } catch (e) { return {}; }
  }

  function getStudentId() {
    var u = getStudentUser();
    return u.id || u.uid || u.email || "guest_student";
  }

  function getCtx() {
    try {
      var u = getStudentUser();
      var b = JSON.parse(localStorage.getItem("edtech_school_branding") || "{}");
      var parts = ["Student: " + (u.name || "Student") + " | Class: " + (u.class_name || "6") + " | School: " + (b.school_name || "EdTech Island")];
      var path = window.location.pathname;
      var hash = window.location.hash;
      var title = document.title;

      // 1. Identify Portal & Active Navigation Route
      if (path.indexOf('/student') !== -1) {
        parts.push("Platform: Student Portal");
        if (path.indexOf('/dashboard') !== -1) parts.push("Current Screen/Option: Dashboard (Overview, Assigned Courses, XP, Active Modules)");
        else if (path.indexOf('/courses') !== -1) parts.push("Current Screen/Option: Courses Catalog (Physics, Biology, Chemistry, Custom Modules)");
        else if (path.indexOf('/timetable') !== -1) parts.push("Current Screen/Option: Timetable & Class Schedule");
        else if (path.indexOf('/tests') !== -1) parts.push("Current Screen/Option: Online Classes & Assessment Tests");
        else if (path.indexOf('/chats') !== -1) parts.push("Current Screen/Option: Messages & Teacher Q&A");
        else if (path.indexOf('/teachers') !== -1) parts.push("Current Screen/Option: Faculty & Teachers Directory");
        else if (path.indexOf('/analytics') !== -1) parts.push("Current Screen/Option: Academic Analytics & Mastery Reports");
        else if (path.indexOf('/settings') !== -1) parts.push("Current Screen/Option: Profile & App Settings");
        else parts.push("Current Screen: Student Deck (" + path + ")");
      } else if (path.indexOf('/study-island') !== -1 || title.indexOf('Study Island') !== -1 || title.indexOf('EdTech Island') !== -1) {
        parts.push("Platform: EdTech Island (3D Immersive Simulation World)");
        if (hash.indexOf('/chapter/') !== -1) parts.push("Current Screen/Option: Chapter Deep Dive (" + hash.replace('#/chapter/', '') + ")");
        else if (hash.indexOf('/experience') !== -1 || path.indexOf('/experience') !== -1) parts.push("Current Screen/Option: 3D Interactive Physics Simulation (Light, Shadows & Optics)");
        else if (hash.indexOf('/lab') !== -1 || path.indexOf('Shadow_Lab') !== -1) parts.push("Current Screen/Option: Virtual 3D Optics Lab");
        else if (hash.indexOf('/quiz') !== -1 || path.indexOf('quiz.html') !== -1) parts.push("Current Screen/Option: Chapter Quiz & Assessment");
        else parts.push("Current Screen/Option: 3D Island Main World Exploration");
      }

      // 2. Active Tab from Sidebar/Navbar
      var activeNav = document.querySelector('nav a.active, .nav-item.active, button.active, .tab-btn.active, [aria-current="page"]');
      if (activeNav && activeNav.textContent && activeNav.textContent.trim()) {
        parts.push('Selected Menu Item: "' + activeNav.textContent.trim().replace(/\s+/g, ' ') + '"');
      }

      // 3. Active Learning Module / Highlighted Card
      var activeModule = document.querySelector('[class*="ActiveLearning"], [class*="activeModule"], [class*="active-module"]');
      if (activeModule) {
        var modText = activeModule.textContent.replace(/\s+/g, ' ').trim().slice(0, 140);
        parts.push('Active Learning Module: "' + modText + '"');
      }

      // 4. Iframe simulation or lab overlay currently open
      var overlay = document.getElementById("app-overlay");
      var isOverlayOpen = overlay && !overlay.classList.contains("hidden") && overlay.style.display !== "none";
      if (isOverlayOpen) {
        var iframe = document.getElementById("app-iframe");
        var iframeSrc = iframe ? (iframe.getAttribute("src") || "") : "";
        var labName = iframeSrc.split("?")[0].replace(/\.html$/, "").replace(/_/g, " ");
        parts.push("Interactive Simulation Open: " + (labName || "Lab Module"));
        try {
          if (iframe && iframe.contentDocument) {
            var iDoc = iframe.contentDocument;
            var iH = iDoc.querySelector("h1, h2, .lab-title, .title");
            if (iH && iH.textContent) parts.push("Simulation View: " + iH.textContent.trim().slice(0, 80));
          }
        } catch (e) {}
      }

      // 5. Visible headings / active buttons
      var container = document.body;
      var nodes = container.querySelectorAll("h1, h2, h3, .tab-btn.active, button.active, .sub-heading");
      var texts = [];
      var len = 0;
      for (var i = 0; i < nodes.length; i++) {
        if (len > 300) break;
        var t = (nodes[i].textContent || "").replace(/\s+/g, " ").trim();
        if (t.length > 2 && t.length < 80 && texts.indexOf(t) === -1) {
          texts.push(t);
          len += t.length;
        }
      }
      if (texts.length) parts.push("Visible Context: " + texts.slice(0, 6).join(" | "));

      return parts.join("\n").slice(0, 480);
    } catch (e) {
      return "EdTech Island - " + document.title;
    }
  }

  function buildSystemPrompt() {
    var u = getStudentUser();
    var b = JSON.parse(localStorage.getItem("edtech_school_branding") || "{}");
    var school = b.school_name || "EdTech Island";
    var name = u.name || "Student";
    var cls = u.class_name || "Class 6";
    var sess = getSessionCtx();

    return "You are Aria, an AI tutor for " + school + ". You are tutoring " + name + " (" + cls + ").\n\n" +
      "CONTEXT:\n" +
      (sess ? sess + "\n" : "") +
      "You receive [Screen context] with every message — use it to give specific, relevant help.\n\n" +
      "RULES (STRICT):\n" +
      "- NO emojis, NO markdown, NO asterisks, NO bullets, NO symbols like *, **, ##, #, -, >, etc.\n" +
      "- Write in plain conversational sentences only, like speaking to a student.\n" +
      "- DO NOT repeat 'Hello " + name + "' or intro greetings on follow-up messages. Greet ONCE on the first message of a conversation, then answer follow-up questions directly without repeating canned intros or names.\n" +
      "- Guide with Socratic hints — help the student think, do not give full answers directly.\n" +
      "- Keep replies under 55 words and vary your wording naturally on every reply.\n" +
      "- Reference what is on screen when relevant.\n" +
      "- End with a short question or encouragement.\n" +
      "- Indian-friendly English tone is fine.";
  }

  function getSessionCtx() {
    try {
      var s = JSON.parse(localStorage.getItem("aria_session") || "{}");
      var y = JSON.parse(localStorage.getItem("aria_yesterday") || "{}");
      var parts = [];
      if (s.summary) parts.push("Today so far: " + s.summary);
      else if (s.topics && s.topics.length) parts.push("Topics today: " + s.topics.join(", ") + ".");
      if (y && y.summary) parts.push("Yesterday (" + y.date + "): " + y.summary);
      return parts.join(" ");
    } catch (e) { return ""; }
  }

  function syncSupabaseSession(s) {
    try {
      var studentId = getStudentId();
      fetch(SUPABASE_URL + "/rest/v1/aria_ai_sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + SUPABASE_ANON_KEY,
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          student_id: studentId,
          session_date: s.date,
          topics: s.topics || [],
          summary: s.summary || "",
          message_count: s.messageCount || 0,
          updated_at: new Date().toISOString()
        })
      }).catch(function () {});
    } catch (e) {}
  }

  function trackSessionTopic(title) {
    try {
      var raw = localStorage.getItem("aria_session");
      var today = new Date().toLocaleDateString("en-CA");
      var s = raw ? JSON.parse(raw) : { date: today, topics: [], summary: "", messageCount: 0 };
      if (s.date !== today) {
        if (s.summary || (s.topics && s.topics.length)) {
          localStorage.setItem("aria_yesterday", JSON.stringify({ date: s.date, summary: s.summary || ("Studied: " + s.topics.join(", ")) }));
        }
        s = { date: today, topics: [], summary: "", messageCount: 0 };
      }
      if (title && !s.topics.includes(title)) s.topics.push(title);
      s.messageCount = (s.messageCount || 0) + 1;
      localStorage.setItem("aria_session", JSON.stringify(s));
      syncSupabaseSession(s);
    } catch (e) {}
  }

  // ── Speech Output (TTS) with Indian Voice ───────────────────────────────
  var cachedVoice = null;
  function getIndianVoice() {
    if (!window.speechSynthesis) return null;
    var voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) return null;
    if (cachedVoice) return cachedVoice;
    var v = voices.find(function (x) { return x.lang === "en-IN" && (x.name.includes("Neerja") || x.name.includes("Heera") || x.name.includes("Ravi")); })
         || voices.find(function (x) { return x.lang === "en-IN"; })
         || voices.find(function (x) { return x.lang && x.lang.startsWith("en"); })
         || voices[0];
    cachedVoice = v;
    return v;
  }

  function cleanForSpeech(text) {
    if (!text) return "";
    return text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, "")
      .replace(/\*+/g, "")
      .replace(/#+/g, "")
      .replace(/`+/g, "")
      .replace(/_{2,}/g, "")
      .replace(/^[•\-\*]\s+/gm, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function toggleMute() {
    isMuted = !isMuted;
    try { localStorage.setItem("aria_muted", String(isMuted)); } catch (e) {}
    if (isMuted && window.speechSynthesis) window.speechSynthesis.cancel();
    syncMuteUI();
    updateStatusLabel();
  }

  var retryTimer = null;
  var activeCallback = null;

  function startAudioAnalyser() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

      var initStream = function (stream) {
        micStream = stream;
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        if (!audioCtx || audioCtx.state === "closed") {
          audioCtx = new AudioCtx();
          var source = audioCtx.createMediaStreamSource(micStream);
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.4;
          source.connect(analyser);
        } else if (audioCtx.state === "suspended") {
          audioCtx.resume();
        }

        if (!analyser) return;
        var dataArray = new Uint8Array(analyser.frequencyBinCount);

        function loop() {
          if (!isListening) return;
          analyser.getByteFrequencyData(dataArray);

          var b1 = Math.max(3, Math.min(18, Math.round(3 + (dataArray[2] || 0) / 255 * 15)));
          var b2 = Math.max(3, Math.min(18, Math.round(3 + (dataArray[5] || 0) / 255 * 15)));
          var b3 = Math.max(3, Math.min(18, Math.round(3 + (dataArray[8] || 0) / 255 * 15)));
          var b4 = Math.max(3, Math.min(18, Math.round(3 + (dataArray[12] || 0) / 255 * 15)));
          var b5 = Math.max(3, Math.min(18, Math.round(3 + (dataArray[15] || 0) / 255 * 15)));

          var heights = [b1, b2, b3, b4, b5];
          for (var i = 0; i < $waveBars.length; i++) {
            if ($waveBars[i]) $waveBars[i].style.height = (heights[i] || 4) + "px";
          }
          animFrameId = requestAnimationFrame(loop);
        }
        if (animFrameId) cancelAnimationFrame(animFrameId);
        animFrameId = requestAnimationFrame(loop);
      };

      if (micStream && micStream.active) {
        initStream(micStream);
      } else {
        navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(initStream).catch(function (e) {
          console.warn("Audio analyser error:", e);
        });
      }
    } catch (e) {}
  }

  function stopAudioAnalyser() {
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    if (micStream) {
      micStream.getTracks().forEach(function (t) { t.stop(); });
      micStream = null;
    }
    if (audioCtx) {
      try { audioCtx.close(); } catch (e) {}
      audioCtx = null;
    }
    for (var i = 0; i < $waveBars.length; i++) {
      if ($waveBars[i]) $waveBars[i].style.height = "4px";
    }
  }

  function syncMuteUI() {
    if (!$muteBtn) return;
    if (isMuted) {
      $muteBtn.className = "ai-drawer__icon-btn muted";
      $muteBtn.title = "Unmute Aria's voice";
      $muteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
    } else {
      $muteBtn.className = "ai-drawer__icon-btn";
      $muteBtn.title = "Mute Aria's voice";
      $muteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
    }
  }

  function speak(text, onEnd) {
    // ALWAYS stop STT before starting TTS speech synthesis
    stopListen();

    if (isMuted) {
      if (onEnd) setTimeout(onEnd, 1200);
      return;
    }
    if (!window.speechSynthesis) { if (onEnd) onEnd(); return; }
    try { window.speechSynthesis.cancel(); } catch (e) {}
    var spoken = cleanForSpeech(text);
    if (!spoken) { if (onEnd) onEnd(); return; }
    lastSpokenText = spoken;
    var u = new SpeechSynthesisUtterance(spoken);
    var v = getIndianVoice();
    if (v) u.voice = v;
    u.lang = "en-IN";
    u.rate = 1.0;
    u.pitch = 1.05;
    u.onstart = function () { isSpeaking = true; setBotState("speaking"); updateStatusLabel(); };
    u.onend = function () {
      isSpeaking = false;
      setBotState("idle");
      updateStatusLabel();
      if (onEnd && isOpen && voiceMode) setTimeout(onEnd, 600);
    };
    u.onerror = function () {
      isSpeaking = false;
      setBotState("idle");
      updateStatusLabel();
      if (onEnd && isOpen && voiceMode) setTimeout(onEnd, 600);
    };
    window.speechSynthesis.speak(u);
  }

  function stopSpeaking() {
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    isSpeaking = false;
    setBotState("idle");
    updateStatusLabel();
  }

  // ── Speech Recognition (STT) ───────────────────────────────────────────
  var silenceTimer = null;
  var transcriptBuffer = "";

  function startListen(onResult, onInterim) {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) return;
    if (!isOpen || !voiceMode || isSpeaking || (window.speechSynthesis && window.speechSynthesis.speaking)) return;

    if (onResult) activeCallback = onResult;
    if (retryTimer) clearTimeout(retryTimer);
    if (silenceTimer) clearTimeout(silenceTimer);
    transcriptBuffer = "";

    if (isListening && recognition) return;

    if (recognition) {
      try { recognition.abort(); } catch (e) {}
      recognition = null;
    }

    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 1;

    var accumulatedFinal = "";

    function dispatchFinal(text) {
      var clean = (text || "").trim();
      if (!clean) return;
      if (isEchoOfLastSpeech(clean, lastSpokenText)) {
        console.warn("STT: Discarded self-echoed speaker audio:", clean);
        accumulatedFinal = "";
        transcriptBuffer = "";
        return;
      }
      var cb = activeCallback;
      stopListen();
      if (cb) cb(clean);
    }

    recognition.onstart = function () {
      if (!isOpen || !voiceMode) { stopListen(); return; }
      isListening = true;
      setBotState("listening");
      startAudioAnalyser();
      updateStatusLabel();
    };

    recognition.onresult = function (e) {
      if (!isOpen || !voiceMode) { stopListen(); return; }
      var interim = "";
      for (var i = e.resultIndex; i < e.results.length; ++i) {
        var item = e.results[i];
        if (item.isFinal) {
          accumulatedFinal += item[0].transcript + " ";
        } else {
          interim += item[0].transcript;
        }
      }

      var currentLiveText = (accumulatedFinal + interim).trim();
      transcriptBuffer = currentLiveText;

      // Update textarea in real-time
      if ($input && currentLiveText) {
        $input.value = currentLiveText;
      }
      if (onInterim && currentLiveText) {
        onInterim(currentLiveText);
      }

      // Fast Smart Silence Detection: auto-finalize 750ms after speech stops
      if (silenceTimer) clearTimeout(silenceTimer);
      if (currentLiveText.length > 1) {
        silenceTimer = setTimeout(function () {
          if (transcriptBuffer) {
            dispatchFinal(transcriptBuffer);
          }
        }, 750);
      }
    };

    recognition.onerror = function (e) {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (e.error === "no-speech" || e.error === "aborted" || e.error === "network") {
        if (isOpen && voiceMode && activeCallback && !isSpeaking) {
          retryTimer = setTimeout(function () {
            if (isOpen && voiceMode && activeCallback && !isListening) {
              startListen(activeCallback, onInterim);
            }
          }, 350);
        }
      } else {
        console.warn("STT error:", e.error);
      }
    };

    recognition.onend = function () {
      isListening = false;
      setBotState("idle");
      stopAudioAnalyser();
      updateStatusLabel();
      if (transcriptBuffer && transcriptBuffer.trim().length > 1) {
        dispatchFinal(transcriptBuffer);
        return;
      }
      if (isOpen && voiceMode && activeCallback && !isLoading && !isSpeaking) {
        retryTimer = setTimeout(function () {
          if (isOpen && voiceMode && activeCallback && !isListening) {
            startListen(activeCallback, onInterim);
          }
        }, 300);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn("STT start error, scheduling retry:", e.message);
      if (isOpen && voiceMode && activeCallback) {
        retryTimer = setTimeout(function () {
          if (isOpen && voiceMode && activeCallback && !isListening) {
            startListen(activeCallback, onInterim);
          }
        }, 500);
      }
    }
  }

  function stopListen() {
    activeCallback = null;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (recognition) {
      try { recognition.abort(); } catch (e) {}
      recognition = null;
    }
    isListening = false;
    setBotState("idle");
    stopAudioAnalyser();
    updateStatusLabel();
  }

  // ── SSE Token Streaming Gemini API Call ─────────────────────────────────
  async function streamChat(text, onToken, onComplete, onError) {
    initKey();
    if (!KEY) {
      if (onError) onError("API key not found. Please log in through the Student Portal first.");
      return;
    }
    trackSessionTopic(document.title);
    var autoFrame = captureAutoFrame();
    var parts = [{ text: "[Screen context: " + getCtx() + "]" }, { text: text }];
    if (autoFrame) {
      parts.push({ inline_data: { mime_type: "image/jpeg", data: autoFrame } });
    }
    history.push({ role: "user", parts: [{ text: text }] });
    if (history.length > MAX_H) history = history.slice(-MAX_H);

    var sysInstruction = buildSystemPrompt();

    var body = JSON.stringify({
      system_instruction: { parts: [{ text: sysInstruction }] },
      contents: history.slice(0, -1).concat([{ role: "user", parts: parts }]),
      generationConfig: { temperature: 0.6, maxOutputTokens: 150, topP: 0.9 }
    });

    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":streamGenerateContent?alt=sse&key=" + KEY;

    try {
      var response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body
      });
      if (!response.ok) throw new Error("HTTP " + response.status);

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var accumulated = "";

      while (true) {
        var { done, value } = await reader.read();
        if (done) break;
        var chunk = decoder.decode(value, { stream: true });
        var lines = chunk.split("\n");
        for (var line of lines) {
          if (line.startsWith("data: ")) {
            var jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;
            try {
              var parsed = JSON.parse(jsonStr);
              var token = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (token) {
                accumulated += token;
                if (onToken) onToken(accumulated);
              }
            } catch (e) {}
          }
        }
      }

      history.push({ role: "model", parts: [{ text: accumulated }] });
      if (onComplete) onComplete(accumulated, !!autoFrame);
    } catch (err) {
      if (onError) onError(err.message || "Connection error");
    }
  }

  // ── DOM References ──────────────────────────────────────────────────────
  var $w, $svg, $dot, $drawer, $msgs, $input, $watchBtn, $watchBanner, $micBtn, $sendBtn, $statusSub, $voiceFooter;

  function setBotState(s) {
    botState = s;
    if ($dot) {
      $dot.className = "state-dot state-dot--" + s;
    }
    if ($svg && !isOpen) {
      $svg.src = (s === "thinking" || s === "listening") ? SVG.click : (s === "error" ? SVG.fail : SVG.idle);
    }
  }

  function updateStatusLabel() {
    if (!$statusSub) return;
    var u = getStudentUser();
    var name = u.name || "Student";
    var text = voiceMode && isListening ? "Listening — speak now"
      : voiceMode && isSpeaking  ? "Speaking — will listen when done"
      : voiceMode && isLoading   ? "Thinking"
      : isListening              ? "Listening"
      : isLoading                ? "Thinking"
      : isSpeaking               ? "Speaking"
      : "Hi " + name + "! Ask me anything.";
    $statusSub.textContent = text;

    if ($voiceFooter) {
      $voiceFooter.style.display = voiceMode ? "block" : "none";
      if (voiceMode) {
        $voiceFooter.textContent = isListening ? "Listening — speak now"
          : isSpeaking ? "Speaking — will auto-listen when done"
          : isLoading ? "Thinking..."
          : "Voice mode on — I will listen automatically after each reply";
        $voiceFooter.style.color = isListening ? "#60a5fa" : (isSpeaking ? "#a78bfa" : "#64748b");
      }
    }
  }

  function syncWatchUI() {
    if ($watchBtn) {
      $watchBtn.style.color = _isWatching ? "#10B981" : "";
      $watchBtn.style.borderColor = _isWatching ? "rgba(16,185,129,0.5)" : "";
      $watchBtn.style.background = _isWatching ? "rgba(16,185,129,0.1)" : "";
      $watchBtn.innerHTML = _isWatching
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
      $watchBtn.title = _isWatching ? "Stop watching screen" : "Let Aria watch your screen automatically";
    }
    if ($watchBanner) $watchBanner.style.display = _isWatching ? "flex" : "none";
  }

  function addMsg(role, text, isStreaming, hasAutoScreen) {
    var empty = $msgs.querySelector(".ai-drawer__empty");
    if (empty) empty.remove();

    var row = document.createElement("div");
    row.className = "ai-drawer__msg ai-drawer__msg--" + role;

    if (role === "model") {
      var av = document.createElement("span");
      av.className = "ai-drawer__avatar";
      av.textContent = "🤖";
      row.appendChild(av);
    }

    var bub = document.createElement("div");
    bub.className = "ai-drawer__bubble" + (isStreaming ? " streaming" : "");

    if (hasAutoScreen) {
      var screenTag = document.createElement("div");
      screenTag.style.cssText = "font-size:0.68rem;color:#10B981;margin-bottom:4px;display:flex;align-items:center;gap:4px;";
      screenTag.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> Aria saw your screen';
      bub.appendChild(screenTag);
    }

    var textNode = document.createElement("span");
    textNode.className = "bubble-text";
    textNode.textContent = text || (isStreaming ? "" : "...");
    bub.appendChild(textNode);

    if (role === "model" && !isStreaming && text) {
      var replayBtn = document.createElement("button");
      replayBtn.className = "ai-drawer__replay";
      replayBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> play';
      replayBtn.onclick = function () { speak(text); };
      bub.appendChild(replayBtn);
    }

    row.appendChild(bub);
    $msgs.appendChild(row);
    $msgs.scrollTop = $msgs.scrollHeight;
    return { row: row, bub: bub, textNode: textNode };
  }

  function addThinking() {
    var row = document.createElement("div");
    row.className = "ai-drawer__msg ai-drawer__msg--model";
    row.id = "aria-thinking";
    var av = document.createElement("span");
    av.className = "ai-drawer__avatar";
    av.textContent = "🤖";
    row.appendChild(av);
    var bub = document.createElement("div");
    bub.className = "ai-drawer__bubble ai-drawer__bubble--thinking";
    for (var i = 0; i < 3; i++) {
      var d = document.createElement("span");
      d.className = "thinking-dot";
      bub.appendChild(d);
    }
    row.appendChild(bub);
    $msgs.appendChild(row);
    $msgs.scrollTop = $msgs.scrollHeight;
  }

  function removeThinking() {
    var t = document.getElementById("aria-thinking");
    if (t) t.remove();
  }

  function showEmpty() {
    var e = document.createElement("div");
    e.className = "ai-drawer__empty";
    e.innerHTML = '<div class="ai-drawer__empty-icon">🎓</div><p>I am <strong>Aria</strong>, your AI tutor.<br/>Ask me anything about what you are studying!</p><p style="font-size:0.78rem;opacity:0.55;">Press <strong>Watch Screen</strong> once and I will automatically see your screen on every question. Press the mic for hands-free voice chat.</p>';
    $msgs.appendChild(e);
  }

  function afterSpeakLoop() {
    if (!voiceMode) return;
    setTimeout(function () {
      if (voiceMode) {
        startListen(function (voiceText) { doSend(voiceText); });
      }
    }, 500);
  }

  function doSend(textOverride) {
    var text = (textOverride || ($input ? $input.value : "") || "").trim();
    if (!text || isLoading) return;
    if ($input) $input.value = "";

    var hadScreen = _isWatching;
    addMsg("user", text, false, hadScreen);

    isLoading = true;
    setBotState("thinking");
    updateStatusLabel();
    addThinking();

    var streamMsg = null;

    streamChat(
      text,
      function onToken(accumulated) {
        removeThinking();
        if (!streamMsg) {
          streamMsg = addMsg("model", accumulated, true, false);
        } else {
          streamMsg.textNode.textContent = accumulated;
          $msgs.scrollTop = $msgs.scrollHeight;
        }
      },
      function onComplete(fullReply, autoSawScreen) {
        removeThinking();
        isLoading = false;
        setBotState("idle");
        updateStatusLabel();

        if (streamMsg) {
          streamMsg.bub.classList.remove("streaming");
          streamMsg.textNode.textContent = fullReply;
          var replayBtn = document.createElement("button");
          replayBtn.className = "ai-drawer__replay";
          replayBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> play';
          replayBtn.onclick = function () { speak(fullReply); };
          streamMsg.bub.appendChild(replayBtn);
        } else {
          addMsg("model", fullReply, false, false);
        }

        saveHistoryToStorage();
        speak(fullReply, voiceMode ? afterSpeakLoop : undefined);
      },
      function onError(err) {
        removeThinking();
        isLoading = false;
        setBotState("error");
        updateStatusLabel();
        addMsg("model", "⚠️ " + err, false, false);
        setTimeout(function () { setBotState("idle"); updateStatusLabel(); }, 3000);
      }
    );
  }

  function toggleVoiceMode() {
    if (voiceMode) {
      voiceMode = false;
      stopListen();
      stopSpeaking();
    } else {
      voiceMode = true;
      startListen(function (voiceText) { doSend(voiceText); });
    }
    syncVoiceUI();
    updateStatusLabel();
  }

  function syncVoiceUI() {
    if (!$micBtn) return;
    if (voiceMode) {
      $micBtn.className = "ai-drawer__mic-btn active-voice";
      $micBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
      $micBtn.title = "Stop voice mode";
    } else {
      $micBtn.className = "ai-drawer__mic-btn";
      $micBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
      $micBtn.title = "Start hands-free voice conversation";
    }
  }

  function updateStatusLabel() {
    if (!$statusSub) return;
    var u = getStudentUser();
    var name = u.name || "Student";
    var text = voiceMode && isListening ? "Listening — speak now"
      : voiceMode && isSpeaking  ? (isMuted ? "Replying silently..." : "Speaking — will listen when done")
      : voiceMode && isLoading   ? "Thinking"
      : isListening              ? "Listening"
      : isLoading                ? "Thinking"
      : isSpeaking               ? (isMuted ? "Replying..." : "Speaking")
      : "Hi " + name + "! Ask me anything.";
    $statusSub.textContent = text;

    if ($voiceFooter) {
      $voiceFooter.style.display = voiceMode ? "flex" : "none";
      if (voiceMode && $voiceLabel) {
        $voiceLabel.textContent = isListening ? "Listening — speak now"
          : isSpeaking ? (isMuted ? "Replying silently..." : "Speaking — will auto-listen when done")
          : isLoading ? "Thinking..."
          : "Voice mode on — I will listen automatically after each reply";
        $voiceLabel.style.color = isListening ? "#ef4444" : (isSpeaking ? "#a78bfa" : "#94a3b8");

        for (var i = 0; i < $waveBars.length; i++) {
          if ($waveBars[i]) {
            if (isSpeaking) $waveBars[i].classList.add("speaking");
            else $waveBars[i].classList.remove("speaking");
          }
        }
      }
    }
  }

  function openDrawer() {
    isOpen = true;
    $w.classList.add("open");
    $drawer.classList.add("ai-drawer--open");
    if ($svg) $svg.src = SVG.hover;
    setTimeout(function () { if ($input) $input.focus(); }, 320);
  }

  function closeDrawer() {
    isOpen = false;
    $w.classList.remove("open");
    $drawer.classList.remove("ai-drawer--open");
    if ($svg) $svg.src = botState === "thinking" ? SVG.click : SVG.idle;
    stopSpeaking();
    if (voiceMode) toggleVoiceMode();
  }

  // ── Build Widget & Drawer DOM ───────────────────────────────────────────
  function build() {
    if (!document.body) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", build);
      } else {
        setTimeout(build, 100);
      }
      return;
    }

    // Destroy any stale bot DOM from a previous load
    var stale = document.querySelectorAll(".ai-tutor-widget, .ai-drawer");
    stale.forEach(function (el) { el.remove(); });

    // ── Inject self-contained CSS (matches Student Portal React AITutorWidget.css exactly) ──
    if (!document.getElementById("aria-widget-css")) {
      var styleEl = document.createElement("style");
      styleEl.id = "aria-widget-css";
      styleEl.textContent = [
        ".ai-tutor-widget{position:fixed;bottom:24px;right:24px;width:120px;height:140px;cursor:pointer;z-index:9999;user-select:none;transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1);-webkit-tap-highlight-color:transparent;}",
        ".ai-tutor-widget:hover{transform:scale(1.07) translateY(-2px);}.ai-tutor-widget.open{transform:scale(0.94);}",
        ".bot-svg{width:100%;height:100%;display:block;pointer-events:none;filter:drop-shadow(0 6px 20px rgba(148,121,255,0.55));transition:filter 0.3s ease;}",
        ".ai-tutor-widget:hover .bot-svg{filter:drop-shadow(0 10px 32px rgba(148,121,255,0.85));}",
        ".state-dot{position:absolute;bottom:30px;right:14px;width:11px;height:11px;border-radius:50%;border:2px solid rgba(6,10,20,0.95);transition:background-color 0.3s;}",
        ".state-dot--idle{background:#10B981;}.state-dot--listening{background:#3B82F6;animation:sdot 1s infinite;}.state-dot--thinking{background:#F59E0B;animation:sdot 0.8s infinite;}.state-dot--speaking{background:#A855F7;animation:sdot 0.6s infinite;}.state-dot--error{background:#EF4444;}",
        "@keyframes sdot{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.4;transform:scale(0.75);}}",
        ".widget-tooltip{position:absolute;bottom:calc(100% + 10px);right:0;background:rgba(8,14,28,0.97);border:1px solid rgba(148,121,255,0.4);color:#e2e8f0;font-size:0.76rem;font-weight:700;padding:6px 12px;border-radius:10px;white-space:nowrap;opacity:0;transform:translateY(6px);transition:opacity 0.2s,transform 0.2s;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,0.35);}",
        ".ai-tutor-widget:hover .widget-tooltip{opacity:1;transform:translateY(0);}",
        ".ai-drawer{position:fixed;bottom:178px;right:24px;width:365px;max-height:68vh;background:rgba(7,12,26,0.98);backdrop-filter:blur(24px);border:1px solid rgba(148,121,255,0.28);border-radius:22px;z-index:9998;display:none;flex-direction:column;overflow:hidden;box-shadow:0 28px 72px rgba(0,0,0,0.55),0 0 0 1px rgba(148,121,255,0.08) inset;animation:drawerIn 0.3s cubic-bezier(0.34,1.56,0.64,1);}",
        ".ai-drawer.ai-drawer--open{display:flex;}",
        "@keyframes drawerIn{from{opacity:0;transform:translateY(20px) scale(0.95);}to{opacity:1;transform:translateY(0) scale(1);}}",
        ".ai-drawer__header{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:rgba(148,121,255,0.07);border-bottom:1px solid rgba(148,121,255,0.14);flex-shrink:0;}",
        ".ai-drawer__title{display:flex;align-items:center;gap:10px;}",
        ".ai-drawer__sdot{width:8px;height:8px;border-radius:50%;flex-shrink:0;background:#10B981;}",
        ".ai-drawer__sdot.active{background:#9479ff;animation:sdot 1s infinite;}",
        ".ai-drawer__name{font-size:0.88rem;font-weight:800;color:#c4b5fd;letter-spacing:0.3px;}",
        ".ai-drawer__sub{font-size:0.72rem;color:#64748b;margin-top:1px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
        ".ai-drawer__hdr-actions{display:flex;gap:4px;}",
        ".ai-drawer__icon-btn{background:none;border:none;color:#475569;cursor:pointer;padding:7px;border-radius:8px;display:flex;align-items:center;transition:color 0.2s,background 0.2s;}",
        ".ai-drawer__icon-btn:hover{color:#e2e8f0;background:rgba(255,255,255,0.06);}",
        ".ai-drawer__icon-btn.muted{color:#f59e0b;background:rgba(245,158,11,0.12);}",
        ".ai-drawer__msgs{flex:1;overflow-y:auto;padding:14px 15px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin;scrollbar-color:rgba(148,121,255,0.25) transparent;}",
        ".ai-drawer__msgs::-webkit-scrollbar{width:4px;}.ai-drawer__msgs::-webkit-scrollbar-track{background:transparent;}.ai-drawer__msgs::-webkit-scrollbar-thumb{background:rgba(148,121,255,0.25);border-radius:4px;}",
        ".ai-drawer__empty{text-align:center;color:#475569;padding:18px 10px;font-size:0.86rem;line-height:1.65;display:flex;flex-direction:column;align-items:center;gap:10px;}",
        ".ai-drawer__empty-icon{font-size:2.6rem;}.ai-drawer__empty p{margin:0;}",
        ".ai-drawer__msg{display:flex;align-items:flex-end;gap:7px;animation:msgIn 0.22s ease;}",
        "@keyframes msgIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}",
        ".ai-drawer__msg--user{flex-direction:row-reverse;}",
        ".ai-drawer__avatar{font-size:1.15rem;flex-shrink:0;margin-bottom:2px;}",
        ".ai-drawer__bubble{max-width:79%;padding:9px 13px;border-radius:16px;font-size:0.865rem;line-height:1.6;position:relative;word-wrap:break-word;white-space:pre-wrap;}",
        ".ai-drawer__msg--user .ai-drawer__bubble{background:linear-gradient(135deg,#6d28d9,#4c5eff);color:#fff;border-bottom-right-radius:4px;}",
        ".ai-drawer__msg--model .ai-drawer__bubble{background:rgba(148,121,255,0.08);border:1px solid rgba(148,121,255,0.18);color:#e2e8f0;border-bottom-left-radius:4px;}",
        ".ai-drawer__bubble.streaming::after{content:'▋';display:inline-block;color:#9479ff;animation:blink-cur 0.65s step-end infinite;margin-left:2px;}",
        "@keyframes blink-cur{0%,100%{opacity:1;}50%{opacity:0;}}",
        ".ai-drawer__replay{position:absolute;bottom:-20px;right:4px;background:none;border:none;color:#475569;cursor:pointer;padding:2px 5px;border-radius:5px;display:flex;align-items:center;gap:3px;font-size:0.68rem;opacity:0;transition:opacity 0.2s;}",
        ".ai-drawer__msg--model:hover .ai-drawer__replay{opacity:1;}",
        ".ai-drawer__bubble--thinking{display:flex;align-items:center;gap:5px;padding:12px 16px;}",
        ".thinking-dot{width:7px;height:7px;border-radius:50%;background:#9479ff;animation:tdot 1.2s ease-in-out infinite;}",
        ".thinking-dot:nth-child(2){animation-delay:0.2s;}.thinking-dot:nth-child(3){animation-delay:0.4s;}",
        "@keyframes tdot{0%,100%{opacity:0.25;transform:translateY(0);}50%{opacity:1;transform:translateY(-5px);}}",
        ".ai-drawer__hints{display:flex;gap:6px;padding:8px 15px;overflow-x:auto;flex-shrink:0;scrollbar-width:none;border-top:1px solid rgba(255,255,255,0.045);}",
        ".ai-drawer__hints::-webkit-scrollbar{display:none;}",
        ".ai-drawer__chip{flex-shrink:0;background:rgba(148,121,255,0.07);border:1px solid rgba(148,121,255,0.18);color:#a78bfa;font-size:0.71rem;font-weight:700;padding:5px 11px;border-radius:20px;cursor:pointer;white-space:nowrap;transition:all 0.2s;font-family:inherit;}",
        ".ai-drawer__chip:hover:not(:disabled){background:rgba(148,121,255,0.18);border-color:rgba(148,121,255,0.45);color:#fff;}",
        ".ai-drawer__chip:disabled{opacity:0.38;cursor:not-allowed;}",
        ".ai-drawer__input-area{display:flex;align-items:flex-end;gap:8px;padding:11px 14px;border-top:1px solid rgba(255,255,255,0.05);flex-shrink:0;}",
        ".ai-drawer__input{flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(148,121,255,0.18);border-radius:13px;color:#e2e8f0;font-size:0.865rem;padding:9px 13px;resize:none;outline:none;font-family:inherit;line-height:1.5;max-height:90px;transition:border-color 0.2s;scrollbar-width:none;}",
        ".ai-drawer__input::-webkit-scrollbar{display:none;}.ai-drawer__input:focus{border-color:rgba(148,121,255,0.48);}.ai-drawer__input::placeholder{color:#334155;}",
        // ── Eye/Watch button & Mic button — EXACT match to Student Portal ──
        ".ai-drawer__mic-btn{background:rgba(148,121,255,0.09);border:1px solid rgba(148,121,255,0.22);color:#9479ff;border-radius:11px;padding:9px;cursor:pointer;display:flex;align-items:center;transition:all 0.2s;flex-shrink:0;}",
        ".ai-drawer__mic-btn:hover{background:rgba(148,121,255,0.2);}",
        ".ai-drawer__mic-btn.active-voice,.ai-drawer__mic-btn.listening{background:rgba(239,68,68,0.22);border-color:rgba(239,68,68,0.6);color:#ef4444;animation:redMicPulse 1.5s ease-in-out infinite;}",
        "@keyframes redMicPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.45);}50%{box-shadow:0 0 0 8px rgba(239,68,68,0);}}",
        ".ai-drawer__send-btn{background:linear-gradient(135deg,#6d28d9,#4c5eff);border:none;color:#fff;border-radius:11px;padding:9px 14px;cursor:pointer;display:flex;align-items:center;transition:all 0.2s;flex-shrink:0;box-shadow:0 4px 14px rgba(109,40,217,0.45);font-family:inherit;}",
        ".ai-drawer__send-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 18px rgba(109,40,217,0.65);}",
        ".ai-drawer__send-btn:disabled{opacity:0.35;cursor:not-allowed;transform:none;box-shadow:none;}",
        ".ai-drawer__voice-footer{display:flex;align-items:center;justify-content:center;gap:10px;padding:8px 14px 10px;font-size:0.74rem;color:#64748b;border-top:1px solid rgba(148,121,255,0.1);background:rgba(6,10,20,0.9);}",
        ".ai-drawer__waveform{display:inline-flex;align-items:center;gap:3px;height:18px;}",
        ".ai-drawer__wave-bar{width:3px;height:4px;min-height:4px;max-height:18px;background:#ef4444;border-radius:2px;transition:height 0.05s ease-out,background-color 0.2s;animation:waveFallback 1.1s ease-in-out infinite;}",
        ".ai-drawer__wave-bar:nth-child(1){animation-delay:0.0s;}.ai-drawer__wave-bar:nth-child(2){animation-delay:0.2s;}.ai-drawer__wave-bar:nth-child(3){animation-delay:0.1s;}.ai-drawer__wave-bar:nth-child(4){animation-delay:0.3s;}.ai-drawer__wave-bar:nth-child(5){animation-delay:0.15s;}",
        "@keyframes waveFallback{0%,100%{height:4px;}25%{height:14px;}50%{height:8px;}75%{height:16px;}}",
        ".ai-drawer__wave-bar.speaking{background:#9479ff;animation-duration:0.7s;}",
        ".ai-drawer__voice-label{font-size:0.74rem;color:#64748b;}",
        "@media(max-width:500px){.ai-drawer{right:8px;left:8px;width:auto;bottom:168px;max-height:74vh;}.ai-tutor-widget{bottom:16px;right:16px;width:100px;height:118px;}}"

      ].join("");
      document.head.appendChild(styleEl);
    }


    // 1. Floating Widget Button
    $w = document.createElement("div");
    $w.className = "ai-tutor-widget aria-widget";

    $svg = document.createElement("img");
    $svg.src = SVG.idle;
    $svg.className = "bot-svg aria-svg";
    $svg.alt = "Aria";
    $svg.onerror = function () {
      if (!$svg._retried) {
        $svg._retried = true;
        $svg.src = "/study-island/assets/bot/bot-idle.svg";
      }
    };

    $dot = document.createElement("span");
    $dot.className = "state-dot state-dot--idle aria-dot idle";

    var tip = document.createElement("div");
    tip.className = "widget-tooltip aria-tip";
    tip.textContent = "✨ Ask Aria — AI Tutor";

    $w.appendChild($svg);
    $w.appendChild($dot);
    $w.appendChild(tip);

    $w.addEventListener("mouseenter", function () { if (!isOpen && $svg) $svg.src = SVG.hover; });
    $w.addEventListener("mouseleave", function () { if (!isOpen && $svg) $svg.src = botState === "thinking" ? SVG.click : SVG.idle; });
    $w.addEventListener("click", function () { isOpen ? closeDrawer() : openDrawer(); });

    // 2. Chat Drawer — hidden by default (no .ai-drawer--open class = not displayed)
    $drawer = document.createElement("div");
    $drawer.className = "ai-drawer aria-drawer";

    // Header
    var hdr = document.createElement("div");
    hdr.className = "ai-drawer__header";

    var titleBox = document.createElement("div");
    titleBox.className = "ai-drawer__title";
    var sdot = document.createElement("span");
    sdot.className = "ai-drawer__sdot";
    titleBox.appendChild(sdot);

    var infoBox = document.createElement("div");
    var nameRow = document.createElement("div");
    nameRow.className = "ai-drawer__name";
    nameRow.textContent = "Aria — AI Tutor";
    infoBox.appendChild(nameRow);

    $statusSub = document.createElement("div");
    $statusSub.className = "ai-drawer__sub";
    infoBox.appendChild($statusSub);
    titleBox.appendChild(infoBox);
    hdr.appendChild(titleBox);

    var actions = document.createElement("div");
    actions.className = "ai-drawer__hdr-actions";

    $muteBtn = document.createElement("button");
    $muteBtn.className = "ai-drawer__icon-btn" + (isMuted ? " muted" : "");
    $muteBtn.onclick = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      toggleMute();
    };
    syncMuteUI();

    var trashBtn = document.createElement("button");
    trashBtn.className = "ai-drawer__icon-btn";
    trashBtn.title = "Clear conversation";
    trashBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    trashBtn.onclick = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      history = [];
      try { localStorage.removeItem("aria_chat_history"); } catch (ex) {}
      while ($msgs.firstChild) $msgs.removeChild($msgs.firstChild);
      showEmpty();
    };

    var closeBtn = document.createElement("button");
    closeBtn.className = "ai-drawer__icon-btn";
    closeBtn.title = "Close";
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.onclick = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      closeDrawer();
    };

    actions.appendChild($muteBtn);
    actions.appendChild(trashBtn);
    actions.appendChild(closeBtn);
    hdr.appendChild(actions);
    $drawer.appendChild(hdr);

    // Messages Area
    $msgs = document.createElement("div");
    $msgs.className = "ai-drawer__msgs";
    showEmpty();
    restoreHistoryFromStorage();
    $drawer.appendChild($msgs);

    // Hint Chips
    var hintsBox = document.createElement("div");
    hintsBox.className = "ai-drawer__hints";
    HINTS.forEach(function (h) {
      var chip = document.createElement("button");
      chip.className = "ai-drawer__chip";
      chip.textContent = h.label;
      chip.onclick = function () { doSend(h.value); };
      hintsBox.appendChild(chip);
    });
    $drawer.appendChild(hintsBox);

    // Watch Screen Banner
    $watchBanner = document.createElement("div");
    $watchBanner.style.cssText = "display:none;padding:7px 14px;align-items:center;gap:8px;background:rgba(16,185,129,0.07);border-top:1px solid rgba(16,185,129,0.2);";
    $watchBanner.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span style="font-size:0.72rem;color:#10B981;flex:1;font-weight:600;">Aria sees your screen on every message</span>';
    var stopBtn = document.createElement("button");
    stopBtn.textContent = "Stop";
    stopBtn.style.cssText = "background:none;color:#64748b;cursor:pointer;font-size:0.7rem;padding:2px 6px;border:1px solid rgba(100,116,139,0.3);border-radius:6px;";
    stopBtn.onclick = stopScreenWatch;
    $watchBanner.appendChild(stopBtn);
    $drawer.appendChild($watchBanner);

    // Input Row
    var inputRow = document.createElement("div");
    inputRow.className = "ai-drawer__input-area";

    // Watch Button
    $watchBtn = document.createElement("button");
    $watchBtn.className = "ai-drawer__mic-btn";
    $watchBtn.title = "Let Aria watch your screen automatically (ask once, capture on every message)";
    $watchBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    $watchBtn.onclick = function () { _isWatching ? stopScreenWatch() : startScreenWatch(); };
    inputRow.appendChild($watchBtn);

    // Voice Mode Button
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      $micBtn = document.createElement("button");
      $micBtn.className = "ai-drawer__mic-btn";
      $micBtn.title = "Start hands-free voice conversation";
      $micBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
      $micBtn.onclick = toggleVoiceMode;
      inputRow.appendChild($micBtn);
    }

    // Textarea
    $input = document.createElement("textarea");
    $input.className = "ai-drawer__input";
    $input.placeholder = "Ask anything about your studies...";
    $input.rows = 1;
    $input.onkeydown = function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    };
    inputRow.appendChild($input);

    // Send Button
    $sendBtn = document.createElement("button");
    $sendBtn.className = "ai-drawer__send-btn";
    $sendBtn.title = "Send";
    $sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    $sendBtn.onclick = function () { doSend(); };
    inputRow.appendChild($sendBtn);
    $drawer.appendChild(inputRow);

    // Voice Status Footer with Real-time Waveform
    $voiceFooter = document.createElement("div");
    $voiceFooter.className = "ai-drawer__voice-footer";
    $voiceFooter.style.display = "none";

    var waveContainer = document.createElement("div");
    waveContainer.className = "ai-drawer__waveform";
    $waveBars = [];
    for (var w = 0; w < 5; w++) {
      var bar = document.createElement("span");
      bar.className = "ai-drawer__wave-bar";
      waveContainer.appendChild(bar);
      $waveBars.push(bar);
    }
    $voiceFooter.appendChild(waveContainer);

    $voiceLabel = document.createElement("span");
    $voiceLabel.className = "ai-drawer__voice-label";
    $voiceFooter.appendChild($voiceLabel);

    $drawer.appendChild($voiceFooter);

    document.body.appendChild($w);
    document.body.appendChild($drawer);

    updateStatusLabel();
  }

  // ── Init ────────────────────────────────────────────────────────────────
  function init() {
    initKey();
    build();
    if (window.speechSynthesis && !window.speechSynthesis.getVoices().length) {
      window.speechSynthesis.addEventListener("voiceschanged", function () { getIndianVoice(); }, { once: true });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

})();
