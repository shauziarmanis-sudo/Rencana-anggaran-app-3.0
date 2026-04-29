// ============================================================
// API Route: Fetch Audit Logs
// ============================================================

import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';
import { SHEET_NAMES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await getSheetData(SHEET_NAMES.LOG);

    if (rows.length <= 1) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Parse log rows (skip header)
    const logs = rows.slice(1).reverse().map(row => ({
      timestamp: row[0] || '',
      action: row[1] || '',
      user: row[2] || '',
      piCount: row[3] || '0',
      piList: row[4] || '',
      totalNominal: row[5] || '0',
      recipient: row[6] || '',
      cc: row[7] || '',
      status: row[8] || '',
      invoiceFound: row[9] || '0',
      invoiceNotFound: row[10] || '0',
      errorMessage: row[11] || '',
    }));

    return NextResponse.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch logs',
      },
      { status: 500 }
    );
  }
}
