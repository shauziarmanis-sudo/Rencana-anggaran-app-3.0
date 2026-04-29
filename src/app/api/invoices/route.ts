// ============================================================
// API Route: Search Invoice Files in Google Drive
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { searchMultiplePI } from '@/lib/googleDrive';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { piList } = body;

    if (!piList || !Array.isArray(piList) || piList.length === 0) {
      return NextResponse.json(
        { success: false, error: 'piList is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // Search invoices for all PIs
    const invoiceMap = await searchMultiplePI(piList);

    // Convert Map to serializable object
    const invoiceData: Record<string, { name: string; webViewLink: string; mimeType: string; id: string }[]> = {};
    invoiceMap.forEach((files, piNumber) => {
      invoiceData[piNumber] = files;
    });

    const foundCount = Object.values(invoiceData).filter(files => files.length > 0).length;
    const notFoundCount = piList.length - foundCount;

    return NextResponse.json({
      success: true,
      data: invoiceData,
      meta: {
        totalSearched: piList.length,
        found: foundCount,
        notFound: notFoundCount,
      },
    });
  } catch (error) {
    console.error('Error searching invoices:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search invoices',
      },
      { status: 500 }
    );
  }
}
