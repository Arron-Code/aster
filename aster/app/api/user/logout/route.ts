import { NextResponse } from 'next/server'; import { adminCookieName } from '@/lib/admin-auth';
export async function POST() { const r = NextResponse.json({ success: true }); r.cookies.set(adminCookieName(), '', { httpOnly: true, path: '/', maxAge: 0 }); return r; }
