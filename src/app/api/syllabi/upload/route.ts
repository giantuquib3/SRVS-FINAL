import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== 'Educator' && user.role !== 'DepartmentHead')) {
      return NextResponse.json({ error: 'Unauthorized: Only Department Heads and Faculty can upload syllabus documents. System Administrators cannot author or upload syllabi.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in request.' }, { status: 400 });
    }

    const originalName = file.name;
    const ext = path.extname(originalName).toLowerCase();
    const allowedExtensions = ['.pdf', '.doc', '.docx'];

    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json({
        error: 'Invalid file format. Only PDF, DOC, and DOCX documents are accepted for syllabus uploads.',
      }, { status: 400 });
    }

    // Max 15MB
    const maxBytes = 15 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({
        error: 'File size exceeds 15MB maximum limit.',
      }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

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
      fileType: ext.replace('.', '').toUpperCase(),
      fileSize: file.size,
    });
  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to upload document: ' + error.message }, { status: 500 });
  }
}
