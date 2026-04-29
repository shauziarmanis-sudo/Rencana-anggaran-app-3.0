// ============================================================
// Data Transformation: Join Payable + Faktur + Rekening + PI Items
// ============================================================

import type {
  RawPayable,
  LaporanFaktur,
  MasterRekening,
  PIItem,
  RencanaAnggaranRow,
  RekapAnggaranRow,
  RekapItemRow,
  RekapVendorGroup,
  InvoiceFile,
} from '@/types/finance';
import { formatDateIndonesia } from './format';

/**
 * Join RAW - Payable with Laporan Faktur and Master Rekening
 * to produce the dashboard data for PI selection
 */
export function buildRencanaAnggaranData(
  payables: RawPayable[],
  fakturList: LaporanFaktur[],
  masterRekening: MasterRekening[]
): RencanaAnggaranRow[] {
  // Build lookup maps
  const fakturMap = new Map<string, LaporanFaktur>();
  fakturList.forEach(f => {
    if (f.purchaseInvoiceCode) {
      fakturMap.set(f.purchaseInvoiceCode.trim(), f);
    }
  });

  const rekeningMap = new Map<string, MasterRekening>();
  masterRekening.forEach(r => {
    if (r.namaVendor) {
      rekeningMap.set(r.namaVendor.trim().toLowerCase(), r);
    }
  });

  return payables.map((p, index) => {
    const faktur = fakturMap.get(p.purchaseInvoiceCode.trim());
    const rekening = rekeningMap.get(p.vendorName.trim().toLowerCase());

    return {
      id: `pi-${index}-${p.purchaseInvoiceCode}`,
      noPi: p.purchaseInvoiceCode,
      tglBeli: faktur
        ? formatDateIndonesia(faktur.tglPembelian || faktur.tglFaktur)
        : formatDateIndonesia(p.transactionAt),
      namaSupplier: p.vendorName,
      namaPenerima: rekening?.namaPenerima || '-',
      noRekening: rekening ? `${rekening.noRekening} (${rekening.namaBank})` : '-',
      totalPembelian: faktur?.sumItemGrandAmount || p.payableAmount,
      hutang: p.payableDue > 0 ? p.payableDue : p.payableAmount,
      tempo: p.dueIn,
      paymentState: p.paymentState,
      paymentDueState: p.paymentDueState,
      vendorCode: p.vendorCode,
    };
  });
}

/**
 * Build Rekap Anggaran data grouped by vendor
 * Now with full item-level detail from RAW - PI
 */
export function buildRekapAnggaran(
  selectedPIs: RencanaAnggaranRow[],
  piItems: PIItem[],
  invoiceMap: Map<string, InvoiceFile[]>
): RekapVendorGroup[] {
  // Build lookup: PI Code => PIItem[]
  const piItemMap = new Map<string, PIItem[]>();
  piItems.forEach(item => {
    const code = item.purchaseInvoiceCode.trim();
    if (!code) return;
    const existing = piItemMap.get(code) || [];
    existing.push(item);
    piItemMap.set(code, existing);
  });

  // Group selected PIs by vendor name
  const vendorGroups = new Map<string, RencanaAnggaranRow[]>();
  selectedPIs.forEach(pi => {
    const vendorName = pi.namaSupplier.trim();
    const existing = vendorGroups.get(vendorName) || [];
    existing.push(pi);
    vendorGroups.set(vendorName, existing);
  });

  const result: RekapVendorGroup[] = [];

  vendorGroups.forEach((pis, vendorName) => {
    const rows: RekapAnggaranRow[] = pis.map(pi => {
      const invoiceFiles = invoiceMap.get(pi.noPi) || [];
      const lineItems = piItemMap.get(pi.noPi.trim()) || [];

      // Build item sub-rows from RAW - PI data
      let items: RekapItemRow[];
      if (lineItems.length > 0) {
        items = lineItems.map(item => ({
          namaBarang: item.itemName,
          keterangan: item.description || '-',
          qtyPI: item.quantity,
          qtyPS: item.qtyPS,
          hargaPI: item.itemPrice,
          hargaPS: item.hargaPS,
        }));
      } else {
        // Fallback when no items found from RAW - PI
        items = [{
          namaBarang: '-',
          keterangan: '-',
          qtyPI: 0,
          qtyPS: 0,
          hargaPI: 0,
          hargaPS: 0,
        }];
      }

      // Get rekening info from the first line item (they share the same PI)
      const firstItem = lineItems[0];

      return {
        namaVendor: pi.namaSupplier,
        nomorInvoice: pi.noPi,
        tglFaktur: firstItem ? formatDateIndonesia(firstItem.tglFaktur || firstItem.tglPembelian) : pi.tglBeli,
        namaRekening: firstItem?.namaRekening || pi.namaPenerima,
        nomorRekening: firstItem?.nomorRekening || pi.noRekening,
        totalRencanaBayar: firstItem?.totalRencanaBayar || pi.hutang,
        hutang: firstItem?.hutang || pi.hutang,
        items,
        invoiceLinks: invoiceFiles,
        warningFlag: invoiceFiles.length === 0 ? 'INVOICE NOT FOUND' : undefined,
      };
    });

    const subtotal = rows.reduce((sum, r) => sum + r.totalRencanaBayar, 0);

    result.push({
      vendorName,
      rows,
      subtotal,
    });
  });

  // Sort by vendor name
  result.sort((a, b) => a.vendorName.localeCompare(b.vendorName));

  return result;
}

/**
 * Calculate summary stats from dashboard data
 */
export function calculateSummary(
  allRows: RencanaAnggaranRow[],
  selectedIds: Set<string>
) {
  const selectedRows = allRows.filter(r => selectedIds.has(r.id));
  const uniqueVendors = new Set(selectedRows.map(r => r.namaSupplier));

  return {
    totalPI: allRows.length,
    totalHutang: allRows.reduce((sum, r) => sum + r.hutang, 0),
    totalSelected: selectedRows.length,
    totalSelectedNominal: selectedRows.reduce((sum, r) => sum + r.hutang, 0),
    uniqueVendors: uniqueVendors.size,
  };
}
