import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ROLE_LABELS } from '../lib/types';
import type { UserProfile, UserRole } from '../lib/types';
import { Loader2, Shield, Mail, UserCircle, Check, X } from 'lucide-react';

export function UsersView() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const canManage = user?.role === 'super_admin';

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) { console.error('Failed to load users:', error.message); }
      else { setUsers(data || []); }
      setLoading(false);
    })();
  }, []);

  const updateRole = async (userId: string, role: UserRole) => {
    const { error } = await supabase.from('users').update({ role }).eq('id', userId);
    if (error) { console.error('Failed to update role:', error.message); return; }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  };

  const toggleActive = async (userId: string, active: boolean) => {
    const { error } = await supabase.from('users').update({ active: !active }).eq('id', userId);
    if (error) { console.error('Failed to update user:', error.message); return; }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, active: !active } : u));
  };

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
        <p className="text-slate-500 mt-1">{users.length} users — role-based access control</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                {canManage && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center">
                        <UserCircle className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="text-sm font-medium text-slate-900">{u.full_name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {u.email}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <select value={u.role} onChange={e => updateRole(u.id, e.target.value as UserRole)}
                        className="px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm text-slate-700">
                        <Shield className="w-3.5 h-3.5 text-slate-400" /> {ROLE_LABELS[u.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">
                        <X className="w-3 h-3" /> Inactive
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {u.id !== user?.id && (
                        <button onClick={() => toggleActive(u.id, u.active)}
                          className="text-sm text-slate-500 hover:text-slate-700">
                          {u.active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!canManage && (
        <p className="text-sm text-slate-400 mt-4">Only Super Admins can modify user roles and status.</p>
      )}
    </div>
  );
}
