import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
export async function GET() {
  const items = await prisma.menuItem.findMany({ where: { available: true }, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }] });
  return NextResponse.json(items);
}
