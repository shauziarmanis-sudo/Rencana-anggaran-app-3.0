'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { UploadCloud, CheckCircle2, AlertTriangle, Save, Loader2 } from 'lucide-react';
import Papa from 'papaparse';

export default function UploadCSVPage() {
  const [csvData, setCsvData] = useState({
    payables: null as any[] | null,
    piItems: null as any[] | null,
    psItems: null as any[] | null,
    bankData: null as any[] | null,
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'payables' | 'piItems' | 'psItems' | 'bankData') => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(prev => ({ ...prev, [type]: results.data }));
      },
      error: (error) => {
        console.error(error);
        alert(`Gagal membaca file CSV: ${error.message}`);
      }
    });
  };

  const handleUploadSubmit = async () => {
    if (!csvData.payables || !csvData.piItems) {
      setMessage({ type: 'error', text: 'File RAW Payable dan RAW PI wajib diupload.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: 'Sedang mengatur dan memisahkan jutaan data (indexing)...' });

    try {
      // Hanya ambil Unpaid Payables
      const unpaidPayables = csvData.payables.filter((p: any) => (p['Payment state'] || '').toLowerCase() === 'unpaid');
      
      // PRE-INDEXING (HashMap) untuk performa tingkat Dewa mencegah browser ngelag
      const piItemsByCode = new Map<string, any[]>();
      csvData.piItems.forEach((item: any) => {
        const code = item['Purchase Invoice Code'];
        if (!code) return;
        if (!piItemsByCode.has(code)) piItemsByCode.set(code, []);
        piItemsByCode.get(code)!.push({
          'Purchase Invoice Code': code,
          'Source Document Code': item['Source Document Code'],
          'Item Name': item['Item Name'],
          'Description': item['Description'],
          'Quantity': item['Quantity'],
          'Item Price': item['Item Price'],
          'Item Grand Amount': item['Item Grand Amount']
        });
      });

      const psItemsBySource = new Map<string, any[]>();
      (csvData.psItems || []).forEach((item: any) => {
        const sourceCode = item['Source Document Code'];
        if (!sourceCode) return;
        if (!psItemsBySource.has(sourceCode)) psItemsBySource.set(sourceCode, []);
        psItemsBySource.get(sourceCode)!.push({
          'Source Document Code': sourceCode,
          'Item Name': item['Item Name'],
          'Item Quantity': item['Item Quantity'],
          'Item Grand Amount': item['Item Grand Amount']
        });
      });

      // Proses 10 invoice per pengiriman untuk menjamin tidak tembus batas Vercel 4.5MB / 10 Detik
      const CHUNK_SIZE = 10; 
      let totalMigrated = 0;

      for (let i = 0; i < unpaidPayables.length; i += CHUNK_SIZE) {
        const payablesChunk = unpaidPayables.slice(i, i + CHUNK_SIZE);
        
        let piItemsChunk: any[] = [];
        let psItemsChunk: any[] = [];

        payablesChunk.forEach((p: any) => {
          const piCode = p['Purchase Invoice Code'];
          const relatedPIs = piItemsByCode.get(piCode) || [];
          piItemsChunk.push(...relatedPIs);

          relatedPIs.forEach(piItem => {
             const relatedPSs = psItemsBySource.get(piItem['Source Document Code']) || [];
             psItemsChunk.push(...relatedPSs);
          });
        });

        const res = await fetch('/api/upload-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payables: payablesChunk,
            piItems: piItemsChunk,
            psItems: psItemsChunk,
          }),
        });

        const textResponse = await res.text();
        let json;
        try {
          json = JSON.parse(textResponse);
        } catch(e) {
          throw new Error(`Server Error: Vercel mengalami Timeout pada antrian ke-${i+1}. Coba lakukan upload ulang (data yang sudah masuk tidak akan ganda).`);
        }

        if (!json.success) {
          console.error("Vercel Error:", json.error);
          throw new Error(json.error || `Gagal API pada antrian ${i+1}`);
        }
        
        totalMigrated += payablesChunk.length;
        setMessage({ type: '', text: `Melesat stabil... (${Math.min(i + CHUNK_SIZE, unpaidPayables.length)} dari ${unpaidPayables.length} invoice Unpaid sukses disimpan)` });
      }

      setMessage({ type: 'success', text: `Tuntas! ✅ Sukses mentransfer semua total ${unpaidPayables.length} invoice Unpaid beserta ratusan ribu itemnya.` });
      // Reset forms
      setCsvData({ payables: null, piItems: null, psItems: null, bankData: null });
      document.querySelectorAll('input[type=file]').forEach((el: any) => el.value = '');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleBankUploadSubmit = async () => {
    if (!csvData.bankData) {
      setMessage({ type: 'error', text: 'File CSV Rekening belum diupload.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: 'Sedang memproses dan mengupdate data rekening vendor...' });

    try {
      const CHUNK_SIZE = 5;
      let totalUpdated = 0;

      for (let i = 0; i < csvData.bankData.length; i += CHUNK_SIZE) {
        const chunk = csvData.bankData.slice(i, i + CHUNK_SIZE);
        
        const res = await fetch('/api/upload-csv/banks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bankData: chunk }),
        });

        const textResponse = await res.text();
        let json;
        try {
          json = JSON.parse(textResponse);
        } catch(e) {
          throw new Error(`Server Error: Vercel Timeout pada proses baris ke-${i+1}. Terlalu banyak data.`);
        }

        if (!json.success) throw new Error(json.error || 'Gagal update rekening');
        
        totalUpdated += json.updatedCount || 0;
        setMessage({ type: '', text: `Melesat stabil... (${Math.min(i + CHUNK_SIZE, csvData.bankData.length)} dari ${csvData.bankData.length} baris diproses)` });
      }

      setMessage({ type: 'success', text: `Tuntas! ✅ Berhasil mengupdate rekening untuk ${totalUpdated} vendor.` });
      setCsvData(prev => ({ ...prev, bankData: null }));
      const bankInput = document.getElementById('bank-upload-input') as HTMLInputElement | null;
      if (bankInput) bankInput.value = '';
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h2>Upload CSV Migrasi</h2>
          <p>Mendukung metode file-upload (Bypass integrasi Google API) secara langsung di browser.</p>
        </div>

        <div style={{ padding: '0 32px 32px', maxWidth: 800, margin: '0 auto' }}>
          {message.text && (
            <div style={{
              padding: 16,
              marginBottom: 16,
              borderRadius: 8,
              backgroundColor: message.type === 'error' ? '#fef2f2' : '#ecfdf5',
              border: `1px solid ${message.type === 'error' ? '#fecaca' : '#a7f3d0'}`,
              color: message.type === 'error' ? '#991b1b' : '#065f46'
            }}>
              {message.text}
            </div>
          )}

          <div className="glass-card" style={{ padding: 32 }}>
            <h3 style={{ marginBottom: 24, fontSize: 18 }}>Silakan Upload 3 File CSV Anda</h3>

            <div style={{ display: 'grid', gap: 20, marginBottom: 32 }}>
              {/* File Payable */}
              <div style={{ border: '1px dashed #cbd5e1', padding: 20, borderRadius: 12, background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px', color: '#1e293b' }}>1. Upload RAW - Payable.csv</h4>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Wajib. Header: Currency, Vendor Code, dst...</span>
                  </div>
                  <div>
                    {csvData.payables ? (
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <CheckCircle2 size={18} /> {csvData.payables.length} baris
                      </span>
                    ) : (
                      <input type="file" accept=".csv" onChange={(e) => handleFileUpload(e, 'payables')} />
                    )}
                  </div>
                </div>
              </div>

              {/* File PI */}
              <div style={{ border: '1px dashed #cbd5e1', padding: 20, borderRadius: 12, background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px', color: '#1e293b' }}>2. Upload RAW - PI.csv</h4>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Wajib. Detail Item Invoice.</span>
                  </div>
                  <div>
                    {csvData.piItems ? (
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <CheckCircle2 size={18} /> {csvData.piItems.length} baris
                      </span>
                    ) : (
                      <input type="file" accept=".csv" onChange={(e) => handleFileUpload(e, 'piItems')} />
                    )}
                  </div>
                </div>
              </div>

              {/* File PS */}
              <div style={{ border: '1px dashed #cbd5e1', padding: 20, borderRadius: 12, background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px', color: '#1e293b' }}>3. Upload RAW - PS.csv</h4>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Opsional. Bukti Penerimaan Barang.</span>
                  </div>
                  <div>
                    {csvData.psItems ? (
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <CheckCircle2 size={18} /> {csvData.psItems.length} baris
                      </span>
                    ) : (
                      <input type="file" accept=".csv" onChange={(e) => handleFileUpload(e, 'psItems')} />
                    )}
                  </div>
                </div>
              </div>
              {/* File Bank Data */}
              <div style={{ border: '1px solid rgba(153, 246, 228, 0.4)', padding: 20, borderRadius: 16, background: 'rgba(240, 253, 250, 0.6)', backdropFilter: 'blur(8px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px', color: '#0f766e' }}>✨ Update Rekening Massal</h4>
                    <span style={{ fontSize: 12, color: '#0f766e' }}>Upload CSV khusus data Rekening (Kolom: Vendor Name, Bank Name, Bank Account, Account Name). Proses ini terpisah dari Invoice.</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {csvData.bankData ? (
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, justifyContent: 'flex-end', marginBottom: 12 }}>
                        <CheckCircle2 size={18} /> {csvData.bankData.length} baris
                      </span>
                    ) : (
                      <div style={{ marginBottom: 12 }}>
                        <input id="bank-upload-input" type="file" accept=".csv" onChange={(e) => handleFileUpload(e, 'bankData')} />
                      </div>
                    )}
                    <button 
                      className="btn btn-primary" 
                      onClick={handleBankUploadSubmit} 
                      disabled={loading || !csvData.bankData}
                      style={{ padding: '8px 16px', fontSize: 13 }}
                    >
                      {loading && csvData.bankData ? <Loader2 size={16} className="pulse"/> : <Save size={16} />}
                      {loading && csvData.bankData ? 'Menyimpan...' : 'Update Rekening'}
                    </button>
                  </div>
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Tombol "Proses ke MySQL" di sebelah kanan SAJA yang akan memproses Raw Payables, Raw PI, & RAW PS.
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleUploadSubmit} 
                disabled={loading || !csvData.payables || !csvData.piItems}
                style={{ padding: '12px 24px', fontSize: 15 }}
              >
                {loading && (csvData.payables) ? <Loader2 size={20} className="pulse"/> : <UploadCloud size={20} />}
                {loading && (csvData.payables) ? 'Memproses ke MySQL...' : 'Proses ke MySQL'}
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
