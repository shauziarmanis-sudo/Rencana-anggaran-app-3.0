'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { formatRupiah, formatNumber } from '@/lib/format';
import {
  Package,
  Plus,
  Save,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Edit3,
  RefreshCw,
} from 'lucide-react';

interface StockItem {
  id: string;
  namaBarang: string;
  currentQty: number;
  minQty: number;
  unit: string;
  category: string | null;
  lastPrice: number;
  lastVendor: string | null;
  lastPurchased: string | null;
  notes: string | null;
}

const emptyForm: Partial<StockItem> = {
  namaBarang: '',
  currentQty: 0,
  minQty: 0,
  unit: 'pcs',
  category: '',
  lastPrice: 0,
  lastVendor: '',
  notes: '',
};

export default function StockPage() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Partial<StockItem> | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stock');
      const json = await res.json();
      if (json.success) {
        setStocks(json.data);
      }
    } catch (err) {
      console.error('Error fetching stock:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const handleSave = async () => {
    if (!editItem?.namaBarang) {
      setMessage({ type: 'error', text: 'Nama barang wajib diisi' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editItem),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: editItem.id ? 'Berhasil update data stock!' : 'Berhasil tambah data stock!' });
        setShowForm(false);
        setEditItem(null);
        fetchStocks();
      } else {
        setMessage({ type: 'error', text: json.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus item ini?')) return;
    try {
      const res = await fetch(`/api/stock?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: 'Item berhasil dihapus' });
        fetchStocks();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const filteredStocks = stocks.filter(s =>
    s.namaBarang.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.category && s.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const lowStockCount = stocks.filter(s => s.currentQty <= s.minQty && s.minQty > 0).length;

  return (
    <div>
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Data Stock</h2>
            <p>{stocks.length} item • {lowStockCount > 0 ? `⚠️ ${lowStockCount} item stock rendah` : '✅ Stock aman'}</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" onClick={fetchStocks} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'pulse' : ''} />
              Refresh
            </button>
            <button className="btn btn-primary" onClick={() => { setEditItem({ ...emptyForm }); setShowForm(true); }}>
              <Plus size={16} />
              Tambah Item
            </button>
          </div>
        </div>

        <div style={{ padding: '0 32px 32px' }}>
          {message.text && (
            <div style={{
              padding: 16, marginBottom: 16, borderRadius: 8,
              backgroundColor: message.type === 'error' ? '#fef2f2' : '#ecfdf5',
              border: `1px solid ${message.type === 'error' ? '#fecaca' : '#a7f3d0'}`,
              color: message.type === 'error' ? '#991b1b' : '#065f46',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{message.text}</span>
              <button onClick={() => setMessage({ type: '', text: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={20} color="#1d4ed8" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Total Item</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1d4ed8' }}>{stocks.length}</div>
              </div>
            </div>
            <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: lowStockCount > 0 ? '#fef2f2' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={20} color={lowStockCount > 0 ? '#dc2626' : '#059669'} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Stock Rendah</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: lowStockCount > 0 ? '#dc2626' : '#059669' }}>{lowStockCount}</div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ position: 'relative', maxWidth: 400, marginBottom: 20 }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Cari nama barang atau kategori..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <p style={{ color: '#6b7280', fontSize: 14 }}>Memuat data stock...</p>
              </div>
            ) : filteredStocks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Package size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
                <p style={{ color: '#6b7280', fontSize: 14 }}>
                  {searchQuery ? 'Tidak ada item yang cocok' : 'Belum ada data stock'}
                </p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: 'center' }}>No</th>
                      <th style={{ minWidth: 200 }}>Nama Barang</th>
                      <th style={{ minWidth: 100 }}>Kategori</th>
                      <th style={{ minWidth: 80, textAlign: 'right' }}>Qty Saat Ini</th>
                      <th style={{ minWidth: 80, textAlign: 'right' }}>Min. Qty</th>
                      <th style={{ minWidth: 60 }}>Satuan</th>
                      <th style={{ minWidth: 100, textAlign: 'right' }}>Harga Terakhir</th>
                      <th style={{ minWidth: 120 }}>Vendor Terakhir</th>
                      <th style={{ minWidth: 80 }}>Status</th>
                      <th style={{ minWidth: 100 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStocks.map((stock, idx) => {
                      const isLowStock = stock.currentQty <= stock.minQty && stock.minQty > 0;
                      return (
                        <tr key={stock.id} style={{ background: isLowStock ? '#fef2f2' : undefined }}>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{stock.namaBarang}</td>
                          <td style={{ color: '#6b7280' }}>{stock.category || '-'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isLowStock ? '#dc2626' : '#059669' }}>
                            {formatNumber(stock.currentQty)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#6b7280' }}>
                            {formatNumber(stock.minQty)}
                          </td>
                          <td>{stock.unit}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                            {stock.lastPrice > 0 ? formatRupiah(stock.lastPrice) : '-'}
                          </td>
                          <td style={{ color: '#6b7280' }}>{stock.lastVendor || '-'}</td>
                          <td>
                            {isLowStock ? (
                              <span className="badge late" style={{ fontSize: 10 }}>
                                <AlertCircle size={10} /> Low
                              </span>
                            ) : (
                              <span className="badge on-time" style={{ fontSize: 10 }}>
                                <CheckCircle2 size={10} /> OK
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => { setEditItem(stock); setShowForm(true); }}
                                title="Edit"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                className="btn btn-sm"
                                style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                                onClick={() => handleDelete(stock.id)}
                                title="Hapus"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add/Edit Form Modal */}
      {showForm && editItem && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditItem(null); }}>
          <div className="modal-content" style={{ maxWidth: 600, width: '95%' }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)',
              borderRadius: '16px 16px 0 0',
              color: 'white',
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {editItem.id ? '✏️ Edit Stock' : '➕ Tambah Stock Baru'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditItem(null); }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'white' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Nama Barang *</label>
                  <input type="text" className="search-input" style={{ width: '100%' }} placeholder="Nama barang" value={editItem.namaBarang || ''} onChange={e => setEditItem({ ...editItem, namaBarang: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Qty Saat Ini</label>
                  <input type="number" className="search-input" style={{ width: '100%' }} value={editItem.currentQty || 0} onChange={e => setEditItem({ ...editItem, currentQty: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">Min. Qty (Alert)</label>
                  <input type="number" className="search-input" style={{ width: '100%' }} value={editItem.minQty || 0} onChange={e => setEditItem({ ...editItem, minQty: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">Satuan</label>
                  <select className="search-input" style={{ width: '100%' }} value={editItem.unit || 'pcs'} onChange={e => setEditItem({ ...editItem, unit: e.target.value })}>
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="liter">liter</option>
                    <option value="box">box</option>
                    <option value="pack">pack</option>
                    <option value="roll">roll</option>
                    <option value="meter">meter</option>
                    <option value="unit">unit</option>
                  </select>
                </div>
                <div>
                  <label className="label">Kategori</label>
                  <input type="text" className="search-input" style={{ width: '100%' }} placeholder="Misal: Bahan Baku" value={editItem.category || ''} onChange={e => setEditItem({ ...editItem, category: e.target.value })} />
                </div>
                <div>
                  <label className="label">Harga Terakhir</label>
                  <input type="number" className="search-input" style={{ width: '100%' }} value={editItem.lastPrice || 0} onChange={e => setEditItem({ ...editItem, lastPrice: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">Vendor Terakhir</label>
                  <input type="text" className="search-input" style={{ width: '100%' }} placeholder="Nama vendor" value={editItem.lastVendor || ''} onChange={e => setEditItem({ ...editItem, lastVendor: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Catatan</label>
                  <input type="text" className="search-input" style={{ width: '100%' }} placeholder="Catatan tambahan" value={editItem.notes || ''} onChange={e => setEditItem({ ...editItem, notes: e.target.value })} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditItem(null); }}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={16} className="pulse" /> : <Save size={16} />}
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
