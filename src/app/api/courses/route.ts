import { NextRequest, NextResponse } from 'next/server';
import { GET as getSubjects, POST as createSubject, PUT as updateSubject, DELETE as deleteSubject } from '../subjects/route';

export const dynamic = 'force-dynamic';

/**
 * /api/courses route provides backward-compatible access to academic curriculum subjects.
 * All operations map directly to the subjects table and /api/subjects route.
 */
export async function GET(req: NextRequest) {
  return getSubjects(req);
}

export async function POST(req: NextRequest) {
  return createSubject(req);
}

export async function PUT(req: NextRequest) {
  return updateSubject(req);
}

export async function DELETE(req: NextRequest) {
  return deleteSubject(req);
}
