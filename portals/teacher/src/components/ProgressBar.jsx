import React from 'react';
import './ProgressBar.css';

export default function ProgressBar({ progress, color = 'var(--accent-cyan)', showLabel = true }) {
  return (
    <div className="progress-container">
      {showLabel && (
        <div className="progress-header">
          <span className="progress-text">{progress}% complete</span>
        </div>
      )}
      <div className="progress-track">
        <div 
          className="progress-fill" 
          style={{ width: `${progress}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
        />
      </div>
    </div>
  );
}
