import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { searchSimilar } from '@/lib/embeddings';
import { decimalToNumber, formatDecimal } from '@/lib/decimal';

const prisma = new PrismaClient();
export const maxDuration = 60;

// ============================================================
// RAG: Intent Classifier & Dynamic Data Retriever
// ============================================================

type Intent =
  | 'hutang_summary'
  | 'vendor_analysis'
  | 'item_price_history'
  | 'invoice_detail'
  | 'stock_check'
  | 'payment_status'
  | 'company_summary'
  | 'ai_validation_results'
  | 'trend_analysis'
  | 'general';

/**
 * Step 1 of RAG: Use AI to classify the user's intent and extract entities
 */
async function classifyIntent(openai: OpenAI, message: string): Promise<{ intent: Intent; entities: Record<string, string> }> {
  const classifierPrompt = `Kamu adalah classifier intent untuk aplikasi keuangan "Rencana Anggaran - Central Kitchen".

Analisa pesan user berikut dan tentukan intent serta entitas yang relevan.

Daftar intent:
- "hutang_summary": Pertanyaan tentang total hutang, ringkasan utang, tagihan belum bayar
- "vendor_analysis": Pertanyaan tentang vendor tertentu atau perbandingan vendor, vendor terbanyak, vendor termahal
- "item_price_history": Pertanyaan tentang harga barang, perbandingan harga, histori harga, barang tertentu
- "invoice_detail": Pertanyaan tentang invoice/PI tertentu, detail faktur
- "stock_check": Pertanyaan tentang stok barang, persediaan, kebutuhan restock
- "payment_status": Pertanyaan tentang status pembayaran, tempo jatuh, jatuh tempo
- "company_summary": Pertanyaan tentang perusahaan/PT tertentu (VCI, VVA, VLA), perbandingan antar PT
- "ai_validation_results": Pertanyaan tentang hasil validasi AI, OCR, status dokumen, selisih invoice
- "trend_analysis": Pertanyaan tentang tren pembelian, analisa keuangan, grafik, pattern
- "general": Pertanyaan umum atau salam

Pesan user: "${message}"

Output WAJIB JSON murni tanpa backtick:
{
  "intent": "salah satu dari daftar di atas",
  "entities": {
    "vendor_name": "nama vendor jika disebutkan, kosongkan jika tidak",
    "item_name": "nama barang jika disebutkan, kosongkan jika tidak",
    "invoice_number": "nomor PI/invoice jika disebutkan, kosongkan jika tidak",
    "company_name": "nama PT/perusahaan jika disebutkan, kosongkan jika tidak",
    "time_range": "rentang waktu jika disebutkan (misal: bulan ini, 3 bulan, minggu ini), kosongkan jika tidak"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: classifierPrompt }],
      response_format: { type: 'json_object' },
      max_tokens: 200,
    });
    const text = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(text);
    return {
      intent: parsed.intent || 'general',
      entities: parsed.entities || {},
    };
  } catch {
    return { intent: 'general', entities: {} };
  }
}

/**
 * Step 2 of RAG: Retrieve relevant data chunks from DB based on intent
 */
async function retrieveContext(intent: Intent, entities: Record<string, string>, message: string): Promise<string> {
  const chunks: string[] = [];

  try {
    switch (intent) {
      // ---- HUTANG SUMMARY ----
      case 'hutang_summary': {
        const totalHutang = await prisma.purchaseInvoice.aggregate({
          where: { paymentState: { not: 'paid' } },
          _sum: { hutang: true, totalRencanaBayar: true },
          _count: true,
        });
        chunks.push(`📊 RINGKASAN HUTANG:
- Total Invoice Belum Lunas: ${totalHutang._count}
- Total Hutang: Rp ${formatDecimal(totalHutang._sum.hutang)}
- Total Rencana Bayar: Rp ${formatDecimal(totalHutang._sum.totalRencanaBayar)}`);

        const hutangByCompany = await prisma.purchaseInvoice.groupBy({
          by: ['companyId'],
          where: { paymentState: { not: 'paid' } },
          _sum: { hutang: true },
          _count: true,
        });
        const companyIds = hutangByCompany.map(h => h.companyId);
        const companies = await prisma.company.findMany({ where: { id: { in: companyIds } } });
        const compMap = new Map(companies.map(c => [c.id, c.name]));
        chunks.push(`📊 HUTANG PER PERUSAHAAN:
${hutangByCompany.map(h => `- ${compMap.get(h.companyId) || '?'}: Rp ${formatDecimal(h._sum.hutang)} (${h._count} invoice)`).join('\n')}`);

        const overdueInvoices = await prisma.purchaseInvoice.findMany({
          where: { tempoHari: { lt: 0 }, paymentState: { not: 'paid' } },
          include: { vendor: true },
          orderBy: { tempoHari: 'asc' },
          take: 10,
        });
        if (overdueInvoices.length > 0) {
          chunks.push(`⚠️ INVOICE JATUH TEMPO (${overdueInvoices.length} teratas):
${overdueInvoices.map(inv => `- ${inv.noPi} | ${inv.vendor.name} | Rp ${formatDecimal(inv.hutang)} | ${Math.abs(inv.tempoHari)} hari lewat tempo`).join('\n')}`);
        }
        break;
      }

      // ---- VENDOR ANALYSIS ----
      case 'vendor_analysis': {
        if (entities.vendor_name) {
          const vendor = await prisma.vendor.findFirst({
            where: { name: { contains: entities.vendor_name } },
          });
          if (vendor) {
            const vendorInvoices = await prisma.purchaseInvoice.findMany({
              where: { vendorId: vendor.id },
              include: { items: true, company: true },
              orderBy: { tglBeli: 'desc' },
              take: 15,
            });
            const totalHutangVendor = vendorInvoices.reduce((s, i) => s + decimalToNumber(i.hutang), 0);
            chunks.push(`🏪 DETAIL VENDOR: ${vendor.name}
- Kode: ${vendor.code}
- Bank: ${vendor.bankName || '-'} | Rekening: ${vendor.bankAccount || '-'} | Atas Nama: ${vendor.accountName || '-'}
- Total Invoice: ${vendorInvoices.length}
- Total Hutang: Rp ${totalHutangVendor.toLocaleString('id-ID')}
- Invoice Terbaru:
${vendorInvoices.slice(0, 10).map(i => `  ${i.noPi} | ${i.company.name} | Rp ${formatDecimal(i.hutang)} | ${i.paymentState} | ${i.items.length} item`).join('\n')}`);

            const vendorItems = await prisma.invoiceItem.findMany({
              where: { invoice: { vendorId: vendor.id } },
              orderBy: { createdAt: 'desc' },
              take: 20,
            });
            if (vendorItems.length > 0) {
              chunks.push(`🛒 BARANG dari ${vendor.name} (${vendorItems.length} item terbaru):
${vendorItems.map(it => `- ${it.namaBarang}: Qty ${it.qtyPI} x Rp ${formatDecimal(it.hargaPI)} = Rp ${formatDecimal(it.totalHarga)}`).join('\n')}`);
            }
          }
        }

        const topVendors = await prisma.purchaseInvoice.groupBy({
          by: ['vendorId'],
          _sum: { hutang: true },
          _count: true,
          orderBy: { _sum: { hutang: 'desc' } },
          take: 10,
        });
        const vIds = topVendors.map(v => v.vendorId);
        const vendorList = await prisma.vendor.findMany({ where: { id: { in: vIds } } });
        const vMap = new Map(vendorList.map(v => [v.id, v.name]));
        chunks.push(`🏆 TOP 10 VENDOR (berdasarkan hutang):
${topVendors.map((v, i) => `${i + 1}. ${vMap.get(v.vendorId) || '?'}: Rp ${formatDecimal(v._sum.hutang)} (${v._count} invoice)`).join('\n')}`);

        const topFreq = await prisma.purchaseInvoice.groupBy({
          by: ['vendorId'],
          _count: true,
          orderBy: { _count: { vendorId: 'desc' } },
          take: 10,
        });
        const fIds = topFreq.map(v => v.vendorId);
        const freqVendors = await prisma.vendor.findMany({ where: { id: { in: fIds } } });
        const fMap = new Map(freqVendors.map(v => [v.id, v.name]));
        chunks.push(`📊 TOP 10 VENDOR (berdasarkan frekuensi):
${topFreq.map((v, i) => `${i + 1}. ${fMap.get(v.vendorId) || '?'}: ${v._count} invoice`).join('\n')}`);
        break;
      }

      // ---- ITEM PRICE HISTORY ----
      case 'item_price_history': {
        if (entities.item_name) {
          const items = await prisma.invoiceItem.findMany({
            where: { namaBarang: { contains: entities.item_name } },
            include: { invoice: { include: { vendor: true } } },
            orderBy: { createdAt: 'desc' },
            take: 20,
          });
          if (items.length > 0) {
            const prices = items.map(i => decimalToNumber(i.hargaPI));
            const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            chunks.push(`📈 HISTORI HARGA: "${entities.item_name}" (${items.length} transaksi)
- Harga Rata-rata: Rp ${Math.round(avgPrice).toLocaleString('id-ID')}
- Harga Terendah: Rp ${minPrice.toLocaleString('id-ID')}
- Harga Tertinggi: Rp ${maxPrice.toLocaleString('id-ID')}
- Detail Transaksi:
${items.map(i => `  ${i.invoice.noPi} | ${i.invoice.vendor.name} | Qty: ${i.qtyPI} | Harga: Rp ${formatDecimal(i.hargaPI)} | Total: Rp ${formatDecimal(i.totalHarga)} | ${i.createdAt.toLocaleDateString('id-ID')}`).join('\n')}`);
          } else {
            chunks.push(`❌ Tidak ditemukan data untuk barang "${entities.item_name}"`);
          }
        }

        const expensiveItems = await prisma.invoiceItem.findMany({
          orderBy: { totalHarga: 'desc' },
          take: 15,
          include: { invoice: { include: { vendor: true } } },
        });
        chunks.push(`💰 TOP 15 ITEM TERMAHAL (total harga):
${expensiveItems.map((it, i) => `${i + 1}. ${it.namaBarang} | ${it.invoice.vendor.name} | Rp ${formatDecimal(it.totalHarga)} | Qty: ${it.qtyPI} | Harga: Rp ${formatDecimal(it.hargaPI)}`).join('\n')}`);
        break;
      }

      // ---- INVOICE DETAIL ----
      case 'invoice_detail': {
        if (entities.invoice_number) {
          const invoice = await prisma.purchaseInvoice.findFirst({
            where: { noPi: { contains: entities.invoice_number } },
            include: { vendor: true, company: true, items: true },
          });
          if (invoice) {
            chunks.push(`📄 DETAIL INVOICE: ${invoice.noPi}
- Vendor: ${invoice.vendor.name}
- Perusahaan: ${invoice.company.name}
- Tanggal Beli: ${invoice.tglBeli.toLocaleDateString('id-ID')}
- Tanggal Faktur: ${invoice.tglFaktur?.toLocaleDateString('id-ID') || '-'}
- Tempo: ${invoice.tempoHari} hari
- Status: ${invoice.paymentState}
- Total Rencana Bayar: Rp ${formatDecimal(invoice.totalRencanaBayar)}
- Hutang: Rp ${formatDecimal(invoice.hutang)}
- Bank: ${invoice.vendor.bankName || '-'} | Rekening: ${invoice.vendor.bankAccount || '-'}
- Jumlah Item: ${invoice.items.length}
- Detail Item:
${invoice.items.map((it, i) => `  ${i + 1}. ${it.namaBarang} | Qty PI: ${it.qtyPI} | Harga PI: Rp ${formatDecimal(it.hargaPI)} | Total: Rp ${formatDecimal(it.totalHarga)} | Status OCR: ${it.statusOcr || 'belum dicek'}`).join('\n')}`);
          }
        }

        const recentInv = await prisma.purchaseInvoice.findMany({
          take: 10,
          orderBy: { tglBeli: 'desc' },
          include: { vendor: true, company: true, items: true },
        });
        chunks.push(`📋 10 INVOICE TERBARU:
${recentInv.map(inv => `- ${inv.noPi} | ${inv.vendor.name} | ${inv.company.name} | Rp ${formatDecimal(inv.hutang)} | ${inv.paymentState} | ${inv.items.length} item`).join('\n')}`);
        break;
      }

      // ---- STOCK CHECK ----
      case 'stock_check': {
        const stocks = await prisma.stockItem.findMany({
          orderBy: { currentQty: 'asc' },
        });
        if (stocks.length > 0) {
          const lowStock = stocks.filter(s => s.currentQty <= s.minQty);
          chunks.push(`📦 DATA STOK (${stocks.length} barang):
${stocks.map(s => `- ${s.namaBarang}: ${s.currentQty} ${s.unit} (min: ${s.minQty}) ${s.currentQty <= s.minQty ? '⚠️ RESTOCK!' : '✅'} | Harga terakhir: Rp ${formatDecimal(s.lastPrice)} | Vendor: ${s.lastVendor || '-'}`).join('\n')}

⚠️ BARANG PERLU RESTOCK: ${lowStock.length} item`);
        } else {
          chunks.push('📦 Belum ada data stok barang.');
        }
        break;
      }

      // ---- PAYMENT STATUS ----
      case 'payment_status': {
        const paid = await prisma.purchaseInvoice.count({ where: { paymentState: 'paid' } });
        const unpaid = await prisma.purchaseInvoice.count({ where: { paymentState: 'unpaid' } });
        const partial = await prisma.purchaseInvoice.count({ where: { paymentState: 'partial' } });
        const total = paid + unpaid + partial;

        chunks.push(`💳 STATUS PEMBAYARAN:
- Lunas (paid): ${paid} invoice (${total > 0 ? Math.round(paid / total * 100) : 0}%)
- Belum Bayar (unpaid): ${unpaid} invoice (${total > 0 ? Math.round(unpaid / total * 100) : 0}%)
- Bayar Sebagian (partial): ${partial} invoice (${total > 0 ? Math.round(partial / total * 100) : 0}%)
- Total: ${total} invoice`);

        const soonDue = await prisma.purchaseInvoice.findMany({
          where: { tempoHari: { gte: 0, lte: 7 }, paymentState: { not: 'paid' } },
          include: { vendor: true },
          orderBy: { tempoHari: 'asc' },
          take: 10,
        });
        if (soonDue.length > 0) {
          chunks.push(`⏰ SEGERA JATUH TEMPO (≤7 hari):
${soonDue.map(inv => `- ${inv.noPi} | ${inv.vendor.name} | Rp ${formatDecimal(inv.hutang)} | ${inv.tempoHari} hari lagi`).join('\n')}`);
        }
        break;
      }

      // ---- COMPANY SUMMARY ----
      case 'company_summary': {
        const allCompanies = await prisma.company.findMany();
        for (const company of allCompanies) {
          if (entities.company_name && !company.name.toLowerCase().includes(entities.company_name.toLowerCase())) continue;

          const compInvoices = await prisma.purchaseInvoice.aggregate({
            where: { companyId: company.id },
            _sum: { hutang: true, totalRencanaBayar: true },
            _count: true,
          });
          const compUnpaid = await prisma.purchaseInvoice.count({
            where: { companyId: company.id, paymentState: { not: 'paid' } },
          });
          chunks.push(`🏛️ ${company.name} (${company.code}):
- Total Invoice: ${compInvoices._count}
- Invoice Belum Lunas: ${compUnpaid}
- Total Hutang: Rp ${formatDecimal(compInvoices._sum.hutang)}
- Total Rencana Bayar: Rp ${formatDecimal(compInvoices._sum.totalRencanaBayar)}`);
        }
        break;
      }

      // ---- AI VALIDATION RESULTS ----
      case 'ai_validation_results': {
        const validCount = await prisma.invoiceItem.count({ where: { statusOcr: 'Valid' } });
        const selisihCount = await prisma.invoiceItem.count({ where: { statusOcr: 'Selisih' } });
        const tidakValidCount = await prisma.invoiceItem.count({ where: { statusOcr: 'Tidak Valid' } });
        const pendingCount = await prisma.invoiceItem.count({ where: { OR: [{ statusOcr: null }, { statusOcr: 'pending' }] } });

        chunks.push(`🤖 HASIL VALIDASI AI:
- Valid: ${validCount} item ✅
- Selisih: ${selisihCount} item ⚠️
- Tidak Valid: ${tidakValidCount} item ❌
- Pending: ${pendingCount} item ⏳`);

        const discrepancies = await prisma.invoiceItem.findMany({
          where: { statusOcr: { in: ['Selisih', 'Tidak Valid'] } },
          include: { invoice: { include: { vendor: true } } },
          take: 15,
        });
        if (discrepancies.length > 0) {
          chunks.push(`📋 DETAIL SELISIH/TIDAK VALID (${discrepancies.length} teratas):
${discrepancies.map(d => `- ${d.invoice.noPi} | ${d.namaBarang} | ${d.invoice.vendor.name} | Status: ${d.statusOcr} | ${d.recommendationNote?.substring(0, 80) || '-'}`).join('\n')}`);
        }
        break;
      }

      // ---- TREND ANALYSIS ----
      case 'trend_analysis': {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const recentPurchases = await prisma.purchaseInvoice.findMany({
          where: { tglBeli: { gte: sixMonthsAgo } },
          select: { tglBeli: true, hutang: true, totalRencanaBayar: true },
        });

        const monthlyTotals: Record<string, { hutang: number; count: number }> = {};
        recentPurchases.forEach(inv => {
          const key = `${inv.tglBeli.getFullYear()}-${String(inv.tglBeli.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyTotals[key]) monthlyTotals[key] = { hutang: 0, count: 0 };
          monthlyTotals[key].hutang += decimalToNumber(inv.hutang);
          monthlyTotals[key].count++;
        });

        chunks.push(`📈 TREN PEMBELIAN (6 bulan terakhir):
${Object.entries(monthlyTotals).sort().map(([month, data]) => `- ${month}: Rp ${data.hutang.toLocaleString('id-ID')} (${data.count} invoice)`).join('\n')}`);

        const topItems = await prisma.invoiceItem.groupBy({
          by: ['namaBarang'],
          _count: true,
          _avg: { hargaPI: true },
          orderBy: { _count: { namaBarang: 'desc' } },
          take: 15,
        });
        chunks.push(`🔥 BARANG PALING SERING DIBELI:
${topItems.map((it, i) => `${i + 1}. ${it.namaBarang}: ${it._count} kali | Avg harga: Rp ${Math.round(decimalToNumber(it._avg.hargaPI)).toLocaleString('id-ID')}`).join('\n')}`);
        break;
      }

      // ---- GENERAL ----
      default: {
        const totalInvoices = await prisma.purchaseInvoice.count();
        const unpaidInvoices = await prisma.purchaseInvoice.count({ where: { paymentState: 'unpaid' } });
        const totalHutang = await prisma.purchaseInvoice.aggregate({
          where: { paymentState: { not: 'paid' } },
          _sum: { hutang: true },
        });
        const vendorCount = await prisma.vendor.count();
        const itemCount = await prisma.invoiceItem.count();

        chunks.push(`📊 RINGKASAN UMUM ANGGARAN:
- Total Invoice: ${totalInvoices}
- Invoice Belum Bayar: ${unpaidInvoices}
- Total Hutang: Rp ${formatDecimal(totalHutang._sum.hutang)}
- Total Vendor: ${vendorCount}
- Total Item Barang: ${itemCount}`);
        break;
      }
    }

    // Hybrid RAG: Semantic Search
    try {
      const semanticResults = await searchSimilar(message, 5);
      if (semanticResults && semanticResults.length > 0) {
        chunks.push(`\nDATA TAMBAHAN (Semantic Search):`);
        semanticResults.forEach((res, i) => {
          chunks.push(`${i + 1}. ${res.content}`);
        });
      }
    } catch (e) {
      console.warn("Semantic search failed", e);
    }

  } catch (err) {
    console.error('RAG retrieval error:', err);
    chunks.push('⚠️ Terjadi error saat mengambil data.');
  }

  return chunks.join('\n\n');
}

// ============================================================
// Main Chat Handler
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    const sid = sessionId || `session-${Date.now()}`;

    await prisma.chatHistory.create({
      data: { role: 'user', message, sessionId: sid }
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const fallback = 'Maaf, AI tidak tersedia saat ini.';
      await prisma.chatHistory.create({ data: { role: 'assistant', message: fallback, sessionId: sid } });
      return NextResponse.json({ success: true, reply: fallback, sessionId: sid });
    }

    const openai = new OpenAI({ apiKey });

    const { intent, entities } = await classifyIntent(openai, message);
    const ragContext = await retrieveContext(intent, entities, message);

    const chatHistory = await prisma.chatHistory.findMany({
      where: { sessionId: sid },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    const messages = chatHistory.reverse().map(ch => ({
      role: ch.role === 'user' ? 'user' : 'assistant',
      content: ch.message
    }));

    const systemPrompt = `Kamu adalah "AI Asisten Anggaran".
- Ahli keuangan, anggaran, dan procurement.
- Gunakan data berikut untuk menjawab:
${ragContext}
- Jika data tidak ada, katakan tidak tahu. Jangan mengarang.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages as any,
      ],
    });

    const reply = completion.choices[0].message.content || 'Maaf, saya tidak bisa memproses pertanyaan Anda.';

    // Save AI reply
    await prisma.chatHistory.create({
      data: { role: 'assistant', message: reply, sessionId: sid }
    });

    return NextResponse.json({ success: true, reply, sessionId: sid });
  } catch (error: any) {
    console.error('AI Chat error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
