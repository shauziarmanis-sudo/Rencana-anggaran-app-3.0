'use client';

import React, { useState } from 'react';
import { useSelectedPIStore } from '@/store/useSelectedPI';
import { X, Upload, FileText, CheckCircle2, AlertTriangle, Loader2, ClipboardPaste } from 'lucide-react';

interface BulkUploadModalProps {
  onClose: () => void;
}

export default function BulkUploadModal({ onClose }: BulkUploadModalProps) {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ matched: string[]; notFound: string[]; matchedIds: string[]; matchedItems?: any[] } | null>(null);
  const { selectAll, selectedIds, setCompany } = useSelectedPIStore();

  const handleParse = async () => {
    if (!inputText.trim()) return;

    setLoading(true);
    try {
      // Parse CSV / tab-separated / newline-separated input
      const lines = inputText.trim().split(/[\n\r]+/).filter(l => l.trim());
      const piList = lines.map(line => {
        const parts = line.split(/[,\t;|]+/).map(p => p.trim());
        return {
          noPi: parts[0] || '',
          vendorName: parts[1] || '',
          company: parts[2] || '',
        };
      }).filter(p => p.noPi);

      const res = await fetch('/api/invoice/bulk-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piList }),
      });
      const json = await res.json();

      if (json.success) {
        setResult({
          matched: json.data.matched,
          notFound: json.data.notFound,
          matchedIds: json.data.matchedIds,
          matchedItems: json.data.matchedItems,
        });
      } else {
        alert(json.error || 'Gagal memproses data');
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memproses data bulk');
    } finally {
      setLoading(false);
    }
  };

  const handleApplySelection = () => {
    if (result && result.matchedIds.length > 0) {
      // Merge with existing selections
      selectAll([...selectedIds, ...result.matchedIds]);
      
      // Apply companies if any are parsed
      if (result.matchedItems) {
        result.matchedItems.forEach(item => {
          if (item.company && item.company.trim() !== '') {
            setCompany(item.id, item.company.trim());
          }
        });
      }

      onClose();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInputText(text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 700, width: '95%' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(135deg, #0f766e, #0d9488)',
          borderRadius: '16px 16px 0 0',
          color: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Upload size={22} />
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Upload Bulk PI</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.85 }}>
                Pilih ratusan PI sekaligus via paste atau file CSV
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {!result ? (
            <>
              {/* Instructions */}
              <div style={{
                background: 'rgba(240, 253, 250, 0.6)', border: '1px solid rgba(153, 246, 228, 0.4)', borderRadius: 12,
                padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#0f766e',
              }}>
                <strong>Format yang didukung:</strong> Satu No. PI per baris. Bisa juga tambahkan Nama Vendor dan PT (opsional) dengan pemisah koma/tab.
                <br />
                <code style={{ background: '#dbeafe', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', display: 'inline-block', marginTop: 4 }}>
                  PI-001, CV Maju, PT VCI{'\n'}PI-002, CV Sejahtera, PT VVA
                </code>
              </div>

              {/* File Upload */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={16} />
                  Pilih File CSV
                  <input type="file" accept=".csv,.txt,.tsv" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
                <button
                  className="btn btn-secondary"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      setInputText(text);
                    } catch {
                      alert('Tidak bisa membaca clipboard. Silakan paste manual.');
                    }
                  }}
                >
                  <ClipboardPaste size={16} />
                  Paste dari Clipboard
                </button>
              </div>

              {/* Text Area */}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Masukkan No. PI (satu per baris):\nPI-001\nPI-002\nPI-003\n...\n\nAtau format CSV:\nPI-001, CV Maju, PT VCI\nPI-002, CV Sejahtera, PT VVA`}
                style={{
                  width: '100%',
                  minHeight: 200,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid #d1d5db',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  lineHeight: 1.6,
                  resize: 'vertical',
                }}
              />

              <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                {inputText.trim() ? `${inputText.trim().split(/[\n\r]+/).filter(l => l.trim()).length} baris terdeteksi` : 'Belum ada data'}
              </div>
            </>
          ) : (
            // Results
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{
                  padding: '16px', borderRadius: 10, background: '#f0fdf4',
                  border: '1px solid #bbf7d0', textAlign: 'center',
                }}>
                  <CheckCircle2 size={28} color="#059669" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#059669' }}>{result.matched.length}</div>
                  <div style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>PI Ditemukan</div>
                </div>
                <div style={{
                  padding: '16px', borderRadius: 10, background: '#fefce8',
                  border: '1px solid #fde68a', textAlign: 'center',
                }}>
                  <AlertTriangle size={28} color="#d97706" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#d97706' }}>{result.notFound.length}</div>
                  <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>PI Tidak Ditemukan</div>
                </div>
              </div>

              {result.notFound.length > 0 && (
                <div style={{
                  background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10,
                  padding: '12px 16px', marginBottom: 16, maxHeight: 150, overflowY: 'auto',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>PI yang tidak ditemukan di database:</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#78350f', lineHeight: 1.8 }}>
                    {result.notFound.join(', ')}
                  </div>
                </div>
              )}

              {result.matched.length > 0 && (
                <div style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
                  padding: '12px 16px', marginBottom: 16, maxHeight: 150, overflowY: 'auto',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 6 }}>PI yang berhasil ditemukan:</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#14532d', lineHeight: 1.8 }}>
                    {result.matched.join(', ')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          {!result ? (
            <>
              <button className="btn btn-secondary" onClick={onClose}>Batal</button>
              <button className="btn btn-primary" onClick={handleParse} disabled={loading || !inputText.trim()}>
                {loading ? <Loader2 size={16} className="pulse" /> : <Upload size={16} />}
                {loading ? 'Memproses...' : 'Proses & Cocokkan'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => { setResult(null); setInputText(''); }}>
                Upload Lagi
              </button>
              <button className="btn btn-primary" onClick={handleApplySelection} disabled={result.matchedIds.length === 0}>
                <CheckCircle2 size={16} />
                Pilih {result.matchedIds.length} PI yang Cocok
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
