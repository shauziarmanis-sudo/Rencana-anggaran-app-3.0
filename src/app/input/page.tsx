'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Plus, Trash2, Save, UploadCloud } from 'lucide-react';

interface FormItem {
  namaBarang: string;
  keterangan: string;
  qtyPI: number;
  hargaPI: number;
}

export default function ManualInputPIPage() {
  const [formData, setFormData] = useState({
    companyCode: '',
    vendorName: '',
    vendorCode: '',
    rekening: '',
    bankName: '',
    accountName: '',
    tglBeli: '',
    tempo: 0,
    driveUrl: '',
  });

  const [items, setItems] = useState<FormItem[]>([{ namaBarang: '', keterangan: '', qtyPI: 1, hargaPI: 0 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleItemChange = (index: number, field: keyof FormItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { namaBarang: '', keterangan: '', qtyPI: 1, hargaPI: 0 }]);

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotal = () => items.reduce((sum, item) => sum + (item.qtyPI * item.hargaPI), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/invoice/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, items })
      });
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Terjadi kesalahan saat menyimpan');
      
      setMessage({ type: 'success', text: 'Berhasil menyimpan data PI secara manual!' });
      // Reset form on success
      setFormData({ companyCode: '', vendorName: '', vendorCode: '', rekening: '', bankName: '', accountName: '', tglBeli: '', tempo: 0, driveUrl: '' });
      setItems([{ namaBarang: '', keterangan: '', qtyPI: 1, hargaPI: 0 }]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMigration = async () => {
    if (!confirm('Apakah Anda yakin ingin menyalin semua data unpaid invoice dari Google Sheets ke MySQL? Proses ini mungkin memakan waktu beberapa detik.')) return;
    
    setIsMigrating(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/migrate', { method: 'POST' });
      const json = await res.json();
      
      if (!json.success) throw new Error(json.error || 'Terjadi kesalahan migrasi');
      setMessage({ type: 'success', text: json.message });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div>
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Input Manual PI</h2>
            <p>Tambahkan Purchase Invoice dan lampiran untuk diproses ke dalam database.</p>
          </div>
          <div>
            <button 
              className="btn btn-secondary" 
              onClick={handleMigration}
              disabled={isMigrating}
              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#1e293b' }}
            >
              {isMigrating ? 'Memigrasikan...' : '🔄 Sinkronisasi dari Google Sheets'}
            </button>
          </div>
        </div>

        <div style={{ padding: '0 32px 32px', maxWidth: 1000, margin: '0 auto' }}>
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

          <form onSubmit={handleSubmit} className="glass-card" style={{ padding: 32 }}>
            <h3 style={{ marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 10 }}>Informasi Utama</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div>
                <label className="label">Perusahaan (PT)</label>
                <select className="search-input" style={{ width: '100%' }} value={formData.companyCode} onChange={e => setFormData({...formData, companyCode: e.target.value})} required>
                  <option value="">-- Pilih PT --</option>
                  <option value="PT VCI">PT VCI</option>
                  <option value="PT VVA">PT VVA</option>
                </select>
              </div>
              
              <div>
                <label className="label">Tanggal Pembelian</label>
                <input type="date" className="search-input" style={{ width: '100%' }} value={formData.tglBeli} onChange={e => setFormData({...formData, tglBeli: e.target.value})} required />
              </div>

              <div>
                <label className="label">Nama Vendor / Supplier</label>
                <input type="text" className="search-input" style={{ width: '100%' }} placeholder="Contoh: CV Maju Bersama" value={formData.vendorName} onChange={e => setFormData({...formData, vendorName: e.target.value})} required />
              </div>

              <div>
                <label className="label">Nama Bank (Opsional)</label>
                <input type="text" className="search-input" style={{ width: '100%' }} placeholder="Contoh: BCA / Mandiri" value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} />
              </div>

              <div>
                <label className="label">Nomor Rekening Vendor (Opsional)</label>
                <input type="text" className="search-input" style={{ width: '100%' }} placeholder="1234567890" value={formData.rekening} onChange={e => setFormData({...formData, rekening: e.target.value})} />
              </div>

              <div>
                <label className="label">Nama Pemilik Rekening (Opsional)</label>
                <input type="text" className="search-input" style={{ width: '100%' }} placeholder="A/N CV Maju Bersama" value={formData.accountName} onChange={e => setFormData({...formData, accountName: e.target.value})} />
              </div>

              <div>
                <label className="label">Tempo Pembayaran (Hari)</label>
                <input type="number" min="0" className="search-input" style={{ width: '100%' }} value={formData.tempo} onChange={e => setFormData({...formData, tempo: parseInt(e.target.value)})} />
              </div>
              
              <div>
                <label className="label">URL Berkas Tagihan (Google Drive / Lainnya)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="url" className="search-input" style={{ flex: 1 }} placeholder="https://drive.google.com/..." value={formData.driveUrl} onChange={e => setFormData({...formData, driveUrl: e.target.value})} />
                  <button type="button" className="btn btn-secondary" title="Pilih otomatis dari Drive (Segera hadir)"><UploadCloud size={16} /></button>
                </div>
              </div>
            </div>

            <h3 style={{ marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Detail Barang (Items)
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                <Plus size={16} /> Tambah Baris
              </button>
            </h3>

            <div>
              {items.map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1.5fr 40px', gap: 12, marginBottom: 12, alignItems: 'center' }}>
                  <input type="text" className="search-input" placeholder="Nama Barang" value={item.namaBarang} onChange={e => handleItemChange(index, 'namaBarang', e.target.value)} required />
                  <input type="text" className="search-input" placeholder="Keterangan / Spesifikasi" value={item.keterangan} onChange={e => handleItemChange(index, 'keterangan', e.target.value)} />
                  <input type="number" className="search-input" placeholder="Qty" min="0.1" step="0.1" value={item.qtyPI} onChange={e => handleItemChange(index, 'qtyPI', parseFloat(e.target.value))} required />
                  <input type="number" className="search-input" placeholder="Harga Satuan" min="0" value={item.hargaPI} onChange={e => handleItemChange(index, 'hargaPI', parseFloat(e.target.value))} required />
                  <button type="button" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => removeItem(index)} disabled={items.length === 1}>
                    <Trash2 size={18} style={{ opacity: items.length === 1 ? 0.3 : 1 }} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, textAlign: 'right', fontWeight: 600, fontSize: 18 }}>
              Total Pembelian: Rp {calculateTotal().toLocaleString('id-ID')}
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => window.history.back()}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan...' : <><Save size={16} /> Simpan Data PI</>}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
