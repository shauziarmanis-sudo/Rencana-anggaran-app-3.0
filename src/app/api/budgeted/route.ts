// ============================================================
// API Route: Budgeted PIs (Arsip Anggaran)
// GET  — List all budgeted PIs
// POST — Return a PI back to Modal Anggaran
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

// GET: List all budgeted PIs
export async function GET() {
  try {
    const budgetedInvoices = await prisma.purchaseInvoice.findMany({
      where: { budgetStatus: 'budgeted' },
      include: {
        vendor: true,
        company: true,
      },
      orderBy: { budgetedAt: 'desc' },
    });

    const rows = budgetedInvoices.map(inv => ({
      id: inv.id,
      noPi: inv.noPi,
      vendorName: inv.vendor.name,
      companyName: inv.company.name,
      totalRencanaBayar: inv.totalRencanaBayar,
      hutang: inv.hutang,
      budgetedAt: inv.budgetedAt?.toISOString() || '',
      budgetedBy: inv.budgetedBy || '-',
      tglBeli: inv.tglBeli.toISOString().split('T')[0],
    }));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching budgeted PIs:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch' },
      { status: 500 }
    );
  }
}

// POST: Return PI back to Modal Anggaran
export async function POST(req: NextRequest) {
  try {
    const { piId } = await req.json();

    if (!piId) {
      return NextResponse.json({ success: false, error: 'piId is required' }, { status: 400 });
    }

    await prisma.purchaseInvoice.update({
      where: { id: piId },
      data: {
        budgetStatus: 'returned',
        budgetedAt: null,
        budgetedBy: null,
      },
    });

    return NextResponse.json({ success: true, message: 'PI berhasil dikembalikan ke Modal Anggaran' });
  } catch (error) {
    console.error('Error returning PI:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to return PI' },
      { status: 500 }
    );
  }
}
