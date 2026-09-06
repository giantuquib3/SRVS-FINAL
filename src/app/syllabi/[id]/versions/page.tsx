'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  History,
  GitCompare,
  RotateCcw,
  Eye,
  ArrowLeft,
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  GitBranch
} from 'lucide-react';
import * as Diff from 'diff';

export default function VersionHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Comparison state
  const [versionA, setVersionA] = useState<number>(1);
  const [versionB, setVersionB] = useState<number>(1);
  const [showDiff, setShowDiff] = useState(false);

  // Restore state
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [targetRestoreVersion, setTargetRestoreVersion] = useState<any>(null);
  const [restoring, setRestoring] = useState(false);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const [vRes, uRes] = await Promise.all([
        fetch(`/api/syllabi/${id}/versions`),
        fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)),
      ]);

      const vData = await vRes.json();
      if (vData.error) {
        setError(vData.error);
      } else {
        setData(vData);
        if (vData.versions && vData.versions.length > 0) {
          const sorted = vData.versions;
          setVersionB(sorted[0].versionNumber);
          setVersionA(sorted.length > 1 ? sorted[1].versionNumber : sorted[0].versionNumber);
        }
      }
      if (uRes?.user) setCurrentUser(uRes.user);
    } catch (err) {
      setError('Failed to retrieve version history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchVersions();
  }, [id]);

  const handleRestoreConfirm = async () => {
    if (!targetRestoreVersion) return;
    setRestoring(true);
    try {
      const res = await fetch(`/api/syllabi/${id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionNumber: targetRestoreVersion.versionNumber }),
      });
      const resData = await res.json();
      if (res.ok) {
        setRestoreModalOpen(false);
        setTargetRestoreVersion(null);
        await fetchVersions();
      } else {
        alert(resData.error || 'Failed to restore version.');
      }
    } catch (err) {
      alert('Error connecting to server.');
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
          <p className="text-slate-500 text-xs font-semibold">Loading version history...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-[#CA8A04] mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">{error || 'Versions Not Found'}</h2>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
      </div>
    );
  }

  const { syllabus, versions } = data;
  const canRestore = currentUser?.role === 'Educator' || currentUser?.role === 'Admin';

  // Compute diff between selected version A and version B
  const objA = versions.find((v: any) => v.versionNumber === Number(versionA));
  const objB = versions.find((v: any) => v.versionNumber === Number(versionB));

  const textA = objA ? JSON.stringify(objA.content, null, 2) : '';
  const textB = objB ? JSON.stringify(objB.content, null, 2) : '';
  const diffParts = Diff.diffLines(textA, textB);

  const additions = diffParts.filter((p) => p.added).length;
  const deletions = diffParts.filter((p) => p.removed).length;

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center space-x-3">
          <Link
            href={`/syllabi/${id}`}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-extrabold text-[#005A36]">{syllabus.course.code}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-600 font-medium">
                {syllabus.semester}, {syllabus.academicYear}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Immutable Version History & Comparison</h1>
          </div>
        </div>

        <button
          onClick={() => setShowDiff(!showDiff)}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm ${
            showDiff ? 'bg-[#005A36] text-white' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5 text-[#FEF08A]" />
          <span>{showDiff ? 'Hide Diff Viewer' : 'Compare Two Versions'}</span>
        </button>
      </div>

      {/* Interactive Version Comparison Diff Tool */}
      {showDiff && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <GitCompare className="w-4 h-4 text-[#005A36]" />
                <span>Side-by-Side Version Diff Viewer</span>
              </h2>
              <p className="text-xs text-slate-500">
                Inspect additions and deletions between any two historical records
              </p>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  Base Version (Older)
                </label>
                <select
                  value={versionA}
                  onChange={(e) => setVersionA(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:border-[#005A36]"
                >
                  {versions.map((v: any) => (
                    <option key={v.id} value={v.versionNumber}>
                      Version {v.versionNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  Comparison Version (Newer)
                </label>
                <select
                  value={versionB}
                  onChange={(e) => setVersionB(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-semibold focus:outline-none focus:border-[#005A36]"
                >
                  {versions.map((v: any) => (
                    <option key={v.id} value={v.versionNumber}>
                      Version {v.versionNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Stats Banner */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-700 font-medium">
              Comparing <span className="text-[#005A36] font-bold">Version {versionA}</span> → <span className="text-[#854D0E] font-bold">Version {versionB}</span>
            </span>
            <div className="flex items-center space-x-3 font-bold">
              <span className="text-emerald-700">+{additions} line additions</span>
              <span className="text-rose-700">-{deletions} line deletions</span>
            </div>
          </div>

          {/* Diff View Box */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 font-mono text-xs overflow-x-auto max-h-96 leading-relaxed">
            {diffParts.map((part, idx) => {
              if (part.added) {
                return (
                  <div key={idx} className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border-l-2 border-emerald-600 whitespace-pre-wrap">
                    + {part.value}
                  </div>
                );
              }
              if (part.removed) {
                return (
                  <div key={idx} className="bg-rose-100 text-rose-900 line-through px-2 py-0.5 rounded border-l-2 border-rose-600 whitespace-pre-wrap">
                    - {part.value}
                  </div>
                );
              }
              return (
                <div key={idx} className="text-slate-600 px-2 py-0.5 whitespace-pre-wrap">
                  {part.value}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Version History Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <History className="w-4 h-4 text-[#005A36]" />
              <span>Complete Revision Log</span>
            </h2>
            <p className="text-xs text-slate-500">
              Chronological immutable audit records
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#FEF9C3] text-[#854D0E] border border-[#CA8A04]/30">
            {versions.length} Total Versions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                <th className="py-2.5 px-3">Version</th>
                <th className="py-2.5 px-3">Change Summary</th>
                <th className="py-2.5 px-3">Editor / Author</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {versions.map((v: any) => {
                const isCurrent = v.versionNumber === syllabus.currentVersionNumber;
                return (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-3 font-bold">
                      <div className="flex items-center space-x-2">
                        <span className="text-[#005A36]">v{v.versionNumber}</span>
                        {isCurrent && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                            Current
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-900 font-medium max-w-sm">
                      {v.changeSummary}
                    </td>
                    <td className="py-3.5 px-3 text-slate-700">
                      {v.editor?.fullName || 'System'}
                    </td>
                    <td className="py-3.5 px-3 text-slate-500">
                      {new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {v.statusAtSave}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setVersionA(v.versionNumber);
                          setVersionB(syllabus.currentVersionNumber);
                          setShowDiff(true);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      >
                        Compare
                      </button>

                      {canRestore && !isCurrent && (
                        <button
                          onClick={() => {
                            setTargetRestoreVersion(v);
                            setRestoreModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#FEF9C3] hover:bg-[#FEF08A] text-[#854D0E] border border-[#CA8A04]/30 transition-colors cursor-pointer"
                        >
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Restoration */}
      {restoreModalOpen && targetRestoreVersion && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-2xl border border-slate-200 shadow-xl space-y-4 text-slate-900">
            <div className="flex items-center space-x-2 text-[#854D0E] font-bold text-base">
              <RotateCcw className="w-5 h-5 text-[#CA8A04]" />
              <span>Confirm Version Restoration</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Restore this syllabus to <span className="font-bold text-slate-900">Version {targetRestoreVersion.versionNumber}</span> (saved on {new Date(targetRestoreVersion.createdAt).toLocaleDateString()} by {targetRestoreVersion.editor?.fullName})?
            </p>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
              <p className="font-bold">USJ-R Versioning Policy:</p>
              <p>Restoration NEVER deletes prior versions. It will create a new sequential Version {syllabus.currentVersionNumber + 1} containing this historical snapshot.</p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setRestoreModalOpen(false)}
                disabled={restoring}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreConfirm}
                disabled={restoring}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white shadow-sm transition-all cursor-pointer"
              >
                {restoring ? 'Restoring...' : `Confirm & Create Version ${syllabus.currentVersionNumber + 1}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
