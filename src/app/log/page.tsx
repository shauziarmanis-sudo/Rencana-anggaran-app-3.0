'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import { formatRupiah } from '@/lib/format';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface LogRow {
  timestamp: string;
  action: string;
  user: string;
  piCount: string;
  piList: string;
  totalNominal: string;
  recipient: string;
  cc: string;
  status: string;
  invoiceFound: string;
  invoiceNotFound: string;
  errorMessage: string;
}

export default function LogPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/logs');
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
      } else {
        setError(json.error || 'Gagal memuat log');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div>
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Audit Log</h2>
            <p>Riwayat pengiriman email dan proses anggaranb</p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={fetchLogs}
            disabled={loading}
            id="refresh-logs-btn"
          >
            <RefreshCw size={16} className={loading ? 'pulse' : ''} />
            Refresh
          </button>
        </div>

        <div style={{ padding: '0 32px 32px' }}>
          {error && (
            <div style={{
              padding: '16px 20px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 12,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: '#dc2626',
            }}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: '#6b7280', fontSize: 14 }}>Memuat audit log...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
              <FileText size={48} color="#9ca3af" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ color: '#374151', marginBottom: 8 }}>Belum ada log</h3>
              <p style={{ color: '#6b7280', fontSize: 14 }}>
                Log akan muncul setelah proses email approval pertama dilakukan.
              </p>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrapper" style={{ maxHeight: 'calc(100vh - 240px)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>No</th>
                      <th>Waktu</th>
                      <th>User</th>
                      <th>PI</th>
                      <th style={{ textAlign: 'right' }}>Nominal</th>
                      <th>Penerima</th>
                      <th>CC</th>
                      <th>Invoice</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, idx) => {
                      const isSuccess = log.status?.toLowerCase() === 'success';
                      const date = new Date(log.timestamp);
                      const formattedDate = !isNaN(date.getTime())
                        ? date.toLocaleString('id-ID', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : log.timestamp;

                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: '#6b7280', textAlign: 'center' }}>
                            {idx + 1}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                              <Clock size={14} color="#6b7280" />
                              {formattedDate}
                            </div>
                          </td>
                          <td style={{ fontWeight: 500 }}>{log.user || '-'}</td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#1e40af' }}>
                              {log.piCount || 0} PI
                            </div>
                            <div style={{ fontSize: 11, color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {log.piList || '-'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {formatRupiah(parseFloat(log.totalNominal) || 0)}
                          </td>
                          <td style={{ fontSize: 12 }}>{log.recipient || '-'}</td>
                          <td style={{ fontSize: 12, color: '#6b7280' }}>{log.cc || '-'}</td>
                          <td>
                            <div style={{ fontSize: 12 }}>
                              <span style={{ color: '#059669' }}>✓ {log.invoiceFound || 0}</span>
                              {' / '}
                              <span style={{ color: '#dc2626' }}>✗ {log.invoiceNotFound || 0}</span>
                            </div>
                          </td>
                          <td>
                            {isSuccess ? (
                              <span className="badge found">
                                <CheckCircle2 size={12} /> SUCCESS
                              </span>
                            ) : (
                              <div>
                                <span className="badge not-found">
                                  <XCircle size={12} /> FAILED
                                </span>
                                {log.errorMessage && (
                                  <div style={{ fontSize: 10, color: '#dc2626', marginTop: 4, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {log.errorMessage}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
