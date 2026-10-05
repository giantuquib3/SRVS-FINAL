import { NextRequest, NextResponse } from 'next/server';
import { GET as getCourses, POST as createCourse } from '../courses/route';

export const dynamic = 'force-dynamic';

/**
 * /api/subjects is a legacy alias endpoint delegating directly to /api/courses.
 * As per Requirement 8, Course is the canonical academic curriculum entity.
 * This ensures legacy client compatibility while removing separate subject entities.
 */
export async function GET(req: NextRequest) {
  const res = await getCourses(req);
  const data = await res.json();
  return NextResponse.json({
    ...data,
    subjects: data.courses || [],
  }, { status: res.status });
}

export async function POST(req: NextRequest) {
  return createCourse(req);
}
