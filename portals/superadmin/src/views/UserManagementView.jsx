import React from 'react';
import { StatBox } from '../components/SharedComponents.jsx';

export function UserManagementView({ users, searchTerm, onRoleChange, onStatusToggle, onImpersonate }) {
      const term = (searchTerm || '').toLowerCase();
      const safeUsers = Array.isArray(users) ? users : [];
      const filtered = safeUsers.filter(u => 
        (u?.name || '').toLowerCase().includes(term) || 
        (u?.email || '').toLowerCase().includes(term) ||
        (u?.org || '').toLowerCase().includes(term)
      );

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatBox label="Total Users" value={safeUsers.length} icon="ph-users-three" color="text-cyan-400" />
            <StatBox label="Active Admins" value={safeUsers.filter(u => u?.role === 'ADMIN' || u?.role === 'SUPER_ADMIN').length} icon="ph-shield-check" color="text-purple-400" />
            <StatBox label="Teachers" value={safeUsers.filter(u => u?.role === 'TEACHER').length} icon="ph-chalkboard-teacher" color="text-blue-400" />
            <StatBox label="Students" value={safeUsers.filter(u => u?.role === 'STUDENT').length} icon="ph-student" color="text-emerald-400" />
          </div>

          <div className="glass-panel p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-white text-base">Global User & Role Management</h3>
                <p className="text-xs text-slate-400">Promote/demote user permissions, launch impersonation sessions, or ban violators.</p>
              </div>
              <button onClick={() => alert("CSV Upload Modal: Upload CSV file containing user emails and roles.")} className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs flex items-center gap-2">
                <i className="ph ph-file-csv text-base text-cyan-400"></i> Bulk CSV User Upload
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-mono uppercase">
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Role Level</th>
                    <th className="p-3.5">Institution</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Joined</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filtered.map(u => {
                    const displayName = u?.name || u?.email || 'User';
                    const initials = displayName.slice(0, 2).toUpperCase();
                    return (
                      <tr key={u.id || u.email} className="hover:bg-slate-800/30 transition">
                        <td className="p-3.5 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs">
                            {initials}
                          </div>
                          <div>
                            <p className="text-white font-bold">{displayName}</p>
                            <p className="text-slate-400 text-[11px] font-mono">{u?.email || '—'}</p>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <select 
                            value={u?.role || 'STUDENT'}
                            onChange={(e) => onRoleChange(u.id, e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-bold focus:border-cyan-400"
                          >
                            <option value="SUPER_ADMIN">⚡ SUPER_ADMIN</option>
                            <option value="ADMIN">🛡️ ADMIN</option>
                            <option value="TEACHER">🎓 TEACHER</option>
                            <option value="STUDENT">📖 STUDENT</option>
                          </select>
                        </td>
                        <td className="p-3.5">
                          <p className="text-slate-200 font-semibold">{u?.org || '—'}</p>
                          {u?.institution_id && (
                            <p className="text-slate-500 font-mono text-[10px]">{u.institution_id}</p>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u?.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'
                          }`}>
                            {u?.status || 'Active'}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400 font-mono text-[11px]">{u?.joined || '—'}</td>
                        <td className="p-3.5 text-right space-x-2">
                          <button onClick={() => onImpersonate(u)} className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-[11px]">
                            <i className="ph ph-eye"></i> Impersonate
                          </button>
                          <button onClick={() => onStatusToggle(u.id)} className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${u?.status === 'Active' ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400' : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400'}`}>
                            {u?.status === 'Active' ? 'Suspend' : 'Unsuspend'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
