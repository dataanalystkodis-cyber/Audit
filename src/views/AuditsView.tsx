import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { logAction, createNotification, AUDIT_TYPE_LABELS, AUDIT_STATUS_LABELS, AUDIT_STATUS_COLORS } from '../lib/types';
import type { AuditHeader, AuditType, UserProfile, Warehouse, AuditDetail } from '../lib/types';
import {
  ClipboardCheck, Plus, X, Loader2, ChevronRight, User, FileText,
  Clock, Play, Send, Eye, Check, Lock,
} from 'lucide-react';

export function AuditsView({ onSelectAudit: _onSelectAudit }: { onSelectAudit: (a: AuditHeader) => void }) {
  const { user } = useAuth();
  const [audits, setAudits] = useState<AuditHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<AuditHeader | null>(null);

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_header')
      .select('*, assigned_user:users!assigned_to(*), created_by_user:users!created_by(*), warehouses(*)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load audits:', error.message);
    } else {
      setAudits(data as AuditHeader[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAudits(); }, [fetchAudits]);

  if (selectedAudit) {
    return <AuditDetail audit={selectedAudit} onBack={() => { setSelectedAudit(null); fetchAudits(); }} />;
  }

  const canCreate = user?.role === 'super_admin' || user?.role === 'manager';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Audits</h2>
          <p className="text-slate-500 mt-1">{audits.length} audit sessions</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Audit
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
      ) : audits.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <ClipboardCheck className="w-12 h-12 text-slate-300 mb-4" />
          <p className="text-slate-500">No audits yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {audits.map(audit => (
            <button key={audit.id} onClick={() => setSelectedAudit(audit)}
              className="w-full flex items-center justify-between px-5 py-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all text-left">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900">{audit.audit_name}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span>{AUDIT_TYPE_LABELS[audit.audit_type]}</span>
                    <span>•</span>
                    <span>{audit.assigned_user?.full_name || 'Unassigned'}</span>
                    <span>•</span>
                    <span>{new Date(audit.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${AUDIT_STATUS_COLORS[audit.status]}`}>
                  {AUDIT_STATUS_LABELS[audit.status]}
                </span>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && <CreateAuditModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchAudits(); }} />}
    </div>
  );
}

function CreateAuditModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<AuditType>('full');
  const [assignee, setAssignee] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [auditors, setAuditors] = useState<UserProfile[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase.from('users').select('*').eq('active', true).then(({ data }) => setAuditors(data || []));
    supabase.from('warehouses').select('*').then(({ data }) => setWarehouses(data || []));
    supabase.from('products').select('category').then(({ data }) => {
      const cats = Array.from(new Set((data || []).map((p: any) => p.category))).sort();
      setCategories(cats);
    });
    supabase.from('products').select('zone').not('zone', 'is', null).then(({ data }) => {
      const zs = Array.from(new Set((data || []).map((p: any) => p.zone).filter(Boolean))).sort();
      setZones(zs);
    });
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setCreating(true);

    const filterCriteria: any = {};
    if (filterZone) filterCriteria.zone = filterZone;
    if (filterCategory) filterCriteria.category = filterCategory;

    const { data: audit, error } = await supabase.from('audit_header').insert({
      audit_name: name,
      audit_type: type,
      status: assignee ? 'assigned' : 'draft',
      assigned_to: assignee || null,
      warehouse_id: warehouseId || null,
      filter_criteria: Object.keys(filterCriteria).length > 0 ? filterCriteria : null,
      created_by: user.id,
      assigned_at: assignee ? new Date().toISOString() : null,
    }).select('*').single();

    if (error || !audit) {
      console.error('Failed to create audit:', error?.message);
      setCreating(false);
      return;
    }

    // Build product query based on audit type and filters
    let query = supabase.from('products').select('id, system_quantity, unit_price');
    if (type === 'location' || filterZone) query = query.eq('zone', filterZone);
    if (type === 'category' || filterCategory) query = query.eq('category', filterCategory);
    if (warehouseId) query = query.eq('warehouse_id', warehouseId);

    let products = await query;
    if (type === 'random' && products.data) {
      // Sample 10% of products for random audit
      const sampleSize = Math.max(50, Math.floor(products.data.length * 0.1));
      products.data = products.data.sort(() => Math.random() - 0.5).slice(0, sampleSize);
    }

    if (products.data && products.data.length > 0) {
      const details = products.data.map((p: any) => ({
        audit_id: audit.id,
        product_id: p.id,
        system_quantity: p.system_quantity,
        unit_price: p.unit_price,
        status: 'pending',
      }));
      // Insert in batches
      for (let i = 0; i < details.length; i += 500) {
        await supabase.from('audit_details').insert(details.slice(i, i + 500));
      }
    }

    await logAction(audit.id, user.id, 'created', 'audit', audit.id, { audit_name: name, audit_type: type });

    if (assignee) {
      await createNotification(assignee, audit.id, 'audit_assigned', 'Audit Assigned', `You have been assigned to: ${name}`);
      await logAction(audit.id, user.id, 'assigned', 'audit', audit.id, { assigned_to: assignee });
    }

    setCreating(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-900">Create New Audit</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Audit Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. June 2026 Full Audit"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Audit Type</label>
            <select value={type} onChange={e => setType(e.target.value as AuditType)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(AUDIT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Assign To (Auditor)</label>
            <select value={assignee} onChange={e => setAssignee(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Unassigned</option>
              {auditors.map(a => <option key={a.id} value={a.id}>{a.full_name} ({a.role})</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Warehouse</label>
            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Warehouses</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
          </div>
          {(type === 'location' || type === 'full') && (
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Filter by Zone (optional)</label>
              <select value={filterZone} onChange={e => setFilterZone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Zones</option>
                {zones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          )}
          {(type === 'category' || type === 'full') && (
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Filter by Category (optional)</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {type === 'random' && (
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-slate-600">
              Random audit will sample ~10% of products (minimum 50).
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
          <button onClick={handleCreate} disabled={!name.trim() || creating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 flex items-center gap-2">
            {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create Audit
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditDetail({ audit, onBack }: { audit: AuditHeader; onBack: () => void }) {
  const { user } = useAuth();
  const [details, setDetails] = useState<AuditDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [tab, setTab] = useState<'items' | 'workflow' | 'logs'>('items');
  const [page] = useState(0);
  const pageSize = 50;

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_details')
      .select('*, products(*)')
      .eq('audit_id', audit.id)
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Failed to load details:', error.message);
    } else {
      setDetails(data as AuditDetail[]);
    }
    setLoading(false);
  }, [audit.id, page]);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from('audit_log')
      .select('*, users(full_name)')
      .eq('audit_id', audit.id)
      .order('created_at', { ascending: false });
    setLogs(data || []);
  }, [audit.id]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);
  useEffect(() => { if (tab === 'logs') fetchLogs(); }, [tab, fetchLogs]);

  const stats = {
    total: details.length,
    counted: details.filter(d => d.status === 'counted' || d.status === 'flagged' || d.status === 'recounted').length,
    pending: details.filter(d => d.status === 'pending').length,
    flagged: details.filter(d => d.status === 'flagged').length,
  };

  const canManage = user?.role === 'super_admin' || user?.role === 'manager';
  const isAssignee = audit.assigned_to === user?.id;

  const updateStatus = async (newStatus: AuditHeader['status'], action: string) => {
    if (!user) return;
    const updates: any = { status: newStatus };
    const now = new Date().toISOString();
    if (newStatus === 'assigned') updates.assigned_at = now;
    if (newStatus === 'in_progress') updates.started_at = now;
    if (newStatus === 'submitted') updates.submitted_at = now;
    if (newStatus === 'reviewed') updates.reviewed_at = now;
    if (newStatus === 'approved') updates.approved_at = now;
    if (newStatus === 'closed') updates.closed_at = now;

    const { error } = await supabase.from('audit_header').update(updates).eq('id', audit.id);
    if (error) { console.error('Failed to update audit:', error.message); return; }

    await logAction(audit.id, user.id, action, 'audit', audit.id);

    // Notifications
    if (newStatus === 'submitted' && audit.created_by) {
      await createNotification(audit.created_by, audit.id, 'audit_submitted', 'Audit Submitted', `${audit.audit_name} has been submitted for review`);
    }
    if (newStatus === 'approved' && audit.assigned_to) {
      await createNotification(audit.assigned_to, audit.id, 'audit_approved', 'Audit Approved', `${audit.audit_name} has been approved`);
    }

    onBack();
  };

  const workflowSteps = [
    { status: 'draft', label: 'Created', icon: FileText },
    { status: 'assigned', label: 'Assigned', icon: User },
    { status: 'in_progress', label: 'In Progress', icon: Play },
    { status: 'submitted', label: 'Submitted', icon: Send },
    { status: 'reviewed', label: 'Reviewed', icon: Eye },
    { status: 'approved', label: 'Approved', icon: Check },
    { status: 'closed', label: 'Closed', icon: Lock },
  ];
  const currentStepIdx = workflowSteps.findIndex(s => s.status === audit.status);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{audit.audit_name}</h2>
          <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
            <span>{AUDIT_TYPE_LABELS[audit.audit_type]}</span>
            <span>•</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${AUDIT_STATUS_COLORS[audit.status]}`}>
              {AUDIT_STATUS_LABELS[audit.status]}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{stats.total.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Total Items</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-emerald-600">{stats.counted.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Counted</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-amber-600">{stats.pending.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Pending</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-rose-600">{stats.flagged.toLocaleString()}</div>
          <div className="text-xs text-slate-500">Flagged</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['items', 'workflow', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg capitalize ${tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {t === 'items' ? 'Audit Items' : t === 'workflow' ? 'Workflow' : 'Audit Log'}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Code</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Product</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">System</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Physical</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Variance</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Var. Value</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {details.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{d.product?.product_code}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{d.product?.name}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{d.system_quantity.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">{d.physical_quantity ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {d.variance_quantity === null ? <span className="text-slate-400">—</span> :
                         d.variance_quantity === 0 ? <span className="text-emerald-600">0</span> :
                         <span className={d.variance_quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                           {d.variance_quantity > 0 ? '+' : ''}{d.variance_quantity}
                         </span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">
                        {d.variance_value !== null ? `${Number(d.variance_value).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          d.status === 'counted' ? 'bg-emerald-100 text-emerald-700' :
                          d.status === 'flagged' ? 'bg-rose-100 text-rose-700' :
                          d.status === 'recount_requested' ? 'bg-purple-100 text-purple-700' :
                          d.status === 'recounted' ? 'bg-cyan-100 text-cyan-700' : 'bg-amber-100 text-amber-700'
                        }`}>{d.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'workflow' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-6">Audit Workflow</h3>
          <div className="space-y-1">
            {workflowSteps.map((step, idx) => {
              const Icon = step.icon;
              const done = idx < currentStepIdx;
              const current = idx === currentStepIdx;
              return (
                <div key={step.status} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    done ? 'bg-emerald-500 text-white' : current ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${done || current ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</div>
                  </div>
                  {idx < workflowSteps.length - 1 && <div className={`w-0.5 h-8 ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="mt-8 space-y-2">
            {audit.status === 'draft' && canManage && (
              <button onClick={() => updateStatus('assigned', 'assigned')} className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
                <User className="w-4 h-4" /> Assign Audit
              </button>
            )}
            {audit.status === 'assigned' && isAssignee && (
              <button onClick={() => updateStatus('in_progress', 'started')} className="w-full px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 flex items-center justify-center gap-2">
                <Play className="w-4 h-4" /> Start Scanning
              </button>
            )}
            {audit.status === 'in_progress' && isAssignee && (
              <button onClick={() => updateStatus('submitted', 'submitted')} className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Submit for Review
              </button>
            )}
            {audit.status === 'submitted' && canManage && (
              <>
                <button onClick={() => updateStatus('reviewed', 'reviewed')} className="w-full px-4 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 flex items-center justify-center gap-2">
                  <Eye className="w-4 h-4" /> Mark as Reviewed
                </button>
                <button onClick={() => updateStatus('approved', 'approved')} className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Approve Audit
                </button>
              </>
            )}
            {audit.status === 'reviewed' && canManage && (
              <button onClick={() => updateStatus('approved', 'approved')} className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Approve Audit
              </button>
            )}
            {audit.status === 'approved' && canManage && (
              <button onClick={() => updateStatus('closed', 'closed')} className="w-full px-4 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 flex items-center justify-center gap-2">
                <Lock className="w-4 h-4" /> Close Audit
              </button>
            )}
            {audit.status === 'closed' && (
              <div className="text-center text-sm text-slate-500 py-4">This audit is closed.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Clock className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No activity logged yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map(log => (
                <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-slate-900">
                      <span className="font-medium">{log.users?.full_name || 'System'}</span>
                      <span className="text-slate-500"> — {log.action.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
