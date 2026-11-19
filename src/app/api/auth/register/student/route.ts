import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error: 'Student accounts are not supported in SRVS. The system supports School Registrar, VP-Academics, Dean, Department Head, and Faculty roles only.',
    },
    { status: 410 }
  );
}
