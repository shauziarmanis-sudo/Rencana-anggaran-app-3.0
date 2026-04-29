'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { formatRupiah } from '@/lib/format';
import {
  Archive,
  RotateCcw,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

interface BudgetedPI {
  id: string;
  noPi: string;
  vendorName: string;
  companyName: string;
  totalRencanaBayar: number;
  hutang: number;
  budgetedAt: string;
  budgetedBy: string;
  tglBeli: string;
}

export default function ArsipPage() {
  const [data, setData] = useState<BudgetedPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/budgeted');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Gagal memuat data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data arsip');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReturn = async (piId: string) => {
    setReturning(true);
    try {
      const res = await fetch('/api/budgeted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piId }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(`PI berhasil dikembalikan ke Modal Anggaran`);
        setConfirmId(null);
        fetchData();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengembalikan PI');
    } finally {
      setReturning(false);
    }
  };

  const totalBudgeted = data.reduce((s, d) => s + d.hutang, 0);

  return (
    <div>
      <Sidebar />
      <main className="main-content">
        {/* Page Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2><Archive size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Arsip Anggaran</h2>
            <p>PI yang sudah dianggarkan (email terkirim). Tidak muncul di Modal Anggaran.</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/" className="btn btn-secondary">
              <ArrowLeft size={16} /> Modal Anggaran
            </Link>
            <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'pulse' : ''} /> Refresh
            </button>
          </div>
        </div>

        <div style={{ padding: '0 32px 32px' }}>
          {/* Summary */}
          <div className="glass-card" style={{ padding: '16px 24px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Total PI Dianggarkan:</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#0f766e', marginLeft: 12 }}>{data.length} PI</span>
            </div>
            <div>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Total Nominal:</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#0f766e', marginLeft: 12 }}>{formatRupiah(totalBudgeted)}</span>
            </div>
          </div>

          {/* Success Message */}
          {successMsg && (
            <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} color="#059669" />
              <span style={{ color: '#065f46', fontWeight: 600, fontSize: 13 }}>{successMsg}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={18} color="#dc2626" />
              <span style={{ color: '#991b1b', fontSize: 13 }}>{error}</span>
            </div>
          )}

          {/* Table */}
          <div className="glass-card" style={{ padding: 24, overflow: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Loader2 size={32} className="pulse" style={{ margin: '0 auto 12px', color: '#0f766e' }} />
                <p style={{ color: '#6b7280', fontSize: 14 }}>Memuat data arsip...</p>
              </div>
            ) : data.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Archive size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ color: '#6b7280', marginBottom: 8 }}>Belum ada PI yang dianggarkan</h3>
                <p style={{ color: '#9ca3af', fontSize: 13 }}>Kirim email approval dari halaman Email untuk menganggarkan PI.</p>
              </div>
            ) : (
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>No PI</th>
                    <th>Vendor</th>
                    <th>Perusahaan</th>
                    <th>Tgl Beli</th>
                    <th style={{ textAlign: 'right' }}>Total Rencana Bayar</th>
                    <th style={{ textAlign: 'right' }}>Hutang</th>
                    <th>Dianggarkan Oleh</th>
                    <th>Tanggal Anggaran</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={row.id}>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ color: '#0f766e', fontWeight: 600, fontFamily: 'monospace' }}>{row.noPi}</td>
                      <td>{row.vendorName}</td>
                      <td>{row.companyName}</td>
                      <td>{row.tglBeli}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatRupiah(row.totalRencanaBayar)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#dc2626', fontWeight: 600 }}>{formatRupiah(row.hutang)}</td>
                      <td>{row.budgetedBy}</td>
                      <td>{row.budgetedAt ? new Date(row.budgetedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        {confirmId === row.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>Yakin kembalikan?</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                className="btn btn-primary"
                                style={{ padding: '4px 12px', fontSize: 11 }}
                                onClick={() => handleReturn(row.id)}
                                disabled={returning}
                              >
                                {returning ? <Loader2 size={12} className="pulse" /> : 'Ya'}
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '4px 12px', fontSize: 11 }}
                                onClick={() => setConfirmId(null)}
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="btn"
                            style={{ padding: '4px 12px', fontSize: 11, background: 'rgba(240, 253, 250, 0.7)', color: '#0f766e', border: '1px solid rgba(153, 246, 228, 0.5)' }}
                            onClick={() => setConfirmId(row.id)}
                            title="Kembalikan PI ini ke Modal Anggaran"
                          >
                            <RotateCcw size={12} /> Kembalikan
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Confirmation Modal Overlay */}
      {confirmId && (
        <div style={{ display: 'none' }}>{/* Inline confirm is shown in table row */}</div>
      )}
    </div>
  );
}
