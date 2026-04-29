'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import ItemHistoryModal from '@/components/ItemHistoryModal';
import { formatRupiah, formatNumber } from '@/lib/format';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Clock,
  Loader2,
  Minus,
  PackageSearch,
  RefreshCw,
  WalletCards,
} from 'lucide-react';

type Trend = 'up' | 'down' | 'flat';

interface VendorDebtRow {
  vendorName: string;
  totalDebt: number;
  belumJatuhTempo: number;
  days0To7: number;
  days8To14: number;
  days15To21: number;
  daysOver21: number;
}

interface MaterialTrendRow {
  itemName: string;
  currentPrice: number;
  lowestPrice30d: number;
  highestPrice30d: number;
  trend: Trend;
  lastPurchaseDate: string;
  purchaseCount30d: number;
}

interface DashboardStats {
  vendorDebts: VendorDebtRow[];
  materialTrends: MaterialTrendRow[];
  generatedAt: string;
}

const emptyStats: DashboardStats = {
  vendorDebts: [],
  materialTrends: [],
  generatedAt: '',
};

function TrendBadge({ trend }: { trend: Trend }) {
  const config = {
    up: {
      label: 'Naik',
      icon: <ArrowUp size={14} />,
      className: 'bg-red-50 text-red-700 ring-red-200',
    },
    down: {
      label: 'Turun',
      icon: <ArrowDown size={14} />,
      className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    },
    flat: {
      label: 'Stabil',
      icon: <Minus size={14} />,
      className: 'bg-slate-50 text-slate-700 ring-slate-200',
    },
  }[trend];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ itemName: string; currentPrice: number } | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard-stats');
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Gagal memuat data dashboard');
      }

      setStats(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totals = useMemo(() => {
    const totalDebt = stats.vendorDebts.reduce((sum, row) => sum + row.totalDebt, 0);
    const criticalDebt = stats.vendorDebts.reduce((sum, row) => sum + row.daysOver21, 0);
    return {
      totalDebt,
      criticalDebt,
      vendorCount: stats.vendorDebts.length,
      materialCount: stats.materialTrends.length,
    };
  }, [stats]);

  return (
    <div>
      <Sidebar />
      <main className="main-content">
        <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2">
              <BarChart3 size={24} />
              Dashboard
            </h2>
            <p>Monitor hutang vendor dan perubahan harga bahan 30 hari terakhir.</p>
          </div>
          <button className="btn btn-secondary w-fit" onClick={fetchStats} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'pulse' : ''} />
            Refresh
          </button>
        </div>

        <div className="px-4 pb-8 sm:px-6 lg:px-8">
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Dashboard gagal dimuat</div>
                <div>{error}</div>
              </div>
            </div>
          )}

          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <WalletCards size={15} />
                Total Hutang
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900">{formatRupiah(totals.totalDebt)}</div>
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-600">
                <Clock size={15} />
                Lewat 21 Hari
              </div>
              <div className="mt-2 text-lg font-bold text-red-700">{formatRupiah(totals.criticalDebt)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor Aktif</div>
              <div className="mt-2 text-lg font-bold text-slate-900">{formatNumber(totals.vendorCount)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <PackageSearch size={15} />
                Bahan 30 Hari
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900">{formatNumber(totals.materialCount)}</div>
            </div>
          </div>

          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Tabel Hutang Vendor</h3>
                <p className="text-sm text-slate-500">Aging hutang berdasarkan tempo pembayaran.</p>
              </div>
              {stats.generatedAt && (
                <span className="text-xs text-slate-400">
                  Update: {new Date(stats.generatedAt).toLocaleString('id-ID')}
                </span>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[980px] w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Vendor Name</th>
                    <th className="px-4 py-3 text-right font-semibold">Total Debt</th>
                    <th className="px-4 py-3 text-right font-semibold">Belum Jatuh Tempo</th>
                    <th className="bg-amber-50 px-4 py-3 text-right font-semibold text-amber-700">0-7</th>
                    <th className="bg-orange-50 px-4 py-3 text-right font-semibold text-orange-700">8-14</th>
                    <th className="bg-red-50 px-4 py-3 text-right font-semibold text-red-700">15-21</th>
                    <th className="bg-red-100 px-4 py-3 text-right font-semibold text-red-800">&gt;21</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                        <Loader2 size={24} className="pulse mx-auto mb-2 text-teal-700" />
                        Memuat data hutang vendor...
                      </td>
                    </tr>
                  ) : stats.vendorDebts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                        Tidak ada hutang vendor yang perlu ditampilkan.
                      </td>
                    </tr>
                  ) : (
                    stats.vendorDebts.map((row) => (
                      <tr key={row.vendorName} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{row.vendorName}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                          {formatRupiah(row.totalDebt)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {formatRupiah(row.belumJatuhTempo)}
                        </td>
                        <td className="bg-amber-50/60 px-4 py-3 text-right tabular-nums text-amber-800">
                          {formatRupiah(row.days0To7)}
                        </td>
                        <td className="bg-orange-50/70 px-4 py-3 text-right tabular-nums text-orange-800">
                          {formatRupiah(row.days8To14)}
                        </td>
                        <td className="bg-red-50/80 px-4 py-3 text-right tabular-nums text-red-800">
                          {formatRupiah(row.days15To21)}
                        </td>
                        <td className="bg-red-100/80 px-4 py-3 text-right font-semibold tabular-nums text-red-900">
                          {formatRupiah(row.daysOver21)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-900">Tabel Pembelian Bahan</h3>
              <p className="text-sm text-slate-500">Klik baris bahan untuk melihat rincian pembelian historis.</p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[780px] w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Item Name</th>
                    <th className="px-4 py-3 text-right font-semibold">Current Price</th>
                    <th className="px-4 py-3 text-right font-semibold">Lowest 30d</th>
                    <th className="px-4 py-3 text-right font-semibold">Highest 30d</th>
                    <th className="px-4 py-3 text-center font-semibold">Trend</th>
                    <th className="px-4 py-3 text-right font-semibold">Purchase Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        <Loader2 size={24} className="pulse mx-auto mb-2 text-teal-700" />
                        Memuat data pembelian bahan...
                      </td>
                    </tr>
                  ) : stats.materialTrends.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        Belum ada pembelian bahan dalam 30 hari terakhir.
                      </td>
                    </tr>
                  ) : (
                    stats.materialTrends.map((row) => (
                      <tr
                        key={row.itemName}
                        className="cursor-pointer hover:bg-teal-50"
                        onClick={() => setSelectedItem({ itemName: row.itemName, currentPrice: row.currentPrice })}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{row.itemName}</div>
                          <div className="text-xs text-slate-400">Terakhir: {row.lastPurchaseDate || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                          {formatRupiah(row.currentPrice)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                          {formatRupiah(row.lowestPrice30d)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-700">
                          {formatRupiah(row.highestPrice30d)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <TrendBadge trend={row.trend} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {formatNumber(row.purchaseCount30d)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {selectedItem && (
        <ItemHistoryModal
          namaBarang={selectedItem.itemName}
          currentPrice={selectedItem.currentPrice}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
