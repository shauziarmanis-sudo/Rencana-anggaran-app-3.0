import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';
import { SHEET_NAMES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pi = await getSheetData(SHEET_NAMES.RAW_PI);
    const ps = await getSheetData(SHEET_NAMES.RAW_PS);
    return NextResponse.json({
      piHeaders: pi[0],
      psHeaders: ps[0],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
