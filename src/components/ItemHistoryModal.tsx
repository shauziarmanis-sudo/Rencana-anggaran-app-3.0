'use client';

import React, { useEffect, useState } from 'react';
import { formatRupiah, formatNumber } from '@/lib/format';
import {
  X,
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  History,
  BarChart3,
} from 'lucide-react';

interface HistoryItem {
  id: string;
  namaBarang: string;
  keterangan: string;
  qtyPI: number;
  hargaPI: number;
  totalHarga: number;
  noPi: string;
  tglBeli: string;
  vendorName: string;
  vendorCode: string;
  companyName: string;
}

interface Stats {
  totalRecords: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  totalQty: number;
}

interface ItemHistoryModalProps {
  namaBarang: string;
  currentPrice?: number;
  onClose: () => void;
}

export default function ItemHistoryModal({ namaBarang, currentPrice, onClose }: ItemHistoryModalProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/item-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ namaBarang }),
        });
        const json = await res.json();
        if (json.success) {
          setHistory(json.data);
          setStats(json.stats);
        } else {
          setError(json.error || 'Gagal memuat data histori');
        }
      } catch (err) {
        setError('Gagal terhubung ke server');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [namaBarang]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 800, width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0f766e, #0d9488)',
          borderRadius: '16px 16px 0 0',
          color: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <History size={22} />
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Histori Pembelian</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.85 }}>
                {namaBarang}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 8,
              padding: 8,
              cursor: 'pointer',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Loader2 size={32} className="pulse" style={{ margin: '0 auto 12px', color: '#0d9488' }} />
              <p style={{ color: '#6b7280', fontSize: 14 }}>Memuat histori pembelian...</p>
            </div>
          ) : error ? (
            <div style={{
              textAlign: 'center',
              padding: 40,
              color: '#dc2626',
              fontSize: 14,
            }}>
              {error}
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              {stats && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 12,
                  marginBottom: 20,
                }}>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: 'rgba(240, 253, 250, 0.6)',
                    border: '1px solid rgba(153, 246, 228, 0.4)',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Total Pembelian
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#0f766e', marginTop: 4 }}>
                      {stats.totalRecords}x
                    </div>
                  </div>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Harga Terendah
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#059669', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      {formatRupiah(stats.minPrice)}
                    </div>
                  </div>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: '#fefce8',
                    border: '1px solid #fde68a',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Harga Rata-Rata
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#d97706', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      {formatRupiah(stats.avgPrice)}
                    </div>
                  </div>
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Harga Tertinggi
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      {formatRupiah(stats.maxPrice)}
                    </div>
                  </div>
                </div>
              )}

              {/* Current Price Comparison */}
              {currentPrice && stats && stats.avgPrice > 0 && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  marginBottom: 16,
                  background: currentPrice > stats.avgPrice ? '#fef2f2' : currentPrice < stats.avgPrice ? '#f0fdf4' : '#f3f4f6',
                  border: `1px solid ${currentPrice > stats.avgPrice ? '#fecaca' : currentPrice < stats.avgPrice ? '#bbf7d0' : '#d1d5db'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                }}>
                  {currentPrice > stats.avgPrice ? (
                    <TrendingUp size={18} color="#dc2626" />
                  ) : currentPrice < stats.avgPrice ? (
                    <TrendingDown size={18} color="#059669" />
                  ) : (
                    <Minus size={18} color="#6b7280" />
                  )}
                  <span>
                    <strong>Harga saat ini ({formatRupiah(currentPrice)})</strong>{' '}
                    {currentPrice > stats.avgPrice
                      ? `lebih mahal ${Math.round(((currentPrice - stats.avgPrice) / stats.avgPrice) * 100)}% dari rata-rata`
                      : currentPrice < stats.avgPrice
                      ? `lebih murah ${Math.round(((stats.avgPrice - currentPrice) / stats.avgPrice) * 100)}% dari rata-rata`
                      : 'sama dengan rata-rata'}
                  </span>
                </div>
              )}

              {/* History Table */}
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Package size={40} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
                  <p style={{ color: '#6b7280', fontSize: 14 }}>
                    Tidak ada data histori pembelian untuk barang ini.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: 350, borderRadius: 10, border: '1px solid #e5e7eb' }}>
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 30, textAlign: 'center' }}>No</th>
                        <th style={{ minWidth: 90 }}>Tgl. Beli</th>
                        <th style={{ minWidth: 140 }}>Vendor</th>
                        <th style={{ minWidth: 100 }}>No. PI</th>
                        <th style={{ minWidth: 50, textAlign: 'right' }}>Qty</th>
                        <th style={{ minWidth: 100, textAlign: 'right' }}>Harga Satuan</th>
                        <th style={{ minWidth: 100, textAlign: 'right' }}>Total</th>
                        <th style={{ minWidth: 80 }}>PT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item, idx) => {
                        const isCurrentLowest = stats && item.hargaPI === stats.minPrice;
                        return (
                          <tr
                            key={item.id}
                            style={{
                              background: isCurrentLowest ? '#f0fdf4' : undefined,
                            }}
                          >
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>{idx + 1}</td>
                            <td>{item.tglBeli}</td>
                            <td style={{ fontWeight: 500 }}>{item.vendorName}</td>
                            <td style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              color: '#0f766e',
                              fontWeight: 600,
                            }}>
                              {item.noPi}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                              {formatNumber(item.qtyPI)}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                              color: isCurrentLowest ? '#059669' : undefined,
                            }}>
                              {formatRupiah(item.hargaPI)}
                              {isCurrentLowest && (
                                <span style={{ fontSize: 9, marginLeft: 4, color: '#059669' }}>★</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                              {formatRupiah(item.totalHarga)}
                            </td>
                            <td>
                              <span style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'rgba(240, 253, 250, 0.6)',
                                color: '#0f766e',
                              }}>
                                {item.companyName}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Legend */}
              {history.length > 0 && (
                <div style={{
                  marginTop: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  fontSize: 11,
                  color: '#6b7280',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#059669' }}>★</span> Harga terendah
                  </span>
                  <span>
                    <BarChart3 size={12} style={{ verticalAlign: 'middle' }} /> Total {history.length} transaksi
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'right',
        }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
