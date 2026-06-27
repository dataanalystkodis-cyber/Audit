import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Package, CheckCircle2, Clock, TrendingUp,
  DollarSign, Target, BarChart3, Loader2, Warehouse as WarehouseIcon,
} from 'lucide-react';

type DashboardStats = {
  totalProducts: number;
  totalAudited: number;
  pendingProducts: number;
  totalVarianceQty: number;
  totalVarianceValue: number;
  accuracyPct: number;
  warehouseSummary: { warehouse: string; products: number; audited: number; variance: number }[];
  categorySummary: { category: string; products: number; audited: number; variance: number }[];
  auditorPerformance: { auditor: string; counted: number; flagged: number }[];
};

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const [prodRes, auditRes] = await Promise.all([
        supabase.from('products').select('id, category, warehouse_id, system_quantity, unit_price, warehouses(code, name)', { count: 'exact' }),
        supabase.from('audit_details').select('id, status, physical_quantity, system_quantity, variance_quantity, variance_value, unit_price, counted_by, users(full_name)'),
      ]);

      const products = prodRes.data || [];
      const auditDetails = auditRes.data || [];
      const totalProducts = prodRes.count || 0;

      const audited = auditDetails.filter((d: any) => d.status === 'counted' || d.status === 'flagged' || d.status === 'recounted');
      const totalAudited = audited.length;
      const pendingProducts = totalProducts - totalAudited;

      const totalVarianceQty = audited.reduce((s: number, d: any) => s + (d.variance_quantity || 0), 0);
      const totalVarianceValue = audited.reduce((s: number, d: any) => s + parseFloat(d.variance_value || '0'), 0);

      const matched = audited.filter((d: any) => d.variance_quantity === 0).length;
      const accuracyPct = totalAudited > 0 ? Math.round((matched / totalAudited) * 100) : 0;

      // Warehouse summary
      const whMap = new Map<string, { products: number; audited: number; variance: number }>();
      products.forEach((p: any) => {
        const whName = p.warehouses?.name || 'Unassigned';
        if (!whMap.has(whName)) whMap.set(whName, { products: 0, audited: 0, variance: 0 });
        whMap.get(whName)!.products++;
      });
      // Warehouse-level audit detail aggregation would require joining through products
      const warehouseSummary = Array.from(whMap.entries()).map(([warehouse, v]) => ({
        warehouse,
        products: v.products,
        audited: v.audited,
        variance: v.variance,
      }));

      // Category summary
      const catMap = new Map<string, { products: number; audited: number; variance: number }>();
      products.forEach((p: any) => {
        if (!catMap.has(p.category)) catMap.set(p.category, { products: 0, audited: 0, variance: 0 });
        catMap.get(p.category)!.products++;
      });
      const categorySummary = Array.from(catMap.entries())
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.products - a.products);

      // Auditor performance
      const auditorMap = new Map<string, { counted: number; flagged: number }>();
      audited.forEach((d: any) => {
        const name = d.users?.full_name || 'Unknown';
        if (!auditorMap.has(name)) auditorMap.set(name, { counted: 0, flagged: 0 });
        const entry = auditorMap.get(name)!;
        entry.counted++;
        if (d.status === 'flagged') entry.flagged++;
      });
      const auditorPerformance = Array.from(auditorMap.entries())
        .map(([auditor, v]) => ({ auditor, ...v }))
        .sort((a, b) => b.counted - a.counted);

      setStats({
        totalProducts,
        totalAudited,
        pendingProducts,
        totalVarianceQty,
        totalVarianceValue,
        accuracyPct,
        warehouseSummary,
        categorySummary,
        auditorPerformance,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const s = stats!;

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 mt-1">Warehouse inventory audit overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KPICard icon={Package} label="Total Products" value={s.totalProducts.toLocaleString()} color="blue" />
        <KPICard icon={CheckCircle2} label="Audited" value={s.totalAudited.toLocaleString()} color="emerald" />
        <KPICard icon={Clock} label="Pending" value={s.pendingProducts.toLocaleString()} color="amber" />
        <KPICard icon={TrendingUp} label="Variance Qty" value={s.totalVarianceQty > 0 ? `+${s.totalVarianceQty.toLocaleString()}` : s.totalVarianceQty.toLocaleString()} color={s.totalVarianceQty >= 0 ? 'emerald' : 'rose'} />
        <KPICard icon={DollarSign} label="Variance Value" value={`$${Math.abs(s.totalVarianceValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color={s.totalVarianceValue >= 0 ? 'emerald' : 'rose'} />
        <KPICard icon={Target} label="Accuracy" value={`${s.accuracyPct}%`} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Category Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Category Summary</h3>
          </div>
          <div className="space-y-3">
            {s.categorySummary.slice(0, 8).map((c) => (
              <div key={c.category}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-700 font-medium">{c.category}</span>
                  <span className="text-slate-500">{c.products.toLocaleString()} products</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${s.totalProducts > 0 ? (c.products / s.totalProducts) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Auditor Performance */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Auditor Performance</h3>
          </div>
          {s.auditorPerformance.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No audit counts recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {s.auditorPerformance.map((a) => (
                <div key={a.auditor} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{a.auditor}</div>
                    <div className="text-xs text-slate-500">{a.counted} items counted</div>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                      {a.counted - a.flagged} matched
                    </span>
                    {a.flagged > 0 && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-medium rounded-full">
                        {a.flagged} flagged
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Warehouse Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <WarehouseIcon className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Warehouse Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Warehouse</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Products</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Audited</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Variance Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {s.warehouseSummary.map((w) => (
                <tr key={w.warehouse}>
                  <td className="py-3 px-3 text-sm font-medium text-slate-900">{w.warehouse}</td>
                  <td className="py-3 px-3 text-right text-sm text-slate-700">{w.products.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-sm text-slate-700">{w.audited.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-sm text-slate-700">{w.variance.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  icon: Icon, label, value, color,
}: {
  icon: typeof Package; label: string; value: string; color: 'blue' | 'emerald' | 'amber' | 'rose';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]} mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
