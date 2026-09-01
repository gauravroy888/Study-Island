import React from 'react';
import './Card.css';

export default function Card({ children, className = '', style = {} }) {
  return (
    <div className={`custom-card ${className}`} style={style}>
      {children}
    </div>
  );
}
