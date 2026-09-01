import React from 'react';

export function SidebarButton({ icon, label, id, active, onClick }) {
      const isActive = active === id;
      return (
        <button 
          onClick={() => onClick(id)}
          className={`nav-link-btn ${isActive ? 'active' : ''}`}
        >
          <i className={`ph ${icon} text-lg ${isActive ? 'text-cyan-400' : 'text-slate-400'}`}></i>
          <span>{label}</span>
        </button>
      );
    }

