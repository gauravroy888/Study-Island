import React from 'react';
import './Card.css';

export default function Card({ children, title, className = '', style = {}, noPadding = false, headerAction }) {
  return (
    <div className={`card glass-panel ${className}`} style={style}>
      {(title || headerAction) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {headerAction && <div className="card-action">{headerAction}</div>}
        </div>
      )}
      <div className={`card-content ${noPadding ? 'no-padding' : ''}`} style={style.flex === 1 ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : {}}>
        {children}
      </div>
    </div>
  );
}
