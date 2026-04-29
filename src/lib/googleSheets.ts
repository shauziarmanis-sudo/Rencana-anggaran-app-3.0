// ============================================================
// Google Sheets API Client
// ============================================================

import { google, sheets_v4 } from 'googleapis';
import { SHEET_NAMES, PAYABLE_COLUMNS, FAKTUR_COLUMNS, REKENING_COLUMNS, PI_COLUMNS } from './constants';
import { parseSpreadsheetNumber } from './format';
import type { RawPayable, LaporanFaktur, MasterRekening, PIItem } from '@/types/finance';

// Server-side cache
let sheetsClient: sheets_v4.Sheets | null = null;
const cache = new Map<string, { data: string[][]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize Google Sheets API client with service account
 */
function getClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

/**
 * Get raw data from a sheet with caching
 */
export async function getSheetData(sheetName: string): Promise<string[][]> {
  const cacheKey = sheetName;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const client = getClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID is not configured');
    }

    const response = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'`,
    });

    const rows = response.data.values || [];
    cache.set(cacheKey, { data: rows as string[][], timestamp: Date.now() });

    return rows as string[][];
  } catch (error) {
    console.error(`Error fetching sheet "${sheetName}":`, error);
    // Return cached data if available (even if stale)
    if (cached) return cached.data;
    throw error;
  }
}

/**
 * Clear all cached data
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get unpaid invoices from RAW - Payable
 */
export async function getUnpaidPayables(): Promise<RawPayable[]> {
  const rows = await getSheetData(SHEET_NAMES.RAW_PAYABLE);
  if (rows.length <= 1) return []; // Only header or empty

  // Skip header row
  return rows.slice(1)
    .filter(row => {
      const paymentState = row[PAYABLE_COLUMNS.PAYMENT_STATE]?.toLowerCase();
      return paymentState === 'unpaid';
    })
    .map(row => ({
      currency: row[PAYABLE_COLUMNS.CURRENCY] || 'IDR',
      vendorCode: row[PAYABLE_COLUMNS.VENDOR_CODE] || '',
      vendorName: row[PAYABLE_COLUMNS.VENDOR_NAME] || '',
      company: row[PAYABLE_COLUMNS.COMPANY] || '',
      warehouseCode: row[PAYABLE_COLUMNS.WAREHOUSE_CODE] || '',
      warehouseName: row[PAYABLE_COLUMNS.WAREHOUSE_NAME] || '',
      purchaseInvoiceCode: row[PAYABLE_COLUMNS.PURCHASE_INVOICE_CODE] || '',
      transactionAt: row[PAYABLE_COLUMNS.TRANSACTION_AT] || '',
      dueAt: row[PAYABLE_COLUMNS.DUE_AT] || '',
      dueIn: parseSpreadsheetNumber(row[PAYABLE_COLUMNS.DUE_IN]),
      paymentState: row[PAYABLE_COLUMNS.PAYMENT_STATE] || '',
      paymentDueState: row[PAYABLE_COLUMNS.PAYMENT_DUE_STATE] || '',
      payableAmount: parseSpreadsheetNumber(row[PAYABLE_COLUMNS.PAYABLE_AMOUNT]),
      paymentAmount: parseSpreadsheetNumber(row[PAYABLE_COLUMNS.PAYMENT_AMOUNT]),
      refundAmount: parseSpreadsheetNumber(row[PAYABLE_COLUMNS.REFUND_AMOUNT]),
      writeoffAmount: parseSpreadsheetNumber(row[PAYABLE_COLUMNS.WRITEOFF_AMOUNT]),
      payableDue: parseSpreadsheetNumber(row[PAYABLE_COLUMNS.PAYABLE_DUE]),
    }));
}

/**
 * Get laporan faktur pembelian data
 */
export async function getLaporanFakturPembelian(): Promise<LaporanFaktur[]> {
  const rows = await getSheetData(SHEET_NAMES.LAPORAN_FAKTUR);
  if (rows.length <= 1) return [];

  return rows.slice(1).map(row => ({
    vendorName: row[FAKTUR_COLUMNS.VENDOR_NAME] || '',
    purchaseInvoiceCode: row[FAKTUR_COLUMNS.PURCHASE_INVOICE_CODE] || '',
    tglFaktur: row[FAKTUR_COLUMNS.TGL_FAKTUR] || '',
    paymentTermName: row[FAKTUR_COLUMNS.PAYMENT_TERM_NAME] || '',
    description: row[FAKTUR_COLUMNS.DESCRIPTION] || '',
    sumItemGrandAmount: parseSpreadsheetNumber(row[FAKTUR_COLUMNS.SUM_ITEM_GRAND_AMOUNT]),
    reference: row[FAKTUR_COLUMNS.REFERENCE] || '',
    tglPembelian: row[FAKTUR_COLUMNS.TGL_PEMBELIAN] || '',
    terhutang: parseSpreadsheetNumber(row[FAKTUR_COLUMNS.TERHUTANG]),
    umurHutang: parseSpreadsheetNumber(row[FAKTUR_COLUMNS.UMUR_HUTANG]),
    alamatBaris1: row[FAKTUR_COLUMNS.ALAMAT_BARIS_1] || '',
  }));
}

/**
 * Get master rekening data
 */
export async function getMasterRekening(): Promise<MasterRekening[]> {
  const rows = await getSheetData(SHEET_NAMES.MASTER_REKENING);
  if (rows.length <= 1) return [];

  return rows.slice(1).map(row => ({
    namaVendor: row[REKENING_COLUMNS.NAMA_VENDOR] || '',
    namaPenerima: row[REKENING_COLUMNS.NAMA_PENERIMA] || '',
    noRekening: row[REKENING_COLUMNS.NO_REKENING] || '',
    namaBank: row[REKENING_COLUMNS.NAMA_BANK] || '',
  }));
}

/**
 * Get RAW - PI items (Purchase Invoice line items)
 * Returns item-level detail keyed by Purchase Invoice Code
 */
export async function getRawPIItems(): Promise<PIItem[]> {
  const rows = await getSheetData(SHEET_NAMES.RAW_PI);
  if (rows.length <= 1) return [];

  return rows.slice(1).map(row => ({
    purchaseInvoiceCode: row[PI_COLUMNS.PURCHASE_INVOICE_CODE] || '',
    vendorName: row[PI_COLUMNS.VENDOR_NAME] || '',
    itemName: row[PI_COLUMNS.ITEM_NAME] || '',
    quantity: parseSpreadsheetNumber(row[PI_COLUMNS.QUANTITY]),
    itemPrice: parseSpreadsheetNumber(row[PI_COLUMNS.ITEM_PRICE]),
    itemGrandAmount: parseSpreadsheetNumber(row[PI_COLUMNS.ITEM_GRAND_AMOUNT]),
    unitName: row[PI_COLUMNS.UNIT_NAME] || '',
    description: row[PI_COLUMNS.DESCRIPTION] || '',
    tglFaktur: row[PI_COLUMNS.TGL_FAKTUR] || '',
    tglPembelian: row[PI_COLUMNS.TGL_PEMBELIAN] || '',
    totalRencanaBayar: parseSpreadsheetNumber(row[PI_COLUMNS.TOTAL_RENCANA_BAYAR]),
    hutang: parseSpreadsheetNumber(row[PI_COLUMNS.HUTANG]),
    qtyPS: parseSpreadsheetNumber(row[PI_COLUMNS.QTY_PS]),
    hargaPS: parseSpreadsheetNumber(row[PI_COLUMNS.HARGA_PS]),
    nomorRekening: row[PI_COLUMNS.NOMOR_REKENING] || '',
    namaRekening: row[PI_COLUMNS.NAMA_REKENING] || '',
  }));
}

/**
 * Append log data to LOG sheet  
 */
export async function appendToLogSheet(logRow: string[]): Promise<void> {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID is not configured');
    }

    await client.spreadsheets.values.append({
      spreadsheetId,
      range: `'${SHEET_NAMES.LOG}'!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [logRow],
      },
    });
  } catch (error) {
    console.error('Error appending to LOG sheet:', error);
    // Don't throw - logging failure shouldn't block operations
  }
}
