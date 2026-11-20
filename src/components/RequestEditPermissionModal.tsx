'use client';

import React, { useState } from 'react';
import { KeyRound, X, Send, AlertCircle } from 'lucide-react';

interface RequestEditPermissionModalProps {
  isOpen: boolean;
  syllabusId: number;
  subjectCode: string;
  subjectTitle: string;
  currentVersionNumber?: number;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function RequestEditPermissionModal({
  isOpen,
  syllabusId,
  subjectCode,
  subjectTitle,
  currentVersionNumber = 1,
  onClose,
  onSuccess,
}: RequestEditPermissionModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please explain why you need permission to edit this syllabus.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/syllabus-edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syllabusId, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit edit permission request.');
        setSubmitting(false);
        return;
      }
      setReason('');
      onSuccess(
        data.message ||
          `Edit permission request for [${subjectCode}] sent to your Department Head.`
      );
      onClose();
    } catch {
      setError('Network error while submitting your request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 bg-[#005A36] text-white flex items-center justify-between border-b-2 border-[#C99700]">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-[#FEF08A]" />
            <div>
              <h3 className="text-sm font-extrabold">Request Syllabus Edit Permission</h3>
              <p className="text-[11px] text-emerald-100">
                Requires approval from your Department Head
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-[#005A36]">{subjectCode}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#005A36] border border-emerald-200 font-mono text-[10px] font-bold">
                Version {currentVersionNumber}
              </span>
            </div>
            <p className="font-bold text-slate-900">{subjectTitle}</p>
          </div>

          <p className="text-slate-600 leading-relaxed">
            Before editing this syllabus, your <strong>Department Head</strong> must grant you edit access. Once
            approved, you can revise the syllabus and submit your proposed changes back to the Department Head to
            generate <strong>Version {currentVersionNumber + 1}</strong>.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-800">
              Reason / Planned Revisions <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Add weekly course outline, learning outcomes, and updated grading weights for this semester."
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl font-bold bg-[#005A36] hover:bg-[#004529] text-white flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-[#FEF08A]" />
              <span>{submitting ? 'Sending...' : 'Send Request to Dept. Head'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

