'use client';

import React, { useState } from 'react';
import { Alert, Field, Modal } from '@/components/ui';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please describe what you plan to change.');
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
        setError(data.error || 'Failed to send your request.');
        return;
      }
      setReason('');
      onSuccess(data.message || `Edit request for ${subjectCode} sent to your Department Head.`);
      onClose();
    } catch {
      setError('Could not connect to the server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Request edit access"
      description={`${subjectCode} · ${subjectTitle} · Version ${currentVersionNumber}`}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting} className="btn btn-ghost">
            Cancel
          </button>
          <button type="submit" form="edit-request-form" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Sending…' : 'Send request'}
          </button>
        </>
      }
    >
      <form id="edit-request-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-slate-600">
          Your Department Head must approve this request before you can edit. Your changes then go back to them for
          approval as Version {currentVersionNumber + 1}.
        </p>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="What do you plan to change?" required>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Update the weekly plan, learning outcomes, and grading weights for this semester."
            className="input"
            required
          />
        </Field>
      </form>
    </Modal>
  );
}
