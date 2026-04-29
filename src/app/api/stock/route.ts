import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

// GET all stock items
export async function GET() {
  try {
    const stocks = await prisma.stockItem.findMany({
      orderBy: { namaBarang: 'asc' }
    });
    return NextResponse.json({ success: true, data: stocks });
  } catch (error: any) {
    console.error('Error fetching stock:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST create or update stock item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, namaBarang, currentQty, minQty, unit, category, lastPrice, lastVendor, notes } = body;

    if (!namaBarang) {
      return NextResponse.json({ success: false, error: 'Nama barang wajib diisi' }, { status: 400 });
    }

    if (id) {
      // Update existing
      const updated = await prisma.stockItem.update({
        where: { id },
        data: {
          namaBarang,
          currentQty: currentQty || 0,
          minQty: minQty || 0,
          unit: unit || 'pcs',
          category: category || null,
          lastPrice: lastPrice || 0,
          lastVendor: lastVendor || null,
          notes: notes || null,
        }
      });
      return NextResponse.json({ success: true, data: updated });
    } else {
      // Create new
      const created = await prisma.stockItem.create({
        data: {
          namaBarang,
          currentQty: currentQty || 0,
          minQty: minQty || 0,
          unit: unit || 'pcs',
          category: category || null,
          lastPrice: lastPrice || 0,
          lastVendor: lastVendor || null,
          notes: notes || null,
        }
      });
      return NextResponse.json({ success: true, data: created });
    }
  } catch (error: any) {
    console.error('Error saving stock:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE stock item
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID wajib diisi' }, { status: 400 });
    }

    await prisma.stockItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting stock:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
