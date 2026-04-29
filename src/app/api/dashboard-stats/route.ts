import { NextRequest, NextResponse } from 'next/server';
import { Prisma, PrismaClient } from '@prisma/client';
import { decimalToNumber } from '@/lib/decimal';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

type AgingKey =
  | 'belumJatuhTempo'
  | 'days0To7'
  | 'days8To14'
  | 'days15To21'
  | 'daysOver21';

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

interface VendorDebtDetail {
  noPi: string;
  tglBeli: string;
  tempoHari: number;
  paymentState: string;
  hutang: number;
  agingBucket: AgingKey;
}

interface MaterialTrendRow {
  itemName: string;
  currentPrice: number;
  lowestPrice30d: number;
  highestPrice30d: number;
  trend: 'up' | 'down' | 'flat';
  lastPurchaseDate: string;
  purchaseCount30d: number;
}

function getAgingKey(tempoHari: number): AgingKey {
  if (tempoHari > 0) return 'belumJatuhTempo';

  const overdueDays = Math.abs(tempoHari);
  if (overdueDays <= 7) return 'days0To7';
  if (overdueDays <= 14) return 'days8To14';
  if (overdueDays <= 21) return 'days15To21';
  return 'daysOver21';
}

function parseDateParam(value: string | null, boundary: 'start' | 'end'): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  const [year, month, day] = value.split('-').map(Number);
  const date =
    boundary === 'start'
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildDateFilter(startDate?: Date, endDate?: Date): Prisma.DateTimeFilter | undefined {
  if (!startDate && !endDate) return undefined;

  return {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {}),
  };
}

function isWithinRange(date: Date, startDate?: Date, endDate?: Date): boolean {
  const timestamp = date.getTime();
  if (startDate && timestamp < startDate.getTime()) return false;
  if (endDate && timestamp > endDate.getTime()) return false;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = parseDateParam(searchParams.get('dateFrom'), 'start');
    const endDate = parseDateParam(searchParams.get('dateTo'), 'end');
    const invoiceDateFilter = buildDateFilter(startDate, endDate);

    const defaultMaterialStartDate = new Date();
    defaultMaterialStartDate.setDate(defaultMaterialStartDate.getDate() - 30);
    defaultMaterialStartDate.setHours(0, 0, 0, 0);

    const hasExplicitDateFilter = Boolean(startDate || endDate);
    const materialStartDate = hasExplicitDateFilter ? startDate : defaultMaterialStartDate;
    const materialEndDate = endDate;

    const [debtInvoices, allPurchaseItems] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where: {
          paymentState: { not: 'paid' },
          hutang: { gt: 0 },
          ...(invoiceDateFilter ? { tglBeli: invoiceDateFilter } : {}),
        },
        include: {
          vendor: true,
        },
      }),
      prisma.invoiceItem.findMany({
        select: {
          namaBarang: true,
          hargaPI: true,
          createdAt: true,
          invoice: {
            select: {
              tglBeli: true,
            },
          },
        },
        orderBy: [
          { invoice: { tglBeli: 'desc' } },
          { createdAt: 'desc' },
        ],
      }),
    ]);

    const vendorDebtMap = new Map<string, VendorDebtRow>();

    for (const invoice of debtInvoices) {
      const vendorId = invoice.vendorId;
      const vendorName = invoice.vendor.name;
      const amount = decimalToNumber(invoice.hutang);
      const agingKey = getAgingKey(invoice.tempoHari);
      const row = vendorDebtMap.get(vendorId) ?? {
        vendorId,
        vendorName,
        totalDebt: 0,
        belumJatuhTempo: 0,
        days0To7: 0,
        days8To14: 0,
        days15To21: 0,
        daysOver21: 0,
        invoices: [],
      };

      row.totalDebt += amount;
      row[agingKey] += amount;
      row.invoices.push({
        noPi: invoice.noPi,
        tglBeli: invoice.tglBeli.toISOString().split('T')[0],
        tempoHari: invoice.tempoHari,
        paymentState: invoice.paymentState,
        hutang: amount,
        agingBucket: agingKey,
      });
      vendorDebtMap.set(vendorId, row);
    }

    const itemMap = new Map<string, typeof allPurchaseItems>();

    for (const item of allPurchaseItems) {
      const itemName = item.namaBarang.trim() || 'Tanpa Nama Barang';
      const existing = itemMap.get(itemName) ?? [];
      existing.push(item);
      itemMap.set(itemName, existing);
    }

    const materialTrends: MaterialTrendRow[] = Array.from(itemMap.entries()).map(([itemName, items]) => {
      const latestAllTime = items[0];
      const rangeItems = items.filter((item) => isWithinRange(item.invoice.tglBeli, materialStartDate, materialEndDate));
      const prices = rangeItems.map((item) => decimalToNumber(item.hargaPI)).filter((price) => price > 0);
      const latestInRange = rangeItems[0];
      const previousInRange = rangeItems[1];
      const currentPrice = decimalToNumber(latestAllTime?.hargaPI);
      const latestRangePrice = decimalToNumber(latestInRange?.hargaPI);
      const previousRangePrice = decimalToNumber(previousInRange?.hargaPI);

      let trend: MaterialTrendRow['trend'] = 'flat';
      if (previousInRange && latestRangePrice > previousRangePrice) trend = 'up';
      if (previousInRange && latestRangePrice < previousRangePrice) trend = 'down';

      return {
        itemName,
        currentPrice,
        lowestPrice30d: prices.length > 0 ? Math.min(...prices) : 0,
        highestPrice30d: prices.length > 0 ? Math.max(...prices) : 0,
        trend,
        lastPurchaseDate: latestAllTime?.invoice.tglBeli.toISOString().split('T')[0] ?? '',
        purchaseCount30d: rangeItems.length,
      };
    });

    materialTrends.sort((a, b) => a.itemName.localeCompare(b.itemName));

    const vendorDebts = Array.from(vendorDebtMap.values()).sort((a, b) => b.totalDebt - a.totalDebt);

    return NextResponse.json({
      success: true,
      data: {
        vendorDebts,
        materialTrends,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard stats',
      },
      { status: 500 }
    );
  }
}
