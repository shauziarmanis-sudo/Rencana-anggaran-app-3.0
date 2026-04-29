import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUnpaidPayables, getRawPIItems, getMasterRekening } from '@/lib/googleSheets';

const prisma = new PrismaClient();

export async function POST() {
  try {
    // 1. Ambil data dari Google Sheets
    const [payables, piItems, masterRekening] = await Promise.all([
      getUnpaidPayables(),
      getRawPIItems(),
      getMasterRekening(),
    ]);

    let migratedInvoices = 0;

    // 2. Loop melalui Payable (Invoice)
    for (const p of payables) {
      if (!p.purchaseInvoiceCode) continue;

      // Cari atau buat Company
      const companyCode = p.company || 'PT DEFAULT';
      let company = await prisma.company.findUnique({ where: { code: companyCode } });
      if (!company) {
        company = await prisma.company.create({
          data: { code: companyCode, name: companyCode }
        });
      }

      // Cari data rekening jika ada
      const rekeningData = masterRekening.find(r => r.namaVendor === p.vendorName);
      
      // Cari atau buat Vendor
      const vCode = p.vendorCode || p.vendorName.substring(0, 3).toUpperCase();
      let vendor = await prisma.vendor.findUnique({ where: { code: vCode } });
      if (!vendor) {
        vendor = await prisma.vendor.create({
          data: {
            code: vCode,
            name: p.vendorName || 'Unknown Vendor',
            bankAccount: rekeningData?.noRekening || null,
            accountName: rekeningData?.namaPenerima || null,
            bankName: rekeningData?.namaBank || null,
          }
        });
      }

      // Cek apakah invoice sudah ada di database
      const existingInvoice = await prisma.purchaseInvoice.findUnique({
        where: { noPi: p.purchaseInvoiceCode }
      });

      if (!existingInvoice) {
        // Ambil item-item untuk invoice ini
        const items = piItems.filter(item => item.purchaseInvoiceCode === p.purchaseInvoiceCode);

        // Parse tanggal Beli
        const tglBeliParsed = p.transactionAt ? new Date(p.transactionAt) : new Date();

        await prisma.purchaseInvoice.create({
          data: {
            noPi: p.purchaseInvoiceCode,
            tglBeli: tglBeliParsed,
            tempoHari: p.dueIn || 0,
            paymentState: p.paymentState || 'unpaid',
            totalRencanaBayar: p.payableAmount || 0,
            hutang: p.payableDue || 0,
            companyId: company.id,
            vendorId: vendor.id,
            items: {
              create: items.map(it => ({
                namaBarang: it.itemName,
                keterangan: it.description,
                qtyPI: it.quantity || 1,
                qtyPS: it.qtyPS || 0,
                hargaPI: it.itemPrice || 0,
                hargaPS: it.hargaPS || 0,
                totalHarga: it.itemGrandAmount || 0,
              }))
            }
          }
        });
        migratedInvoices++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sukses memigrasikan ${migratedInvoices} Invoice baru dari Google Sheets ke MySQL.`,
      totalPayablesTerbaca: payables.length
    });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
