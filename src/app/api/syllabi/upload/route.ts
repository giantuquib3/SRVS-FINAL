import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Educator' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({
        error: 'Unauthorized: Only Department Heads and Faculty can upload syllabus documents. Administrators cannot author or upload syllabi.',
      }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in request.' }, { status: 400 });
    }

    const originalName = file.name;
    const ext = path.extname(originalName).toLowerCase();

    // Requirement 9: The SRVS system accepts PDF syllabi only. DOCX is not allowed.
    if (ext !== '.pdf') {
      return NextResponse.json({
        error: 'Invalid file format. The SRVS system accepts PDF syllabi only (.pdf). DOCX and other formats are not allowed.',
      }, { status: 400 });
    }

    // Requirement 9: Maximum file size is 20 MB
    const maxBytes = 20 * 1024 * 1024; // 20 MB
    if (file.size > maxBytes) {
      return NextResponse.json({
        error: 'File size exceeds 20MB maximum limit for PDF syllabus uploads.',
      }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate PDF magic bytes (%PDF)
    if (buffer.length < 4 || buffer.subarray(0, 4).toString() !== '%PDF') {
      return NextResponse.json({
        error: 'Invalid file content. The file does not appear to be a valid PDF document.',
      }, { status: 400 });
    }

    // Ensure public/uploads/syllabi directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'syllabi');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Unique filename to prevent collisions
    const safeBaseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `${safeBaseName}_${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);

    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/syllabi/${uniqueName}`;

    return NextResponse.json({
      success: true,
      fileName: originalName,
      fileUrl,
      fileType: 'PDF',
      fileSize: file.size,
    }, { status: 201 });
  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to upload document: ' + error.message }, { status: 500 });
  }
}
