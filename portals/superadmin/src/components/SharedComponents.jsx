import React from 'react';

export function StatBox({ label, value, icon, color }) {
  return (
    <div className="glass-panel p-4 flex items-center justify-between">
      <div>
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <p className="text-xl font-extrabold text-white mt-1">{value}</p>
      </div>
      <i className={`ph ${icon} text-3xl ${color}`}></i>
    </div>
  );
}

export function FlagCard({ title, desc, active, onToggle, danger }) {
  return (
    <div className="glass-panel p-5 flex items-center justify-between">
      <div>
        <h4 className="font-bold text-white text-sm flex items-center gap-2">
          {title} {danger && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-mono">DANGER</span>}
        </h4>
        <p className="text-xs text-slate-400 max-w-sm mt-0.5">{desc}</p>
      </div>
      <button 
        onClick={onToggle}
        className={`w-12 h-6 rounded-full transition-colors relative p-1 ${active ? (danger ? 'bg-red-500' : 'bg-cyan-400') : 'bg-slate-800'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-slate-950 transition-transform ${active ? 'translate-x-6' : 'translate-x-0'}`}></div>
      </button>
    </div>
  );
}

export class SuperAdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SuperAdmin Portal caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#060a14] text-white font-['Inter',sans-serif]">
          <div className="glass-panel max-w-lg p-8 text-center border border-cyan-500/40">
            <div className="text-4xl mb-3">🛡️ ⚡</div>
            <h2 className="text-xl font-bold text-cyan-400 mb-2">SuperAdmin Session Recovered</h2>
            <p className="text-xs text-slate-400 mb-6">{this.state.error?.message || 'An unexpected error occurred in this view.'}</p>
            <button 
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-4 py-2 rounded-xl bg-cyan-400 text-slate-950 font-bold text-xs hover:bg-cyan-300 transition shadow-lg shadow-cyan-400/20"
            >
              Reload Console
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
