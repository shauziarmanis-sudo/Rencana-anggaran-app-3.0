'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import ItemHistoryModal from '@/components/ItemHistoryModal';
import { formatDateIndonesia, formatNumber, formatRupiah } from '@/lib/format';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  Minus,
  PackageSearch,
  RefreshCw,
  Search,
  WalletCards,
  X,
} from 'lucide-react';

type Trend = 'up' | 'down' | 'flat';
type AgingKey = 'belumJatuhTempo' | 'days0To7' | 'days8To14' | 'days15To21' | 'daysOver21';

interface VendorDebtDetail {
  noPi: string;
  tglBeli: string;
  tempoHari: number;
  paymentState: string;
  hutang: number;
  agingBucket: AgingKey;
  daysSincePi: number;
  overdueDays: number;
  dueDate: string;
}

interface VendorDebtRow {
  vendorId: string;
  vendorName: string;
  totalDebt: number;
  belumJatuhTempo: number;
  days0To7: number;
  days8To14: number;
  days15To21: number;
  daysOver21: number;
  invoices: VendorDebtDetail[];
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

const VENDOR_PAGE_SIZE = 50;
const MATERIAL_PAGE_SIZE = 50;

const agingLabels: Record<AgingKey, string> = {
  belumJatuhTempo: 'Belum Jatuh Tempo',
  days0To7: '0 - 7 Hari',
  days8To14: '8 - 14 Hari',
  days15To21: '15 - 21 Hari',
  daysOver21: '> 21 Hari',
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

function AgingHeader({ value, tone }: { value: string; tone?: string }) {
  return (
    <span className={`flex flex-col items-center justify-center leading-tight ${tone ?? ''}`}>
      <span>{value}</span>
      <span className="mt-0.5 text-[10px] font-semibold normal-case tracking-normal">Hari</span>
    </span>
  );
}

function formatRangePrice(value: number, purchaseCount: number) {
  return purchaseCount > 0 ? formatRupiah(value) : '-';
}

function formatOverdueDays(overdueDays: number) {
  return overdueDays >= 0 ? `${formatNumber(overdueDays)} hari` : 'Belum jatuh tempo';
}

function VendorDebtModal({ vendor, onClose }: { vendor: VendorDebtRow; onClose: () => void }) {
  const bucketTotals = [
    { label: 'Belum Jatuh Tempo', value: vendor.belumJatuhTempo, className: 'bg-slate-50 text-slate-800' },
    { label: '0 - 7 Hari', value: vendor.days0To7, className: 'bg-amber-50 text-amber-800' },
    { label: '8 - 14 Hari', value: vendor.days8To14, className: 'bg-orange-50 text-orange-800' },
    { label: '15 - 21 Hari', value: vendor.days15To21, className: 'bg-red-50 text-red-800' },
    { label: '> 21 Hari', value: vendor.daysOver21, className: 'bg-red-100 text-red-900' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detail Hutang Vendor</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{vendor.vendorName}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {formatNumber(vendor.invoices.length)} PI outstanding dengan total {formatRupiah(vendor.totalDebt)}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            aria-label="Tutup detail hutang vendor"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-90px)] overflow-y-auto px-5 py-5">
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-5">
            {bucketTotals.map((bucket) => (
              <div key={bucket.label} className={`rounded-lg border border-slate-200 p-3 ${bucket.className}`}>
                <div className="text-xs font-semibold">{bucket.label}</div>
                <div className="mt-2 text-sm font-bold tabular-nums">{formatRupiah(bucket.value)}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-[1080px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">No PI</th>
                  <th className="px-4 py-3 text-center font-semibold">Tanggal PI</th>
                  <th className="px-4 py-3 text-center font-semibold">Jatuh Tempo</th>
                  <th className="px-4 py-3 text-center font-semibold">Termin</th>
                  <th className="px-4 py-3 text-center font-semibold">Umur PI</th>
                  <th className="px-4 py-3 text-center font-semibold">Overdue</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Aging</th>
                  <th className="px-4 py-3 text-right font-semibold">Hutang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendor.invoices.map((invoice) => (
                  <tr key={invoice.noPi} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{invoice.noPi}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{formatDateIndonesia(invoice.tglBeli)}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{formatDateIndonesia(invoice.dueDate)}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-slate-700">
                      {formatNumber(invoice.tempoHari)} hari
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-slate-700">
                      {formatNumber(invoice.daysSincePi)} hari
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-slate-700">
                      {formatOverdueDays(invoice.overdueDays)}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700">{invoice.paymentState}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{agingLabels[invoice.agingBucket]}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {formatRupiah(invoice.hutang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ itemName: string; currentPrice: number } | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorDebtRow | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [vendorPage, setVendorPage] = useState(1);
  const [materialPage, setMaterialPage] = useState(1);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const queryString = params.toString();
      const res = await fetch(`/api/dashboard-stats${queryString ? `?${queryString}` : ''}`);
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
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    setVendorPage(1);
  }, [vendorSearch, dateFrom, dateTo]);

  useEffect(() => {
    setMaterialPage(1);
  }, [materialSearch, dateFrom, dateTo]);

  const filteredVendorDebts = useMemo(() => {
    const keyword = vendorSearch.trim().toLowerCase();
    if (!keyword) return stats.vendorDebts;
    return stats.vendorDebts.filter((row) => row.vendorName.toLowerCase().includes(keyword));
  }, [stats.vendorDebts, vendorSearch]);

  const vendorPageCount = Math.max(1, Math.ceil(filteredVendorDebts.length / VENDOR_PAGE_SIZE));
  const currentVendorPage = Math.min(vendorPage, vendorPageCount);

  const paginatedVendorDebts = useMemo(() => {
    const startIndex = (currentVendorPage - 1) * VENDOR_PAGE_SIZE;
    return filteredVendorDebts.slice(startIndex, startIndex + VENDOR_PAGE_SIZE);
  }, [currentVendorPage, filteredVendorDebts]);

  const filteredMaterialTrends = useMemo(() => {
    const keyword = materialSearch.trim().toLowerCase();
    if (!keyword) return stats.materialTrends;
    return stats.materialTrends.filter((row) => row.itemName.toLowerCase().includes(keyword));
  }, [materialSearch, stats.materialTrends]);

  const materialPageCount = Math.max(1, Math.ceil(filteredMaterialTrends.length / MATERIAL_PAGE_SIZE));
  const currentMaterialPage = Math.min(materialPage, materialPageCount);

  const paginatedMaterialTrends = useMemo(() => {
    const startIndex = (currentMaterialPage - 1) * MATERIAL_PAGE_SIZE;
    return filteredMaterialTrends.slice(startIndex, startIndex + MATERIAL_PAGE_SIZE);
  }, [currentMaterialPage, filteredMaterialTrends]);

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

  const dateDescription = useMemo(() => {
    if (dateFrom && dateTo) return `${formatDateIndonesia(dateFrom)} - ${formatDateIndonesia(dateTo)}`;
    if (dateFrom) return `Mulai ${formatDateIndonesia(dateFrom)}`;
    if (dateTo) return `Sampai ${formatDateIndonesia(dateTo)}`;
    return 'Material memakai seluruh histori RAW - PI, hutang vendor menampilkan seluruh outstanding.';
  }, [dateFrom, dateTo]);

  const materialMetricDescription = useMemo(() => {
    if (dateFrom || dateTo) return 'Metrik harga bahan mengikuti filter tanggal aktif.';
    return 'Metrik harga bahan dihitung dari seluruh histori RAW - PI.';
  }, [dateFrom, dateTo]);

  const resetFilters = () => {
    setVendorSearch('');
    setMaterialSearch('');
    setDateFrom('');
    setDateTo('');
  };

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
            <p>Monitor hutang vendor dan perubahan harga bahan RAW - PI.</p>
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

          <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
              <CalendarDays size={18} />
              Filter Dashboard
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cari Vendor
                </span>
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={vendorSearch}
                    onChange={(event) => setVendorSearch(event.target.value)}
                    placeholder="Ketik nama vendor..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tanggal Mulai
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tanggal Akhir
                </span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>

              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <X size={16} />
                Reset
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">{dateDescription}</p>
          </section>

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
                Bahan RAW - PI
              </div>
              <div className="mt-2 text-lg font-bold text-slate-900">{formatNumber(totals.materialCount)}</div>
            </div>
          </div>

          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Tabel Hutang Vendor</h3>
                <p className="text-sm text-slate-500">
                  Menampilkan {formatNumber(paginatedVendorDebts.length)} dari {formatNumber(filteredVendorDebts.length)} vendor.
                </p>
              </div>
              {stats.generatedAt && (
                <span className="text-xs text-slate-400">
                  Update: {new Date(stats.generatedAt).toLocaleString('id-ID')}
                </span>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[1080px] w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-center font-semibold">Vendor Name</th>
                    <th className="px-4 py-3 text-center font-semibold">Total Debt</th>
                    <th className="px-4 py-3 text-center font-semibold">Belum Jatuh Tempo</th>
                    <th className="bg-amber-50 px-4 py-3 text-center font-semibold text-amber-700">
                      <AgingHeader value="0 - 7" />
                    </th>
                    <th className="bg-orange-50 px-4 py-3 text-center font-semibold text-orange-700">
                      <AgingHeader value="8 - 14" />
                    </th>
                    <th className="bg-red-50 px-4 py-3 text-center font-semibold text-red-700">
                      <AgingHeader value="15 - 21" />
                    </th>
                    <th className="bg-red-100 px-4 py-3 text-center font-semibold text-red-800">
                      <AgingHeader value="> 21" />
                    </th>
                    <th className="px-4 py-3 text-center font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        <Loader2 size={24} className="pulse mx-auto mb-2 text-teal-700" />
                        Memuat data hutang vendor...
                      </td>
                    </tr>
                  ) : filteredVendorDebts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        Tidak ada hutang vendor yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedVendorDebts.map((row) => (
                      <tr
                        key={row.vendorId}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setSelectedVendor(row)}
                      >
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
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-full p-2 text-slate-500 transition hover:bg-teal-50 hover:text-teal-700"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedVendor(row);
                            }}
                            aria-label={`Lihat detail hutang ${row.vendorName}`}
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Maksimal {formatNumber(VENDOR_PAGE_SIZE)} vendor per halaman.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={currentVendorPage <= 1}
                  onClick={() => setVendorPage((page) => Math.max(1, page - 1))}
                >
                  <ChevronLeft size={16} />
                  Prev
                </button>
                <span className="min-w-24 text-center text-sm font-semibold text-slate-700">
                  {currentVendorPage} / {vendorPageCount}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={currentVendorPage >= vendorPageCount}
                  onClick={() => setVendorPage((page) => Math.min(vendorPageCount, page + 1))}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Tabel Pembelian Bahan</h3>
                <p className="text-sm text-slate-500">
                  Menampilkan {formatNumber(paginatedMaterialTrends.length)} dari {formatNumber(filteredMaterialTrends.length)} bahan. {materialMetricDescription}
                </p>
              </div>
              <label className="block w-full lg:max-w-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cari Bahan
                </span>
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={materialSearch}
                    onChange={(event) => setMaterialSearch(event.target.value)}
                    placeholder="Ketik nama bahan..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </div>
              </label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[860px] w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Item Name</th>
                    <th className="px-4 py-3 text-right font-semibold">Harga Terakhir</th>
                    <th className="px-4 py-3 text-right font-semibold">Terendah Filter</th>
                    <th className="px-4 py-3 text-right font-semibold">Tertinggi Filter</th>
                    <th className="px-4 py-3 text-center font-semibold">Trend</th>
                    <th className="px-4 py-3 text-right font-semibold">Jumlah Pembelian</th>
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
                  ) : filteredMaterialTrends.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        {stats.materialTrends.length === 0
                          ? 'Belum ada nama bahan dari RAW - PI.'
                          : 'Tidak ada bahan yang sesuai pencarian.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedMaterialTrends.map((row) => (
                      <tr
                        key={row.itemName}
                        className="cursor-pointer hover:bg-teal-50"
                        onClick={() => setSelectedItem({ itemName: row.itemName, currentPrice: row.currentPrice })}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{row.itemName}</div>
                          <div className="text-xs text-slate-400">Terakhir: {formatDateIndonesia(row.lastPurchaseDate)}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                          {formatRupiah(row.currentPrice)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                          {formatRangePrice(row.lowestPrice30d, row.purchaseCount30d)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-700">
                          {formatRangePrice(row.highestPrice30d, row.purchaseCount30d)}
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

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Maksimal {formatNumber(MATERIAL_PAGE_SIZE)} bahan per halaman.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={currentMaterialPage <= 1}
                  onClick={() => setMaterialPage((page) => Math.max(1, page - 1))}
                >
                  <ChevronLeft size={16} />
                  Prev
                </button>
                <span className="min-w-24 text-center text-sm font-semibold text-slate-700">
                  {currentMaterialPage} / {materialPageCount}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={currentMaterialPage >= materialPageCount}
                  onClick={() => setMaterialPage((page) => Math.min(materialPageCount, page + 1))}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {selectedVendor && <VendorDebtModal vendor={selectedVendor} onClose={() => setSelectedVendor(null)} />}

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
