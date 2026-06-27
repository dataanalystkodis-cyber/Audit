import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { logAction, createNotification } from '../lib/types';
import type { AuditHeader, AuditDetail, Product } from '../lib/types';
import {
  ScanLine, Camera, CameraOff, X, CheckCircle2, AlertTriangle, Loader2,
  Package, MapPin, Hash, Keyboard, SwitchCamera, Clock, History, DollarSign,
} from 'lucide-react';

type ScanStatus = 'idle' | 'starting' | 'scanning' | 'denied' | 'error' | 'notfound' | 'duplicate';

type ScanRecord = {
  code: string;
  product: Product | null;
  detail: AuditDetail | null;
  timestamp: number;
  status: 'found' | 'notfound' | 'duplicate';
};

export function ScannerView({ activeAudit }: { activeAudit: AuditHeader | null }) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<any>(null);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentScan, setCurrentScan] = useState<ScanRecord | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [physicalQty, setPhysicalQty] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const stopCamera = useCallback(() => {
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch {}
      controlsRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  }, []);

  const lookupByCode = useCallback(async (code: string): Promise<ScanRecord> => {
    const trimmed = code.trim();
    // Try QR code first, then product_code
    let { data: product, error } = await supabase
      .from('products')
      .select('*, warehouses(id, code, name, address, created_at)')
      .or(`qr_code.eq.${trimmed},product_code.eq.${trimmed}`)
      .maybeSingle();

    if (error || !product) {
      return { code: trimmed, product: null, detail: null, timestamp: Date.now(), status: 'notfound' };
    }

    if (!activeAudit) {
      return { code: trimmed, product: product as Product, detail: null, timestamp: Date.now(), status: 'found' };
    }

    const { data: detail } = await supabase
      .from('audit_details')
      .select('*')
      .eq('audit_id', activeAudit.id)
      .eq('product_id', product.id)
      .maybeSingle();

    return {
      code: trimmed,
      product: product as Product,
      detail: detail as AuditDetail,
      timestamp: Date.now(),
      status: 'found',
    };
  }, [activeAudit]);

  const handleScan = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const now = Date.now();
    if (lastScanRef.current.code === trimmed && now - lastScanRef.current.time < 3000) return;
    lastScanRef.current = { code: trimmed, time: now };

    setStatus('scanning');
    const result = await lookupByCode(trimmed);
    setCurrentScan(result);
    setPhysicalQty('');
    setNote('');

    if (result.product && activeAudit && result.detail) {
      // Duplicate scan control
      if (result.detail.scan_count > 0 && result.detail.status !== 'recount_requested') {
        result.status = 'duplicate';
        setStatus('duplicate');
      } else {
        setScanHistory(prev => [result, ...prev].slice(0, 50));
      }
    } else if (result.product) {
      setScanHistory(prev => [result, ...prev].slice(0, 50));
    } else {
      setStatus('notfound');
    }
  }, [lookupByCode, activeAudit]);

  const startCamera = useCallback(async () => {
    if (!activeAudit) return;
    setStatus('starting');
    setErrorMsg('');
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const codeReader = new BrowserMultiFormatReader();
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = mediaDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);

      const constraints: MediaStreamConstraints = { video: { facingMode: { ideal: 'environment' } }, audio: false };

      const zxing = await import('@zxing/library');
      const hints = new Map();
      hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
        zxing.BarcodeFormat.QR_CODE, zxing.BarcodeFormat.EAN_13, zxing.BarcodeFormat.EAN_8,
        zxing.BarcodeFormat.CODE_128, zxing.BarcodeFormat.CODE_39, zxing.BarcodeFormat.UPC_A,
        zxing.BarcodeFormat.UPC_E, zxing.BarcodeFormat.ITF, zxing.BarcodeFormat.CODABAR,
      ]);
      codeReader.hints = hints;

      const controls = codeReader.decodeFromConstraints(constraints, videoRef.current || undefined, (result: any) => {
        if (result) handleScan(result.getText());
      });
      controlsRef.current = controls;
      setStatus('scanning');
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setStatus('denied');
        setErrorMsg('Camera access denied. Allow camera permissions in your browser settings.');
      } else {
        setStatus('error');
        setErrorMsg(err?.message || 'Failed to start camera. Use HTTPS or localhost.');
      }
    }
  }, [activeAudit, deviceIndex, handleScan]);

  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  const switchCamera = () => {
    setDeviceIndex(i => (i + 1) % Math.max(devices.length, 1));
    stopCamera();
    setTimeout(() => startCamera(), 100);
  };

  const saveCount = async () => {
    if (!currentScan?.product || !activeAudit || !user) return;
    const qty = parseInt(physicalQty, 10);
    if (isNaN(qty) || qty < 0) return;

    setSaving(true);
    const product = currentScan.product;
    const sysQty = currentScan.detail?.system_quantity ?? product.system_quantity;
    const varianceQty = qty - sysQty;
    const varianceValue = varianceQty * product.unit_price;
    const newStatus = varianceQty === 0 ? 'counted' : 'flagged';

    if (currentScan.detail) {
      const { error } = await supabase.from('audit_details').update({
        physical_quantity: qty,
        variance_quantity: varianceQty,
        variance_value: varianceValue,
        status: newStatus,
        scanned: true,
        scan_count: (currentScan.detail.scan_count || 0) + 1,
        note: note || null,
        counted_by: user.id,
        counted_at: new Date().toISOString(),
      }).eq('id', currentScan.detail.id);

      if (error) {
        console.error('Failed to save count:', error.message);
        setSaving(false);
        return;
      }
    }

    await logAction(activeAudit.id, user.id, 'scanned', 'audit_detail', currentScan.detail?.id, {
      product_code: product.product_code,
      physical_quantity: qty,
      variance_quantity: varianceQty,
    });

    // Large variance notification
    if (product.system_quantity > 0) {
      const variancePct = Math.abs(varianceQty / product.system_quantity) * 100;
      if (variancePct > 10) {
        const { data: managers } = await supabase.from('users').select('id').in('role', ['manager', 'super_admin']);
        if (managers) {
          for (const m of managers) {
            await createNotification(m.id, activeAudit.id, 'large_variance',
              'Large Variance Detected',
              `${product.name} (${product.product_code}): ${variancePct.toFixed(1)}% variance — ${varianceQty > 0 ? '+' : ''}${varianceQty} units`);
          }
        }
      }
    }

    setScanHistory(prev => prev.map(s =>
      s.code === currentScan.code && s.product?.id === product.id
        ? { ...s, detail: { ...(s.detail as AuditDetail), physical_quantity: qty, variance_quantity: varianceQty, status: newStatus as any, scan_count: (s.detail?.scan_count || 0) + 1 } }
        : s
    ));

    setCurrentScan(null);
    setPhysicalQty('');
    setNote('');
    setSaving(false);
    setStatus('scanning');
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setShowManual(false);
    const code = manualCode.trim();
    setManualCode('');
    await handleScan(code);
  };

  if (!activeAudit) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <ScanLine className="w-12 h-12 text-slate-300 mb-4" />
        <p className="text-slate-500">Select an active audit from the Audits tab to start scanning.</p>
      </div>
    );
  }

  const variance = currentScan && physicalQty !== ''
    ? parseInt(physicalQty, 10) - (currentScan.detail?.system_quantity ?? currentScan.product?.system_quantity ?? 0)
    : null;
  const varianceVal = variance !== null && currentScan?.product ? variance * currentScan.product.unit_price : null;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">QR Scanner</h2>
        <p className="text-slate-500 mt-1">{activeAudit.audit_name} — Scan product QR codes to count</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner panel */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="relative aspect-square bg-slate-900 flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

            {status === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                <Camera className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-sm mb-6">Camera is off</p>
                <button onClick={startCamera} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 flex items-center gap-2">
                  <Camera className="w-5 h-5" /> Start Camera
                </button>
              </div>
            )}

            {status === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-3" />
                <p className="text-sm">Starting camera...</p>
              </div>
            )}

            {(status === 'denied' || status === 'error') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <CameraOff className="w-12 h-12 text-rose-400 mb-3" />
                <p className="text-sm text-rose-300 mb-2">{status === 'denied' ? 'Camera Access Denied' : 'Camera Error'}</p>
                <p className="text-xs text-slate-500 max-w-xs mb-4">{errorMsg}</p>
                <button onClick={startCamera} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600">Try Again</button>
              </div>
            )}

            {(status === 'scanning' || status === 'notfound' || status === 'duplicate') && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-64 h-64">
                    <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                    <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-blue-400/60 animate-pulse" />
                  </div>
                </div>
                {status === 'notfound' && currentScan && (
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                    <div className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> No product for "{currentScan.code}"
                    </div>
                  </div>
                )}
                {status === 'duplicate' && (
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                    <div className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Already scanned — recount needs manager approval
                    </div>
                  </div>
                )}
              </div>
            )}

            {(status === 'scanning' || status === 'notfound' || status === 'duplicate') && (
              <div className="absolute top-3 right-3 flex gap-2">
                {devices.length > 1 && (
                  <button onClick={switchCamera} className="p-2 bg-slate-800/80 text-white rounded-lg hover:bg-slate-700">
                    <SwitchCamera className="w-5 h-5" />
                  </button>
                )}
                <button onClick={stopCamera} className="p-2 bg-slate-800/80 text-white rounded-lg hover:bg-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          <div className="p-4 flex gap-3">
            {status === 'idle' || status === 'denied' || status === 'error' ? (
              <button onClick={startCamera} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
                <Camera className="w-4 h-4" /> Start Camera
              </button>
            ) : (
              <button onClick={stopCamera} className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 flex items-center justify-center gap-2">
                <CameraOff className="w-4 h-4" /> Stop Camera
              </button>
            )}
            <button onClick={() => setShowManual(!showManual)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 ${showManual ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Keyboard className="w-4 h-4" /> Manual
            </button>
          </div>

          {showManual && (
            <form onSubmit={handleManualSubmit} className="px-4 pb-4">
              <div className="flex gap-2">
                <input type="text" value={manualCode} onChange={e => setManualCode(e.target.value)}
                  placeholder="Enter QR code or product code..." autoFocus
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Search</button>
              </div>
            </form>
          )}
        </div>

        {/* Right panel: scan result + history */}
        <div className="space-y-4">
          {/* Current scan result */}
          {currentScan && currentScan.product && status !== 'duplicate' && (
            <div className="bg-white rounded-xl border-2 border-blue-500 overflow-hidden shadow-lg">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold text-sm">Product Found</span>
                </div>
                <button onClick={() => { setCurrentScan(null); setStatus('scanning'); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm">{currentScan.product.name}</div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span className="font-mono flex items-center gap-1"><Hash className="w-3 h-3" />{currentScan.product.product_code}</span>
                      <span>{currentScan.product.category}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="font-mono">{currentScan.product.zone}/{currentScan.product.rack_number}/{currentScan.product.bin_number}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    <span>${currentScan.product.unit_price.toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">System Quantity</div>
                    <div className="px-3 py-2 bg-slate-50 rounded-lg text-slate-900 font-medium text-sm">
                      {(currentScan.detail?.system_quantity ?? currentScan.product.system_quantity).toLocaleString()} {currentScan.product.unit}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Physical Quantity</label>
                    <input type="number" min="0" value={physicalQty} onChange={e => setPhysicalQty(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveCount()} autoFocus
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                {variance !== null && (
                  <div className={`px-3 py-2.5 rounded-lg flex items-center justify-between ${
                    variance === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    <div className="flex items-center gap-2">
                      {variance === 0 ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      <span className="text-sm font-medium">
                        {variance === 0 ? 'Match' : `Variance: ${variance > 0 ? '+' : ''}${variance} ${currentScan.product.unit}`}
                      </span>
                    </div>
                    {varianceVal !== null && variance !== 0 && (
                      <span className="text-sm font-medium">${varianceVal.toFixed(2)}</span>
                    )}
                  </div>
                )}

                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

                <div className="flex gap-2">
                  <button onClick={() => { setCurrentScan(null); setStatus('scanning'); }}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Skip</button>
                  <button onClick={saveCount} disabled={physicalQty === '' || saving}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Count
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Scan history */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h3 className="font-semibold text-slate-900 text-sm">Scan History</h3>
              <span className="text-xs text-slate-500 ml-auto">{scanHistory.length} scans</span>
            </div>
            {scanHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ScanLine className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">No scans yet. Start the camera and scan a QR code.</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {scanHistory.map((scan, idx) => {
                  const detail = scan.detail;
                  const variance = detail?.variance_quantity;
                  return (
                    <div key={idx} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        detail?.status === 'counted' ? 'bg-emerald-50 text-emerald-600' :
                        detail?.status === 'flagged' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {detail?.status === 'counted' ? <CheckCircle2 className="w-4 h-4" /> :
                         detail?.status === 'flagged' ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{scan.product?.name || `Unknown: ${scan.code}`}</div>
                        <div className="text-xs text-slate-500 font-mono">{scan.product?.product_code || scan.code}</div>
                      </div>
                      {detail && (
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-medium text-slate-900">{detail.physical_quantity ?? '—'}</div>
                          {variance !== null && variance !== undefined && (
                            <div className={`text-xs font-medium ${variance === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {variance > 0 ? '+' : ''}{variance}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
