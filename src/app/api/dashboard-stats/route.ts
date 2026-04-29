import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
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

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [debtInvoices, purchaseItems] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where: {
          paymentState: { not: 'paid' },
          hutang: { gt: 0 },
        },
        include: {
          vendor: true,
        },
      }),
      prisma.invoiceItem.findMany({
        where: {
          invoice: {
            tglBeli: { gte: thirtyDaysAgo },
          },
        },
        include: {
          invoice: {
            include: {
              vendor: true,
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
      const vendorName = invoice.vendor.name;
      const amount = decimalToNumber(invoice.hutang);
      const agingKey = getAgingKey(invoice.tempoHari);
      const row = vendorDebtMap.get(vendorName) ?? {
        vendorName,
        totalDebt: 0,
        belumJatuhTempo: 0,
        days0To7: 0,
        days8To14: 0,
        days15To21: 0,
        daysOver21: 0,
      };

      row.totalDebt += amount;
      row[agingKey] += amount;
      vendorDebtMap.set(vendorName, row);
    }

    const itemMap = new Map<string, typeof purchaseItems>();

    for (const item of purchaseItems) {
      const itemName = item.namaBarang.trim() || 'Tanpa Nama Barang';
      const existing = itemMap.get(itemName) ?? [];
      existing.push(item);
      itemMap.set(itemName, existing);
    }

    const materialTrends: MaterialTrendRow[] = Array.from(itemMap.entries()).map(([itemName, items]) => {
      const prices = items.map((item) => decimalToNumber(item.hargaPI)).filter((price) => price > 0);
      const latest = items[0];
      const previous = items[1];
      const currentPrice = decimalToNumber(latest?.hargaPI);
      const previousPrice = decimalToNumber(previous?.hargaPI);

      let trend: MaterialTrendRow['trend'] = 'flat';
      if (previous && currentPrice > previousPrice) trend = 'up';
      if (previous && currentPrice < previousPrice) trend = 'down';

      return {
        itemName,
        currentPrice,
        lowestPrice30d: prices.length > 0 ? Math.min(...prices) : 0,
        highestPrice30d: prices.length > 0 ? Math.max(...prices) : 0,
        trend,
        lastPurchaseDate: latest?.invoice.tglBeli.toISOString().split('T')[0] ?? '',
        purchaseCount30d: items.length,
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
