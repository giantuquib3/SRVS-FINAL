'use client';

import React, { useMemo, useState } from 'react';
import * as Diff from 'diff';
import {
  GitCompare,
  PlusCircle,
  MinusCircle,
  Edit3,
  CheckCircle2,
  Clock,
  XCircle,
  User,
  Calendar,
  Filter,
} from 'lucide-react';
import {
  computeStructuredSyllabusDiff,
  extractReviewComments,
} from '@/lib/syllabus-template';
import { syllabusStatusLabel, roleLabel, formatVersionLabel } from '@/lib/status';

interface SyllabusVersionCompareProps {
  versionA: any;
  versionB: any;
  subject?: { code?: string; title?: string; description?: string; departmentId?: string } | null;
  departmentName?: string;
  labelA?: string;
  labelB?: string;
  versions?: any[];
  onSelectVersionA?: (versionNumber: number) => void;
  onSelectVersionB?: (versionNumber: number) => void;
}

function StatusPill({ status }: { status?: string }) {
  const s = status || 'DRAFT';
  if (s === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        <span>{syllabusStatusLabel(s)}</span>
      </span>
    );
  }
  if (s === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
        <XCircle className="w-3 h-3 text-rose-600" />
        <span>{syllabusStatusLabel(s)}</span>
      </span>
    );
  }
  if (s === 'SUBMITTED' || s === 'UNDER_REVIEW') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
        <Clock className="w-3 h-3 text-amber-600" />
        <span>{syllabusStatusLabel(s)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
      <span>{syllabusStatusLabel(s)}</span>
    </span>
  );
}

function renderInlineWordDiff(beforeText: string, afterText: string, side: 'left' | 'right') {
  const parts = Diff.diffWords(beforeText || '', afterText || '');
  return (
    <div className="whitespace-pre-wrap text-xs leading-relaxed font-sans">
      {parts.map((part, idx) => {
        if (side === 'left') {
          if (part.added) return null;
          if (part.removed) {
            return (
              <span key={idx} className="bg-rose-100 text-rose-900 line-through px-0.5 rounded-sm font-medium">
                {part.value}
              </span>
            );
          }
          return <span key={idx} className="text-slate-700">{part.value}</span>;
        } else {
          if (part.removed) return null;
          if (part.added) {
            return (
              <span key={idx} className="bg-emerald-100 text-emerald-950 font-semibold px-0.5 rounded-sm">
                {part.value}
              </span>
            );
          }
          return <span key={idx} className="text-slate-700">{part.value}</span>;
        }
      })}
    </div>
  );
}

export default function SyllabusVersionCompare({
  versionA,
  versionB,
  subject,
  departmentName,
  labelA,
  labelB,
  versions,
  onSelectVersionA,
  onSelectVersionB,
}: SyllabusVersionCompareProps) {
  const [changedOnly, setChangedOnly] = useState(false);

  const diff = useMemo(
    () => computeStructuredSyllabusDiff(versionA?.content, versionB?.content, subject, departmentName),
    [versionA?.content, versionB?.content, subject, departmentName]
  );

  const displayedItems = changedOnly ? diff.items.filter((i) => i.status !== 'unchanged') : diff.items;
  const totalChanges = diff.addedCount + diff.removedCount + diff.modifiedCount;

  const renderMetaCard = (v: any, defaultTitle: string, accent: 'base' | 'target') => {
    const comments = extractReviewComments(v);
    return (
      <div
        className={`p-4 rounded-2xl border text-xs space-y-2 ${
          accent === 'base'
            ? 'bg-slate-50 border-slate-200'
            : 'bg-emerald-50/50 border-emerald-200'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-extrabold text-sm text-slate-900">
            {defaultTitle} {v?.versionNumber ? `(${formatVersionLabel(v)})` : ''}
          </span>
          <StatusPill status={v?.approvalStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <User className="w-3 h-3 text-slate-400" />
            <strong className="text-slate-800 capitalize">{v?.editor?.fullName || 'Current Editor'}</strong>
            {v?.editor?.role && <span className="text-slate-400">({roleLabel(v.editor.role)})</span>}
          </span>
          {v?.createdAt && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px]">
              <Calendar className="w-3 h-3 text-slate-400" />
              {new Date(v.createdAt).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        {v?.changeSummary && (
          <p className="text-[11px] text-slate-700 bg-white/80 px-2.5 py-1.5 rounded-lg border border-slate-200/70">
            <span className="font-bold text-slate-500">Change Summary:</span> {v.changeSummary}
          </p>
        )}
        {v?.reviewedBy?.fullName && (
          <p className="text-[11px] text-slate-600">
            <span className="font-bold">Reviewed by:</span>{' '}
            <span className="capitalize font-semibold">{v.reviewedBy.fullName}</span>
            {comments ? ` — "${comments}"` : ''}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Selector & Summary Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-[#005A36]" />
              <span>Side-by-Side Syllabus Version Comparison</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review added, removed, and modified content across all USJ-R syllabus sections.
            </p>
          </div>

          {versions && versions.length > 0 && onSelectVersionA && onSelectVersionB && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Base Version (Left)
                </label>
                <select
                  value={versionA?.versionNumber || ''}
                  onChange={(e) => onSelectVersionA(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#005A36]"
                >
                  {versions.map((v: any) => (
                    <option key={v.id} value={v.versionNumber}>
                      {formatVersionLabel(v)} — {syllabusStatusLabel(v.approvalStatus)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Comparison Version (Right)
                </label>
                <select
                  value={versionB?.versionNumber || ''}
                  onChange={(e) => onSelectVersionB(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#005A36]"
                >
                  {versions.map((v: any) => (
                    <option key={v.id} value={v.versionNumber}>
                      {formatVersionLabel(v)} — {syllabusStatusLabel(v.approvalStatus)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Version Metadata Pair */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderMetaCard(versionA, labelA || 'Base Version', 'base')}
          {renderMetaCard(versionB, labelB || 'Proposed / Comparison Version', 'target')}
        </div>

        {/* Diff Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              <PlusCircle className="w-3.5 h-3.5" />
              {diff.addedCount} Added
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
              <MinusCircle className="w-3.5 h-3.5" />
              {diff.removedCount} Removed
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              <Edit3 className="w-3.5 h-3.5" />
              {diff.modifiedCount} Modified
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
              {diff.unchangedCount} Unchanged
            </span>
          </div>

          <button
            type="button"
            onClick={() => setChangedOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
              changedOnly
                ? 'bg-[#005A36] text-white border-[#005A36]'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{changedOnly ? 'Showing Changed Sections Only' : 'Filter: Changed Sections Only'}</span>
          </button>
        </div>
      </div>

      {/* Section-by-Section Side-by-Side Comparison Grid */}
      {totalChanges === 0 && changedOnly ? (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="text-sm font-bold text-slate-800">No Content Differences Detected</p>
          <p className="text-xs text-slate-500">
            The two selected versions contain identical structured syllabus content.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedItems.map((item) => {
            const badgeStyle =
              item.status === 'added'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : item.status === 'removed'
                ? 'bg-rose-100 text-rose-900 border-rose-300'
                : item.status === 'modified'
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-100 text-slate-600 border-slate-200';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${
                  item.status === 'unchanged' ? 'border-slate-200 opacity-85' : 'border-slate-300'
                }`}
              >
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#005A36] block">
                      {item.section}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900">{item.label}</h4>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeStyle}`}>
                    {item.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  {/* Left: Base Version */}
                  <div className={`p-4 ${item.status === 'removed' ? 'bg-rose-50/40' : ''}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      {labelA || `Version ${versionA?.versionNumber || 'Base'}`}
                    </p>
                    {item.status === 'unchanged' ? (
                      <div className="whitespace-pre-wrap text-xs text-slate-600 leading-relaxed">
                        {item.before || <span className="italic text-slate-400">— Empty —</span>}
                      </div>
                    ) : item.before ? (
                      renderInlineWordDiff(item.before, item.after, 'left')
                    ) : (
                      <span className="italic text-xs text-slate-400">— Not present in base version —</span>
                    )}
                  </div>

                  {/* Right: Proposed / Comparison Version */}
                  <div className={`p-4 ${item.status === 'added' ? 'bg-emerald-50/40' : ''}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#005A36] mb-2">
                      {labelB || `Version ${versionB?.versionNumber || 'Proposed'}`}
                    </p>
                    {item.status === 'unchanged' ? (
                      <div className="whitespace-pre-wrap text-xs text-slate-600 leading-relaxed">
                        {item.after || <span className="italic text-slate-400">— Empty —</span>}
                      </div>
                    ) : item.after ? (
                      renderInlineWordDiff(item.before, item.after, 'right')
                    ) : (
                      <span className="italic text-xs text-slate-400">— Removed in comparison version —</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

