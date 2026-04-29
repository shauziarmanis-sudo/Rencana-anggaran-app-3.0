import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CsvValue = string | number | null | undefined;
type CsvRow = Record<string, CsvValue>;

interface InvoiceImportInput {
  noPi: string;
  companyCode: string;
  vendorCode: string;
  payable: CsvRow;
}

const toText = (value: CsvValue): string => String(value ?? '').trim();

const normalizeDecimalString = (value: CsvValue): string => {
  if (typeof value === 'number') return String(value);

  const raw = toText(value).replace(/[^\d,.-]/g, '');
  if (!raw) return '0';

  const isNegative = raw.startsWith('-');
  const unsigned = raw.replace(/-/g, '');
  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');

  const normalizeSingleSeparator = (input: string, separator: ',' | '.'): string => {
    const parts = input.split(separator);
    if (parts.length > 2) return parts.join('');

    const [whole, fraction = ''] = parts;
    if (!fraction) return whole;
    if (fraction.length === 3 && whole.length <= 3) return `${whole}${fraction}`;
    if (fraction.length <= 4) return `${whole}.${fraction}`;
    return `${whole}${fraction}`;
  };

  let normalized = unsigned;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = unsigned
      .replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '')
      .replace(decimalSeparator, '.');
  } else if (lastComma >= 0) {
    normalized = normalizeSingleSeparator(unsigned, ',');
  } else if (lastDot >= 0) {
    normalized = normalizeSingleSeparator(unsigned, '.');
  }

  return `${isNegative ? '-' : ''}${normalized}`;
};

const toDecimal = (value: CsvValue): Prisma.Decimal => {
  try {
    return new Prisma.Decimal(normalizeDecimalString(value));
  } catch {
    return new Prisma.Decimal(0);
  }
};

const toNumber = (value: CsvValue, fallback = 0): number => {
  const parsed = Number(normalizeDecimalString(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getPsKey = (sourceDocumentCode: CsvValue, itemName: CsvValue): string =>
  `${toText(sourceDocumentCode)}::${toText(itemName)}`;

const buildVendorCode = (vendorName: string, vendorCode: CsvValue): string => {
  const trimmedVendorCode = toText(vendorCode);
  if (trimmedVendorCode) return trimmedVendorCode;

  const prefix = vendorName.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'VND';
  const suffix = createHash('sha1').update(vendorName).digest('hex').slice(0, 6).toUpperCase();
  return `${prefix}-${suffix}`;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Terjadi kesalahan saat import CSV';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { payables, piItems, psItems } = body as {
      payables: CsvRow[];
      piItems: CsvRow[];
      psItems?: CsvRow[];
    };

    if (!Array.isArray(payables) || !Array.isArray(piItems)) {
      return NextResponse.json({ success: false, error: 'Data CSV tidak lengkap' }, { status: 400 });
    }

    const unpaidPayables = payables.filter(p => toText(p['Payment state']).toLowerCase() === 'unpaid');
    const invoiceInputsByPi = new Map<string, InvoiceImportInput>();
    const piItemsByInvoice = new Map<string, CsvRow[]>();
    const psItemsBySourceAndItem = new Map<string, CsvRow>();

    for (const item of piItems) {
      const piCode = toText(item['Purchase Invoice Code']);
      if (!piCode) continue;

      const existing = piItemsByInvoice.get(piCode);
      if (existing) {
        existing.push(item);
      } else {
        piItemsByInvoice.set(piCode, [item]);
      }
    }

    for (const psItem of psItems ?? []) {
      const key = getPsKey(psItem['Source Document Code'], psItem['Item Name']);
      if (!psItemsBySourceAndItem.has(key)) {
        psItemsBySourceAndItem.set(key, psItem);
      }
    }

    for (const payable of unpaidPayables) {
      const piCode = toText(payable['Purchase Invoice Code']);
      if (!piCode) continue;

      const vendorName = toText(payable['Vendor Name']) || 'Unknown Vendor';
      const vendorCode = buildVendorCode(vendorName, payable['Vendor Code']);
      const companyCode = toText(payable['Company']) || 'PT DEFAULT';

      if (!invoiceInputsByPi.has(piCode)) {
        invoiceInputsByPi.set(piCode, {
          noPi: piCode,
          companyCode,
          vendorCode,
          payable,
        });
      }
    }

    const invoiceInputs = Array.from(invoiceInputsByPi.values());
    const companyInputs = new Map<string, { code: string; name: string }>();
    const vendorInputs = new Map<string, { code: string; name: string }>();

    for (const input of invoiceInputs) {
      companyInputs.set(input.companyCode, { code: input.companyCode, name: input.companyCode });

      const vendorName = toText(input.payable['Vendor Name']) || 'Unknown Vendor';
      if (!vendorInputs.has(input.vendorCode)) {
        vendorInputs.set(input.vendorCode, { code: input.vendorCode, name: vendorName });
      }
    }

    const migratedInvoices = await prisma.$transaction(async (tx) => {
      const existingInvoices = await tx.purchaseInvoice.findMany({
        where: { noPi: { in: invoiceInputs.map((input) => input.noPi) } },
        select: { noPi: true },
      });
      const existingNoPi = new Set(existingInvoices.map((invoice) => invoice.noPi));

      const companies = await Promise.all(
        Array.from(companyInputs.values()).map((company) =>
          tx.company.upsert({
            where: { code: company.code },
            update: { name: company.name },
            create: company,
          })
        )
      );

      const vendors = await Promise.all(
        Array.from(vendorInputs.values()).map((vendor) =>
          tx.vendor.upsert({
            where: { code: vendor.code },
            update: { name: vendor.name },
            create: vendor,
          })
        )
      );

      const companyIdByCode = new Map(companies.map((company) => [company.code, company.id]));
      const vendorIdByCode = new Map(vendors.map((vendor) => [vendor.code, vendor.id]));

      await Promise.all(
        invoiceInputs.map((input) => {
          const matchedItems = piItemsByInvoice.get(input.noPi) ?? [];
          const tglBeliParsed = input.payable['Transaction At'] ? new Date(toText(input.payable['Transaction At'])) : new Date();
          const companyId = companyIdByCode.get(input.companyCode);
          const vendorId = vendorIdByCode.get(input.vendorCode);

          if (!companyId || !vendorId) {
            throw new Error(`Company atau vendor tidak ditemukan untuk invoice ${input.noPi}`);
          }

          return tx.purchaseInvoice.upsert({
            where: { noPi: input.noPi },
            update: {},
            create: {
              noPi: input.noPi,
              tglBeli: tglBeliParsed,
              tempoHari: Number.parseInt(toText(input.payable['Due In']), 10) || 0,
              paymentState: toText(input.payable['Payment state']) || 'unpaid',
              totalRencanaBayar: toDecimal(input.payable['Payable Amount']),
              hutang: toDecimal(input.payable['Payable due']),
              companyId,
              vendorId,
              items: {
                create: matchedItems.map((item) => {
                  const matchingPS = psItemsBySourceAndItem.get(
                    getPsKey(item['Source Document Code'], item['Item Name'])
                  );
                  const psQuantity = matchingPS ? toNumber(matchingPS['Item Quantity']) : 0;
                  const hargaPS = matchingPS && psQuantity > 0
                    ? toDecimal(matchingPS['Item Grand Amount']).div(psQuantity)
                    : new Prisma.Decimal(0);

                  return {
                    namaBarang: toText(item['Item Name']),
                    keterangan: toText(item['Description']),
                    qtyPI: toNumber(item['Quantity'], 1),
                    qtyPS: psQuantity,
                    hargaPI: toDecimal(item['Item Price']),
                    hargaPS,
                    totalHarga: toDecimal(item['Item Grand Amount']),
                  };
                }),
              },
            },
          });
        })
      );

      return invoiceInputs.filter((input) => !existingNoPi.has(input.noPi)).length;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil meng-import ${migratedInvoices} Invoice baru dari file CSV.`,
    });
  } catch (error: unknown) {
    console.error('CSV Import failed:', error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
