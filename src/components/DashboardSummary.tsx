'use client';

import React from 'react';
import { formatRupiah, formatNumber } from '@/lib/format';
import {
  FileText,
  DollarSign,
  CheckCircle2,
  Users,
  TrendingUp,
} from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'purple' | 'rose';
  format?: 'rupiah' | 'number' | 'none';
}

function StatCard({ label, value, icon, color, format = 'none' }: StatCardProps) {
  const formattedValue = format === 'rupiah'
    ? formatRupiah(value)
    : format === 'number'
      ? formatNumber(value)
      : value;

  const colorMap: Record<string, string> = {
    blue: '#0f766e',
    green: '#059669',
    amber: '#d97706',
    purple: '#7c3aed',
    rose: '#e11d48',
  };

  return (
    <div className={`stat-card ${color}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ color: colorMap[color] }}>
            {formattedValue}
          </div>
        </div>
        <div style={{
          width: 44,
          height: 44,
          flex: '0 0 44px',
          borderRadius: 8,
          background: `${colorMap[color]}12`,
          border: `1px solid ${colorMap[color]}24`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colorMap[color],
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

interface DashboardSummaryProps {
  totalPI: number;
  totalHutang: number;
  totalSelected: number;
  totalSelectedNominal: number;
  uniqueVendors: number;
}

export default function DashboardSummary({
  totalPI,
  totalHutang,
  totalSelected,
  totalSelectedNominal,
  uniqueVendors,
}: DashboardSummaryProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
      gap: 12,
      marginBottom: 24,
    }}>
      <StatCard
        label="Total PI Unpaid"
        value={totalPI}
        icon={<FileText size={22} />}
        color="blue"
        format="number"
      />
      <StatCard
        label="Total Hutang"
        value={totalHutang}
        icon={<DollarSign size={22} />}
        color="rose"
        format="rupiah"
      />
      <StatCard
        label="PI Dipilih"
        value={totalSelected}
        icon={<CheckCircle2 size={22} />}
        color="green"
        format="number"
      />
      <StatCard
        label="Nominal Dipilih"
        value={totalSelectedNominal}
        icon={<TrendingUp size={22} />}
        color="amber"
        format="rupiah"
      />
      <StatCard
        label="Vendor Dipilih"
        value={uniqueVendors}
        icon={<Users size={22} />}
        color="purple"
        format="number"
      />
    </div>
  );
}
