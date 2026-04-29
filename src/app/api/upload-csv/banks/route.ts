import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bankData } = body as { bankData: any[] };

    if (!bankData || !Array.isArray(bankData)) {
      return NextResponse.json({ success: false, error: 'Data Rekening tidak valid' }, { status: 400 });
    }

    let updatedCount = 0;

    for (const row of bankData) {
      // Find the best possible vendor lookup
      const vName = row['Vendor Name'] || row['Vendor Name '] || row['vendor_name'] || row['vendor'];
      const bankName = row['Bank Name'] || row['Bank'] || row['bank_name'];
      const bankAccount = row['Bank Account'] || row['Account Number'] || row['bank_account'] || row['rekening'];
      const accountName = row['Account Name'] || row['account_name'] || row['atas_nama'] || row['nama_rekening'];

      if (!vName) continue;

      // Ensure vendor exists or update existing
      // First try to find it
      const existingVendor = await prisma.vendor.findFirst({
        where: { name: vName }
      });

      if (existingVendor) {
        await prisma.vendor.update({
          where: { id: existingVendor.id },
          data: {
            bankName: bankName || existingVendor.bankName,
            bankAccount: bankAccount ? bankAccount.toString() : existingVendor.bankAccount,
            accountName: accountName || existingVendor.accountName,
          }
        });
        if (bankAccount || bankName || accountName) {
          updatedCount++;
        }
      } else {
        // If not found, create new vendor safely checking for unique code
        let baseCode = row['Vendor Code'] || row['vendor_code'] || vName.substring(0, 3).toUpperCase();
        let uniqueCode = baseCode;
        let counter = 1;

        while (true) {
          const checkCode = await prisma.vendor.findUnique({ where: { code: uniqueCode } });
          if (!checkCode) break;
          // if code exists but names are totally different, we need a new code
          uniqueCode = `${baseCode}${counter}`;
          counter++;
        }

        await prisma.vendor.create({
          data: {
            code: uniqueCode,
            name: vName,
            bankName: bankName || null,
            bankAccount: bankAccount ? bankAccount.toString() : null,
            accountName: accountName || null,
          }
        });
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      message: `Berhasil mengupdate rekening untuk ${updatedCount} Vendor.`,
    });
  } catch (error: any) {
    console.error('Bank CSV Import failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
