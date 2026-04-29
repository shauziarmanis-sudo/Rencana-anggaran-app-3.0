import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { piList, company } = body as { piList: { noPi: string; vendorName?: string; company?: string }[]; company?: string };

    if (!piList || !Array.isArray(piList) || piList.length === 0) {
      return NextResponse.json({ success: false, error: 'piList wajib diisi (array of { noPi, vendorName?, company? })' }, { status: 400 });
    }

    const results: { matched: string[]; notFound: string[]; errors: string[] } = {
      matched: [],
      notFound: [],
      errors: [],
    };

    // Find all matching invoices from database
    const piNumbers = piList.map(p => p.noPi.trim());
    
    const existingInvoices = await prisma.purchaseInvoice.findMany({
      where: { noPi: { in: piNumbers } },
      select: { id: true, noPi: true }
    });

    const existingMap = new Map(existingInvoices.map(inv => [inv.noPi, inv.id]));

    piNumbers.forEach(pi => {
      if (existingMap.has(pi)) {
        results.matched.push(pi);
      } else {
        results.notFound.push(pi);
      }
    });

    const matchedItems: { id: string; noPi: string; company: string }[] = [];
    piList.forEach(p => {
      const id = existingMap.get(p.noPi);
      if (id) {
        matchedItems.push({ id, noPi: p.noPi, company: p.company || '' });
      }
    });

    // Return matched IDs for auto-selection
    const matchedIds = existingInvoices.map(inv => inv.id);

    return NextResponse.json({
      success: true,
      data: {
        matchedIds,
        matchedItems,
        matched: results.matched,
        notFound: results.notFound,
        totalMatched: results.matched.length,
        totalNotFound: results.notFound.length,
      }
    });
  } catch (error: any) {
    console.error('Bulk select error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
