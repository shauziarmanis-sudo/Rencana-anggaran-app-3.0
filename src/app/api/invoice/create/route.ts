import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface InvoiceItemInput {
  namaBarang: string;
  keterangan?: string | null;
  qtyPI: number | string;
  hargaPI: number | string;
}

interface CreateInvoiceInput {
  companyCode?: string;
  vendorName?: string;
  vendorCode?: string;
  rekening?: string;
  bankName?: string;
  accountName?: string;
  tglBeli?: string;
  tempo?: number;
  driveUrl?: string;
  items?: InvoiceItemInput[];
}

const toDecimal = (value: number | string | null | undefined): Prisma.Decimal => {
  if (value === null || value === undefined || value === '') return new Prisma.Decimal(0);

  try {
    return new Prisma.Decimal(value);
  } catch {
    return new Prisma.Decimal(0);
  }
};

const toNumber = (value: number | string, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildVendorCode = (vendorName: string, vendorCode?: string): string => {
  const trimmedVendorCode = vendorCode?.trim();
  if (trimmedVendorCode) return trimmedVendorCode;

  const prefix = vendorName.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'VND';
  const suffix = createHash('sha1').update(vendorName).digest('hex').slice(0, 6).toUpperCase();
  return `${prefix}-${suffix}`;
};

const generateNoPiDraft = (vendorCode: string): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = randomBytes(4).toString('hex').toUpperCase();
  return `PI-${vendorCode}-${timestamp}-${randomSuffix}`;
};

const isNoPiUniqueError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002' &&
  Array.isArray(error.meta?.target) &&
  error.meta.target.includes('noPi');

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat invoice';

export async function POST(request: Request) {
  try {
    const body = await request.json() as CreateInvoiceInput;
    const { companyCode, vendorName, vendorCode, rekening, bankName, accountName, tglBeli, tempo, driveUrl, items } = body;

    // Validation
    if (!companyCode || !vendorName || !tglBeli || !items || !items.length) {
      return NextResponse.json({ success: false, error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Prepare Date
    const purchaseDate = new Date(tglBeli);
    const codeVendor = buildVendorCode(vendorName, vendorCode);

    // Calculate Totals
    const totalRencana = items.reduce(
      (sum: Prisma.Decimal, it: InvoiceItemInput) => sum.plus(toDecimal(it.hargaPI).mul(toNumber(it.qtyPI))),
      new Prisma.Decimal(0)
    );

    const createInvoice = (noPiDraft: string) =>
      prisma.$transaction(async (tx) => {
        const company = await tx.company.upsert({
          where: { code: companyCode },
          update: { name: companyCode },
          create: {
            code: companyCode,
            name: companyCode,
          },
        });

        const vendor = await tx.vendor.upsert({
          where: { code: codeVendor },
          update: {
            name: vendorName,
            bankAccount: rekening || undefined,
            bankName: bankName || undefined,
            accountName: accountName || undefined,
          },
          create: {
            code: codeVendor,
            name: vendorName,
            bankAccount: rekening || null,
            bankName: bankName || null,
            accountName: accountName || null,
          },
        });

        return tx.purchaseInvoice.create({
          data: {
            noPi: noPiDraft,
            tglBeli: purchaseDate,
            tempoHari: tempo || 0,
            companyId: company.id,
            vendorId: vendor.id,
            driveFileId: driveUrl || null,
            totalRencanaBayar: totalRencana,
            hutang: totalRencana,
            items: {
              create: items.map((it: InvoiceItemInput) => {
                const qtyPI = toNumber(it.qtyPI);
                const hargaPI = toDecimal(it.hargaPI);

                return {
                  namaBarang: it.namaBarang,
                  keterangan: it.keterangan || null,
                  qtyPI,
                  hargaPI,
                  totalHarga: hargaPI.mul(qtyPI),
                };
              })
            }
          }
        });
      });

    let newInvoice: Awaited<ReturnType<typeof createInvoice>> | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        newInvoice = await createInvoice(generateNoPiDraft(codeVendor));
        break;
      } catch (error: unknown) {
        if (!isNoPiUniqueError(error) || attempt === 2) throw error;
      }
    }

    if (!newInvoice) {
      throw new Error('Gagal membuat nomor PI unik');
    }

    return NextResponse.json({ success: true, data: newInvoice });
  } catch (error: unknown) {
    console.error('Error creating invoice:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
