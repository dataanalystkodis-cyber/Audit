import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AuditHeader } from '../lib/types';
import { AUDIT_TYPE_LABELS } from '../lib/types';
import {
  FileBarChart, Download, Loader2, FileText,
} from 'lucide-react';

type ReportType = 'variance' | 'missing' | 'excess' | 'location' | 'product' | 'value' | 'abc' | 'aging';

const REPORT_LABELS: Record<ReportType, string> = {
  variance: 'Inventory Variance Report',
  missing: 'Missing Stock Report',
  excess: 'Excess Stock Report',
  location: 'Location-wise Report',
  product: 'Product-wise Report',
  value: 'Value-wise Report',
  abc: 'ABC Analysis Report',
  aging: 'Aging Report',
};

export function ReportsView() {
  const [audits, setAudits] = useState<AuditHeader[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<string>('');
  const [reportType, setReportType] = useState<ReportType>('variance');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    supabase.from('audit_header').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setAudits(data || []);
    });
  }, []);

  const runReport = async () => {
    if (!selectedAudit) return;
    setLoading(true);
    setHasRun(true);

    const { data: details } = await supabase
      .from('audit_details')
      .select('*, products(*)')
      .eq('audit_id', selectedAudit);

    if (!details) { setLoading(false); return; }

    let reportData: any[] = [];

    switch (reportType) {
      case 'variance':
        reportData = details.filter(d => d.physical_quantity !== null).map(d => ({
          product_code: d.product?.product_code,
          name: d.product?.name,
          category: d.product?.category,
          system_qty: d.system_quantity,
          physical_qty: d.physical_quantity,
          variance_qty: d.variance_quantity,
          unit_price: parseFloat(d.unit_price),
          variance_value: parseFloat(d.variance_value || '0'),
          status: d.status,
        }));
        break;
      case 'missing':
        reportData = details.filter(d => d.variance_quantity !== null && d.variance_quantity < 0).map(d => ({
          product_code: d.product?.product_code,
          name: d.product?.name,
          system_qty: d.system_quantity,
          physical_qty: d.physical_quantity,
          shortage: Math.abs(d.variance_quantity || 0),
          unit_price: parseFloat(d.unit_price),
          shortage_value: Math.abs(parseFloat(d.variance_value || '0')),
        }));
        break;
      case 'excess':
        reportData = details.filter(d => d.variance_quantity !== null && d.variance_quantity > 0).map(d => ({
          product_code: d.product?.product_code,
          name: d.product?.name,
          system_qty: d.system_quantity,
          physical_qty: d.physical_quantity,
          excess: d.variance_quantity || 0,
          unit_price: parseFloat(d.unit_price),
          excess_value: parseFloat(d.variance_value || '0'),
        }));
        break;
      case 'location':
        const locMap = new Map<string, { products: number; audited: number; variance_qty: number; variance_value: number }>();
        details.forEach(d => {
          const loc = d.product ? `${d.product.zone}/${d.product.rack_number}/${d.product.bin_number}` : 'Unknown';
          if (!locMap.has(loc)) locMap.set(loc, { products: 0, audited: 0, variance_qty: 0, variance_value: 0 });
          const e = locMap.get(loc)!;
          e.products++;
          if (d.physical_quantity !== null) { e.audited++; e.variance_qty += d.variance_quantity || 0; e.variance_value += parseFloat(d.variance_value || '0'); }
        });
        reportData = Array.from(locMap.entries()).map(([location, v]) => ({ location, ...v }));
        break;
      case 'product':
        reportData = details.map(d => ({
          product_code: d.product?.product_code,
          name: d.product?.name,
          category: d.product?.category,
          brand: d.product?.brand,
          system_qty: d.system_quantity,
          physical_qty: d.physical_quantity,
          variance_qty: d.variance_quantity,
          unit_price: parseFloat(d.unit_price),
          status: d.status,
        }));
        break;
      case 'value':
        reportData = details.filter(d => d.physical_quantity !== null).map(d => ({
          product_code: d.product?.product_code,
          name: d.product?.name,
          system_value: d.system_quantity * parseFloat(d.unit_price),
          physical_value: (d.physical_quantity || 0) * parseFloat(d.unit_price),
          variance_value: parseFloat(d.variance_value || '0'),
        })).sort((a, b) => Math.abs(b.variance_value) - Math.abs(a.variance_value));
        break;
      case 'abc':
        const allProducts = await supabase.from('products').select('product_code, name, system_quantity, unit_price, category');
        const productValues = (allProducts.data || []).map((p: any) => ({
          product_code: p.product_code,
          name: p.name,
          category: p.category,
          total_value: p.system_quantity * parseFloat(p.unit_price),
        })).sort((a, b) => b.total_value - a.total_value);
        const totalValue = productValues.reduce((s, p) => s + p.total_value, 0);
        let cumPct = 0;
        reportData = productValues.map(p => {
          cumPct += (p.total_value / totalValue) * 100;
          return { ...p, cumulative_pct: cumPct, abc_class: cumPct <= 80 ? 'A' : cumPct <= 95 ? 'B' : 'C' };
        });
        break;
      case 'aging':
        const agingProducts = await supabase.from('products').select('product_code, name, system_quantity, unit_price, created_at');
        reportData = (agingProducts.data || []).map((p: any) => {
          const ageDays = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
          return {
            product_code: p.product_code,
            name: p.name,
            system_qty: p.system_quantity,
            unit_price: parseFloat(p.unit_price),
            total_value: p.system_quantity * parseFloat(p.unit_price),
            age_days: ageDays,
            age_bucket: ageDays > 365 ? '1+ year' : ageDays > 180 ? '6-12 months' : ageDays > 90 ? '3-6 months' : '< 3 months',
          };
        }).sort((a, b) => b.age_days - a.age_days);
        break;
    }

    setData(reportData);
    setLoading(false);
  };

  const exportCSV = () => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'number') return val.toFixed(2).replace(/\.00$/, '');
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Reports</h2>
        <p className="text-slate-500 mt-1">Generate and export audit reports</p>
      </div>

      {/* Report config */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(REPORT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Audit Session</label>
            <select value={selectedAudit} onChange={e => setSelectedAudit(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select an audit...</option>
              {audits.map(a => <option key={a.id} value={a.id}>{a.audit_name} ({AUDIT_TYPE_LABELS[a.audit_type]})</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={runReport} disabled={!selectedAudit || loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileBarChart className="w-4 h-4" />}
              Generate
            </button>
            {data.length > 0 && (
              <button onClick={exportCSV} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2">
                <Download className="w-4 h-4" /> CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Report data */}
      {hasRun && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <FileText className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No data for this report. Run the report after audit counts are entered.</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 text-sm">{REPORT_LABELS[reportType]}</h3>
                <span className="text-sm text-slate-500">{data.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {columns.map(col => (
                        <th key={col} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.slice(0, 200).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {columns.map(col => {
                          const val = row[col];
                          const isNum = typeof val === 'number';
                          return (
                            <td key={col} className={`px-4 py-3 text-sm ${isNum ? 'text-right font-mono' : 'text-slate-700'}`}>
                              {isNum ? (col.includes('value') || col.includes('price') ? `$${val.toFixed(2)}` : col.includes('pct') ? `${val.toFixed(1)}%` : val.toLocaleString()) : (val || '—')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.length > 200 && (
                <div className="px-4 py-3 border-t border-slate-200 text-sm text-slate-500 text-center">
                  Showing first 200 of {data.length} records. Export to CSV for full data.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
