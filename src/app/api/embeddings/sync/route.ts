// ============================================================
// API Route: Sync Database to Embedding model
// Used by Chatbot to search semantic context
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { generateEmbedding } from '@/lib/embeddings';

export const maxDuration = 60; // Max allowed for hobby on Vercel

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ success: false, error: 'OPENAI_API_KEY is missing' }, { status: 400 });
    }

    let embeddedCount = 0;

    // 1. Vendors
    const vendors = await prisma.vendor.findMany();
    for (const v of vendors) {
      const exists = await prisma.embedding.findFirst({ where: { sourceType: 'vendor', sourceId: v.id } });
      if (!exists) {
        const text = `Vendor: ${v.name}. Kode vendor: ${v.code}. Rekening Bank: ${v.bankName || '-'} ${v.bankAccount || '-'} a/n ${v.accountName || '-'}.`;
        try {
          const vector = await generateEmbedding(text);
          await prisma.embedding.create({
            data: {
              sourceType: 'vendor',
              sourceId: v.id,
              content: text,
              vector: JSON.stringify(vector)
            }
          });
          embeddedCount++;
        } catch (e) {
          console.warn("Failed embedding vendor", v.name);
        }
      }
    }

    // 2. Summary items (recent items bought)
    // We group by namaBarang to keep it tight, only looking at last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    // Using raw grouping manually to be safe for TiDB compatibility
    const items = await prisma.invoiceItem.findMany({
      where: { createdAt: { gte: threeMonthsAgo } },
      include: { invoice: { include: { vendor: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const itemMap = new Map<string, any[]>();
    for (const item of items) {
      if (!itemMap.has(item.namaBarang)) {
        itemMap.set(item.namaBarang, []);
      }
      itemMap.get(item.namaBarang)!.push(item);
    }

    for (const [namaBarang, purchases] of itemMap.entries()) {
      // Find min price & max price & vendors for this item
      const sortedByPrice = [...purchases].sort((a,b) => a.hargaPI - b.hargaPI);
      const minPrice = sortedByPrice[0];
      const maxPrice = sortedByPrice[sortedByPrice.length - 1];
      const count = purchases.length;
      
      const uniqueVendors = Array.from(new Set(purchases.map(p => p.invoice.vendor.name))).join(', ');
      
      const text = `Data historis (3 bln terakhir): Barang '${namaBarang}' dibeli ${count} kali. Harga termurah Rp${minPrice.hargaPI.toLocaleString('id-ID')} (dari ${minPrice.invoice.vendor.name}). Harga termahal Rp${maxPrice.hargaPI.toLocaleString('id-ID')}. Biasanya dibeli di vendor: ${uniqueVendors}.`;
      
      // Use namaBarang encoded roughly as ID
      const sourceId = Buffer.from(namaBarang).toString('base64').substring(0, 30);
      
      const exists = await prisma.embedding.findFirst({ where: { sourceType: 'item_summary', sourceId } });
      if (!exists) {
        try {
          const vector = await generateEmbedding(text);
          await prisma.embedding.create({
            data: {
              sourceType: 'item_summary',
              sourceId,
              content: text,
              vector: JSON.stringify(vector)
            }
          });
          embeddedCount++;
        } catch(e) {
             console.warn("Failed embedding item", namaBarang);
        }
      } else {
        // Update if already exists because history changes
        try {
          const vector = await generateEmbedding(text);
          await prisma.embedding.update({
            where: { id: exists.id },
            data: { content: text, vector: JSON.stringify(vector)}
          });
        } catch(e){}
      }
    }

    return NextResponse.json({ success: true, message: `Berhasil sinkronisasi ${embeddedCount} data baru ke vector database.` });
  } catch (err: any) {
    console.error('Error syncing embeddings:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
