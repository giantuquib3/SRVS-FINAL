'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, Download } from 'lucide-react';
import { Card, DeptTag, EmptyState, LoadingState, PageHeader, SearchInput, formatDate } from '@/components/ui';
import { DEPARTMENTS } from '@/lib/departments';

export default function InstitutionalSyllabusViewerPage() {
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>(DEPARTMENTS);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const fetchRepositoryData = async () => {
    setLoading(true);
    try {
      const [sylRes, deptRes] = await Promise.all([
        fetch('/api/syllabi?status=ALL').then((r) => r.json()),
        fetch('/api/departments').then((r) => (r.ok ? r.json() : null)),
      ]);
      setSyllabi(sylRes.syllabi || []);
      if (deptRes?.departments?.length) setDepartmentsList(deptRes.departments);
    } catch (err) {
      console.error('Error fetching institutional syllabi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepositoryData();
  }, []);

  const filteredSyllabi = syllabi.filter((s) => {
    if (departmentFilter && s.departmentId !== departmentFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const code = (s.subject?.code || s.course?.code || '').toLowerCase();
    const title = (s.subject?.title || s.course?.title || '').toLowerCase();
    const inst = (s.instructor?.fullName || '').toLowerCase();
    const fileName = (s.latestVersion?.fileName || '').toLowerCase();
    return code.includes(q) || title.includes(q) || inst.includes(q) || fileName.includes(q);
  });

  const handleDownloadFile = async (item: any) => {
    const subject = item.subject || item.course || {};
    const latestVersion = item.latestVersion;
    const defaultName = latestVersion?.fileName || `${subject.code || 'Course'}_Syllabus_v${item.currentVersionNumber || 1}.html`;

    // If an uploaded PDF/document fileUrl exists, download it directly
    if (latestVersion?.fileUrl) {
      const link = document.createElement('a');
      link.href = latestVersion.fileUrl;
      link.download = latestVersion.fileName || `${subject.code || 'Course'}_Syllabus.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Otherwise, fetch the syllabus content and download a formatted document file
    setDownloadingId(item.id);
    try {
      const res = await fetch(`/api/syllabi/${item.id}`);
      const data = await res.json();
      const syl = data.syllabus || item;
      const ver = data.currentVersion || latestVersion || {};
      const content = ver.content || {};
      const cilos: any[] = Array.isArray(content.cilos) ? content.cilos : [];
      const weeklyPlan: any[] = Array.isArray(content.weeklyPlan) ? content.weeklyPlan : [];
      const owatGrading: any[] = Array.isArray(content.owatGrading) ? content.owatGrading : [];
      const coursePolicies: any[] = Array.isArray(content.coursePolicies) ? content.coursePolicies : [];
      const piloPeoMapping: any[] = Array.isArray(content.piloPeoMapping) ? content.piloPeoMapping : [];
      const integrationSchemes: any[] = Array.isArray(content.integrationSchemes) ? content.integrationSchemes : [];
      const references: string[] = Array.isArray(content.references) ? content.references.filter((r: string) => r && r.trim()) : [];
      const units = subject.units ?? 3;
      const lecHours = subject.lecHours ?? 3;
      const labHours = subject.labHours ?? 0;

      const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${subject.code} - ${subject.title} Syllabus</title>
  <style>
    body { font-family: Cambria, Georgia, "Times New Roman", serif; color: #000; max-width: 920px; margin: 28px auto; padding: 0 24px; line-height: 1.45; font-size: 13px; }
    .title { text-align: center; margin-bottom: 16px; }
    .title h1 { margin: 2px 0; font-size: 18px; text-transform: uppercase; }
    .title p { margin: 2px 0; font-size: 14px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12.5px; }
    th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; }
    th.bar { background: #D9D9D9; font-weight: bold; text-transform: uppercase; }
    th.sub { background: #BFBFBF; font-weight: bold; }
    table.owat, table.owat th, table.owat td { border-color: #B06C6C; }
  </style>
</head>
<body>
  <div class="title">
    <h1>SCHOOL OF ENGINEERING</h1>
    <p>${syl.department?.name || item.departmentId}</p>
    <div style="font-size:12px;">${content.curriculumYear || 'Curriculum 2022'} • Version ${item.currentVersionNumber || 1}</div>
  </div>

  <table>
    <tbody>
      <tr><td style="width:25%;background:#D9D9D9;font-weight:bold;">COURSE NUMBER</td><td><strong>${subject.code || ''}</strong></td></tr>
      <tr><td style="background:#D9D9D9;font-weight:bold;">COURSE TITLE</td><td><strong>${subject.title || ''}</strong></td></tr>
      <tr><td style="background:#D9D9D9;font-weight:bold;">COURSE UNITS</td><td>${units} Units (${lecHours} hrs Lecture, ${labHours} hrs Lab)</td></tr>
      <tr><td style="background:#D9D9D9;font-weight:bold;">PRE-REQUISITES</td><td>${subject.prerequisite || 'None'}</td></tr>
      <tr><td style="background:#D9D9D9;font-weight:bold;">CO-REQUISITES</td><td>${content.coRequisites || 'None'}</td></tr>
      <tr><td style="background:#D9D9D9;font-weight:bold;">TERM OFFERED</td><td>${content.termOffered || item.semester || ''}</td></tr>
      <tr><td style="background:#D9D9D9;font-weight:bold;">PROGRAM/S</td><td>${content.programs || syl.department?.name || ''}</td></tr>
    </tbody>
  </table>

  <table>
    <thead><tr><th class="bar" style="text-align:center;">COURSE OVERVIEW</th></tr></thead>
    <tbody><tr><td>${content.courseDescription || subject.description || ''}</td></tr></tbody>
  </table>

  ${piloPeoMapping.length > 0
          ? `<table>
      <thead>
        <tr><th class="bar" colspan="4">Mapping of Program Intended Learning Outcomes (PILO) and Program Educational Objectives (PEO)</th></tr>
        <tr><th class="sub">Program Intended Learning Outcomes (PILO)</th><th class="sub" style="text-align:center;">PEO 1</th><th class="sub" style="text-align:center;">PEO 2</th><th class="sub" style="text-align:center;">PEO 3</th></tr>
      </thead>
      <tbody>${piloPeoMapping
            .map(
              (r) =>
                `<tr><td>${r.letter}. ${r.outcome || ''}</td><td style="text-align:center;">${r.peo1 ? '✔' : ''}</td><td style="text-align:center;">${r.peo2 ? '✔' : ''}</td><td style="text-align:center;">${r.peo3 ? '✔' : ''}</td></tr>`
            )
            .join('')}</tbody>
    </table>`
          : ''
        }

  ${cilos.length > 0
          ? `<table>
      <thead><tr><th class="bar">COURSE INTENDED LEARNING OUTCOMES</th><th class="bar">MAPPED PILO</th><th class="bar" style="text-align:center;">PEO 1</th><th class="bar" style="text-align:center;">PEO 2</th><th class="bar" style="text-align:center;">PEO 3</th></tr></thead>
      <tbody>${cilos
            .map(
              (c, i) =>
                `<tr><td>${i === 0 ? '<em>Within and upon completion of this course, the students are expected to:</em><br/>' : ''}${c.description || ''}</td><td style="text-align:center;">${c.mappedPilo || ''}</td><td style="text-align:center;">${c.peo1 ? '✔' : ''}</td><td style="text-align:center;">${c.peo2 ? '✔' : ''}</td><td style="text-align:center;">${c.peo3 ? '✔' : ''}</td></tr>`
            )
            .join('')}</tbody>
    </table>`
          : ''
        }

  ${weeklyPlan.some((w) => w.timeFrame || w.intendedLearningOutcome || w.learningContent)
          ? `<table>
      <thead><tr><th class="bar">Time Frame</th><th class="bar">Intended Learning Outcome</th><th class="bar">Assessment</th><th class="bar">Teaching - Learning Activities</th><th class="bar">Learning Content</th><th class="bar">Resources</th></tr></thead>
      <tbody>${weeklyPlan
            .map(
              (w) =>
                `<tr><td>${w.timeFrame || ''}</td><td>${w.intendedLearningOutcome || ''}</td><td>${w.assessment || ''}</td><td>${w.teachingLearningActivities || ''}</td><td>${w.learningContent || ''}</td><td>${w.resources || ''}</td></tr>`
            )
            .join('')}</tbody>
    </table>`
          : ''
        }

  ${integrationSchemes.length > 0
          ? `<table>
      <thead><tr><th class="bar">INTEGRATION SCHEMES</th></tr></thead>
      <tbody><tr><td><ul>${integrationSchemes
            .map((it) => `<li><em><strong>${it.coreValue || ''}</strong> ${it.description || ''}</em></li>`)
            .join('')}</ul></td></tr></tbody>
    </table>`
          : ''
        }

  ${owatGrading.length > 0
          ? `<table class="owat">
      <thead>
        <tr><th class="bar" colspan="4">OWAT (OUTCOME WEIGHT ASSESSMENT TABLE) GRADING SYSTEM</th></tr>
        <tr><th>Outcomes</th><th>Total Weight</th><th>Points Scoring</th><th>Assessment Tool</th></tr>
      </thead>
      <tbody>${owatGrading
            .map((g) => {
              const items = Array.isArray(g.items) && g.items.length > 0 ? g.items : [{ points: '', tool: '' }];
              return items
                .map(
                  (it: any, idx: number) =>
                    `<tr>${idx === 0
                      ? `<td rowspan="${items.length}">${g.outcome || ''}</td><td rowspan="${items.length}" style="text-align:center;vertical-align:middle;">${g.totalWeight || 0}%</td>`
                      : ''
                    }<td style="text-align:center;">${it.points || ''}</td><td>${it.tool || ''}</td></tr>`
                )
                .join('');
            })
            .join('')}</tbody>
    </table>`
          : ''
        }

  ${references.length > 0
          ? `<table><thead><tr><th class="bar">REFERENCES</th></tr></thead><tbody><tr><td><ol>${references
            .map((r) => `<li>${r}</li>`)
            .join('')}</ol></td></tr></tbody></table>`
          : ''
        }

  ${coursePolicies.length > 0
          ? `<table>
      <thead><tr><th class="bar">COURSE POLICIES AND STANDARDS</th></tr></thead>
      <tbody><tr><td><p><em>(Specific classroom guidelines of the course and the teacher, please describe policy as to:)</em></p>${coursePolicies
            .map(
              (p) =>
                `<p><strong>${p.section || ''}</strong></p><ol>${(p.items || []).map((x: string) => `<li>${x}</li>`).join('')}</ol>`
            )
            .join('')}</td></tr></tbody>
    </table>`
          : ''
        }
</body>
</html>`;

      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = defaultName.endsWith('.pdf') ? defaultName.replace(/\.pdf$/i, '.html') : defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download syllabus file:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const countFor = (deptId: string) => syllabi.filter((s) => s.departmentId === deptId).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Syllabi"
        description="Browse, view, and download course syllabi from every department."
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by course, faculty, or file name"
            className="flex-1"
          />
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="input sm:w-72"
            aria-label="Filter by department"
          >
            <option value="">All departments ({syllabi.length})</option>
            {departmentsList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name} ({countFor(d.id)})
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <LoadingState />
        ) : filteredSyllabi.length === 0 ? (
          <EmptyState icon={BookOpen} title="No syllabi found" description="Try a different department or search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Department</th>
                  <th>Faculty</th>
                  <th>Term</th>
                  <th>Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSyllabi.map((item: any) => {
                  const subject = item.subject || item.course || {};
                  return (
                    <tr key={item.id}>
                      <td>
                        <span className="code">{subject.code}</span>
                        <p className="text-slate-900">{subject.title}</p>
                        <p className="text-xs text-slate-500">
                          {subject.units || 3} units · v{item.currentVersionNumber}
                          {item.latestVersion?.fileUrl ? ' · PDF attached' : ''}
                        </p>
                      </td>
                      <td>
                        <DeptTag code={item.departmentId} />
                        <p className="mt-1 max-w-[180px] truncate text-xs text-slate-500">{item.department?.name}</p>
                      </td>
                      <td className="capitalize">{item.instructor?.fullName || subject.professorName || '—'}</td>
                      <td className="whitespace-nowrap text-slate-600">
                        {item.semester}
                        <p className="text-xs text-slate-500">AY {item.academicYear}</p>
                      </td>
                      <td className="whitespace-nowrap text-slate-500">{formatDate(item.updatedAt)}</td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <Link href={`/syllabi/${item.id}`} className="btn btn-secondary btn-sm">
                            View
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(item)}
                            disabled={downloadingId === item.id}
                            className="btn btn-ghost btn-sm"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {downloadingId === item.id ? 'Preparing…' : 'Download'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
