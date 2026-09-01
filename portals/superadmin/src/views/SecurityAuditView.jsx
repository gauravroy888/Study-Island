import React from 'react';

export function SecurityAuditView({ logs, isLogsLoading, onLogIncident, onResolveIncident, onRefreshLogs }) {
      const [categoryFilter, setCategoryFilter] = React.useState('ALL');
      const [filterTerm, setFilterTerm] = React.useState('');

      const filteredLogs = logs.filter(log => {
        const matchesCategory = categoryFilter === 'ALL' || log.category === categoryFilter;
        const matchesSearch = !filterTerm || 
          (log.title || '').toLowerCase().includes(filterTerm.toLowerCase()) ||
          (log.details || '').toLowerCase().includes(filterTerm.toLowerCase()) ||
          (log.actor_email || '').toLowerCase().includes(filterTerm.toLowerCase()) ||
          (log.source || '').toLowerCase().includes(filterTerm.toLowerCase());
        return matchesCategory && matchesSearch;
      });

      return (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <i className="ph ph-shield-check text-cyan-400"></i> Platform Forensic Audit Trail &amp; Access Control
              </h3>
              <p className="text-xs text-slate-400">Live cryptographic access logs and security policy audit stream.</p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search audit records..."
                value={filterTerm}
                onChange={e => setFilterTerm(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400"
              />
              <button onClick={onRefreshLogs} className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5">
                <i className={`ph ph-arrows-clockwise ${isLogsLoading ? 'animate-spin' : ''}`}></i> Refresh
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            {['ALL', 'SECURITY', 'STRUCTURE', 'COPIED_DATA', 'UNAUTHORIZED_ACCESS', 'PERFORMANCE'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  categoryFilter === cat
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
                }`}>
                {cat}
              </button>
            ))}
          </div>

          <div className="glass-panel overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase">
                <tr>
                  <th className="p-4">Severity</th>
                  <th className="p-4">Event Title &amp; Source</th>
                  <th className="p-4">Actor</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Time</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-500 text-xs">
                      No audit records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          log.severity === 'CRITICAL' || log.severity === 'ERROR' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                          log.severity === 'WARNING' || log.severity === 'SECURITY' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                          'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}>
                          {log.severity || 'INFO'}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-white font-sans font-semibold">{log.title}</p>
                        <p className="text-slate-500 text-[10px] font-mono mt-0.5">{log.source} {log.details ? `• ${log.details}` : ''}</p>
                      </td>
                      <td className="p-4 font-bold text-cyan-300">{log.actor_email || 'System Engine'}</td>
                      <td className="p-4 text-purple-300">{log.category || 'SYSTEM'}</td>
                      <td className="p-4 text-slate-400">{(log.created_at || '').slice(0, 19).replace('T', ' ') || 'Just now'}</td>
                      <td className="p-4 text-right">
                        {log.status === 'ACTIVE' ? (
                          <button
                            onClick={() => onResolveIncident(log.id)}
                            className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-emerald-500/20 text-red-400 hover:text-emerald-400 border border-red-500/40 hover:border-emerald-500/40 text-[10px] font-bold transition">
                            Active (Resolve →)
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">RESOLVED</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
