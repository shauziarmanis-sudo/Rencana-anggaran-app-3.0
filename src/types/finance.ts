// ============================================================
// Types for Rencana Anggaran - Central Kitchen
// ============================================================

/** RAW - Payable row from Google Sheets */
export interface RawPayable {
  currency: string;
  vendorCode: string;
  vendorName: string;
  company: string;
  warehouseCode: string;
  warehouseName: string;
  purchaseInvoiceCode: string; // PI number
  transactionAt: string;
  dueAt: string;
  dueIn: number;
  paymentState: string; // 'unpaid' | 'paid' | 'partial'
  paymentDueState: string; // 'late' | 'on_time' etc
  payableAmount: number;
  paymentAmount: number;
  refundAmount: number;
  writeoffAmount: number;
  payableDue: number;
}

/** RAW - PI item line (from Purchase Invoice sheet, per-item row) */
export interface PIItem {
  purchaseInvoiceCode: string;
  vendorName: string;
  itemName: string;
  quantity: number;
  itemPrice: number;
  itemGrandAmount: number;
  unitName: string;
  description: string;
  tglFaktur: string;
  tglPembelian: string;
  totalRencanaBayar: number;
  hutang: number;
  qtyPS: number;
  hargaPS: number;
  nomorRekening: string;
  namaRekening: string;
}

/** Laporan Faktur Pembelian */
export interface LaporanFaktur {
  vendorName: string;
  purchaseInvoiceCode: string;
  tglFaktur: string;
  paymentTermName: string;
  description: string;
  sumItemGrandAmount: number;
  reference: string;
  tglPembelian: string;
  terhutang: number;
  umurHutang: number;
  alamatBaris1: string;
}

/** Laporan Pembelian Barang */
export interface LaporanPembelianBarang {
  purchaseInvoiceCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  vendorName: string;
  [key: string]: string | number;
}

/** Master Rekening */
export interface MasterRekening {
  namaVendor: string;
  namaPenerima: string;
  noRekening: string;
  namaBank: string;
  [key: string]: string;
}

/** Dashboard Rencana Anggaran row (for PI selection) */
export interface RencanaAnggaranRow {
  id: string; // unique row id
  noPi: string;
  tglBeli: string;
  namaSupplier: string;
  namaPenerima: string;
  noRekening: string;
  totalPembelian: number;
  hutang: number;
  tempo: number;
  paymentState: string;
  paymentDueState: string;
  vendorCode: string;
  perusahaan?: string;
}

/** Item detail row within an invoice (for full rekap table) */
export interface RekapItemRow {
  namaBarang: string;
  keterangan: string;
  qtyPI: number;
  qtyPS: number;
  hargaPI: number;
  hargaPS: number;
}

/** Rekap Anggaran row (one per invoice, with item sub-rows) */
export interface RekapAnggaranRow {
  namaVendor: string;
  nomorInvoice: string;
  tglFaktur: string;
  namaRekening: string;
  nomorRekening: string;
  totalRencanaBayar: number;
  hutang: number;
  items: RekapItemRow[];
  invoiceLinks: InvoiceFile[];
  warningFlag?: string;
}

/** Rekap grouped by vendor */
export interface RekapVendorGroup {
  vendorName: string;
  rows: RekapAnggaranRow[];
  subtotal: number;
}

/** Invoice file from Google Drive */
export interface InvoiceFile {
  name: string;
  webViewLink: string;
  mimeType: string;
  id: string;
}

/** Email payload for sending approval */
export interface EmailPayload {
  to: string;
  cc?: string;
  subject: string;
  htmlBody: string;
  directorName: string;
  totalPI: number;
  totalNominal: number;
  piList: string[];
}

/** Log entry for audit trail */
export interface LogEntry {
  timestamp: string;
  action: string;
  user: string;
  piCount: number;
  piList: string[];
  totalNominal: number;
  recipient: string;
  cc: string;
  status: 'success' | 'failed';
  invoiceFoundCount: number;
  invoiceNotFoundCount: number;
  errorMessage?: string;
}

/** Summary stats */
export interface DashboardSummary {
  totalPI: number;
  totalHutang: number;
  totalSelected: number;
  totalSelectedNominal: number;
  uniqueVendors: number;
}

/** App settings */
export interface AppSettings {
  directorName: string;
  toEmail: string;
  ccEmail: string;
  driveFolderId: string;
}

/** API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
