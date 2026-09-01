import React, { useState, useEffect } from 'react';

export function FullscreenToggle() {
      const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

      useEffect(() => {
        const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFSChange);
        return () => document.removeEventListener('fullscreenchange', handleFSChange);
      }, []);

      const toggleFS = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => console.warn(err));
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
        }
      };

      return (
        <button
          onClick={toggleFS}
          className="px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/30 text-slate-300 hover:text-white font-semibold text-xs flex items-center gap-2 transition shadow-md"
          title={isFullscreen ? "Exit Fullscreen (Esc)" : "Toggle Fullscreen"}
        >
          <i className={`ph ${isFullscreen ? 'ph-corners-in' : 'ph-corners-out'} text-base text-cyan-400`}></i>
          <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
        </button>
      );
    }
