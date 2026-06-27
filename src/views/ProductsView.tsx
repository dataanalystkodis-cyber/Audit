import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { Product, Warehouse } from '../lib/types';
import {
  Search, Loader2, Upload, Download, X, FileSpreadsheet, AlertCircle, CheckCircle2,
} from 'lucide-react';

export function ProductsView() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const pageSize = 50;
  const canEdit = user?.role === 'super_admin' || user?.role === 'manager';

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('products')
      .select('*, warehouses(id, code, name, address, created_at)', { count: 'exact' });

    if (search) {
      query = query.or(`product_code.ilike.%${search}%,name.ilike.%${search}%,qr_code.ilike.%${search}%,brand.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('product_code', { ascending: true });

    if (error) {
      console.error('Failed to load products:', error.message);
    } else {
      setProducts(data as Product[]);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [search, page]);

  useEffect(() => {
    supabase.from('warehouses').select('*').then(({ data }) => setWarehouses(data || []));
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setPage(0); }, [search]);

  const totalPages = Math.ceil(total / pageSize);

  const downloadTemplate = () => {
    const headers = ['product_code', 'qr_code', 'name', 'category', 'brand', 'unit', 'zone', 'rack_number', 'bin_number', 'system_quantity', 'unit_price', 'status'];
    const csv = headers.join(',') + '\n' + 'PRD-00001,QR-00001,Sample Product,Electronics,TechCorp,pcs,A,R1,B1,100,29.99,active';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_master_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Product Master</h2>
          <p className="text-slate-500 mt-1">{total.toLocaleString()} products in catalog</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Template
          </button>
          {canEdit && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Upload className="w-4 h-4" />
              Bulk Upload
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product code, name, QR code, or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Brand</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Location</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Sys Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Unit Price</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total Value</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-700">{p.product_code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.category}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{p.brand || '—'}</td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">
                      {p.zone ? `${p.zone}/${p.rack_number}/${p.bin_number}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">{p.system_quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">${p.unit_price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                      ${(p.system_quantity * p.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {showUpload && (
        <BulkUploadModal
          warehouses={warehouses}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); fetchProducts(); }}
        />
      )}
    </div>
  );
}

function BulkUploadModal({
  warehouses, onClose, onUploaded,
}: {
  warehouses: Warehouse[]; onClose: () => void; onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      setResult({ success: 0, errors: ['File must have a header row and at least one data row'] });
      setUploading(false);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: Record<string, any>[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] || null; });

      const wh = warehouses.find(w => w.code === row['warehouse'] || w.name === row['warehouse']);
      rows.push({
        product_code: row['product_code'],
        qr_code: row['qr_code'] || null,
        name: row['name'],
        category: row['category'] || 'Uncategorized',
        brand: row['brand'] || null,
        unit: row['unit'] || 'pcs',
        warehouse_id: wh?.id || null,
        zone: row['zone'] || null,
        rack_number: row['rack_number'] || null,
        bin_number: row['bin_number'] || null,
        system_quantity: parseInt(row['system_quantity']) || 0,
        unit_price: parseFloat(row['unit_price']) || 0,
        status: row['status'] || 'active',
      });
    }

    // Insert in batches of 500
    let success = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase.from('products').upsert(batch, { onConflict: 'product_code', ignoreDuplicates: false });
      if (error) {
        errors.push(`Batch ${Math.floor(i / 500) + 1}: ${error.message}`);
      } else {
        success += batch.length;
      }
    }

    setResult({ success, errors });
    setUploading(false);
    if (errors.length === 0) {
      setTimeout(() => onUploaded(), 1500);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Bulk Upload Products</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-600">
              Upload a CSV file with columns: <span className="font-mono text-xs">product_code, qr_code, name, category, brand, unit, zone, rack_number, bin_number, system_quantity, unit_price, status</span>
            </div>
          </div>
          <div>
            <input
              type="file"
              accept=".csv"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          {result && (
            <div className={`p-4 rounded-lg ${result.errors.length === 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.errors.length === 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
                <span className="font-medium text-sm text-slate-900">
                  {result.success} products uploaded successfully
                </span>
              </div>
              {result.errors.length > 0 && (
                <ul className="text-xs text-rose-600 space-y-1">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
          <button onClick={handleUpload} disabled={!file || uploading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 flex items-center gap-2">
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
