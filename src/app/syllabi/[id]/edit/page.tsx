'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  AlertCircle,
  GitBranch,
  History,
  CheckCircle2
} from 'lucide-react';

export default function EditSyllabusPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [syllabus, setSyllabus] = useState<any>(null);

  // Editable fields
  const [changeSummary, setChangeSummary] = useState('');
  const [schedule, setSchedule] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [learningOutcomes, setLearningOutcomes] = useState<string[]>([]);
  const [topics, setTopics] = useState<{ week: number; topic: string }[]>([]);
  const [references, setReferences] = useState<string[]>([]);
  const [gradingSystem, setGradingSystem] = useState<{ component: string; weight: number }[]>([]);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/syllabi/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else if (data.syllabus && data.currentVersion) {
          setSyllabus(data.syllabus);
          const c = data.currentVersion.content || {};
          setSchedule(c.schedule || '');
          setCourseDescription(c.courseDescription || data.syllabus.course?.description || '');
          setLearningOutcomes(c.learningOutcomes || ['']);
          setTopics(c.topics || [{ week: 1, topic: '' }]);
          setReferences(c.references || ['']);
          setGradingSystem(c.gradingSystem || [{ component: 'Exams', weight: 40 }]);
        }
      })
      .catch(() => setError('Failed to retrieve syllabus for revision.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Dynamic list handlers
  const addOutcome = () => setLearningOutcomes([...learningOutcomes, '']);
  const updateOutcome = (idx: number, val: string) => {
    const updated = [...learningOutcomes];
    updated[idx] = val;
    setLearningOutcomes(updated);
  };
  const removeOutcome = (idx: number) => {
    setLearningOutcomes(learningOutcomes.filter((_, i) => i !== idx));
  };

  const addTopic = () => {
    const nextWeek = topics.length + 1;
    setTopics([...topics, { week: nextWeek, topic: '' }]);
  };
  const updateTopic = (idx: number, field: 'week' | 'topic', val: any) => {
    const updated = [...topics];
    updated[idx] = { ...updated[idx], [field]: val };
    setTopics(updated);
  };
  const removeTopic = (idx: number) => {
    setTopics(topics.filter((_, i) => i !== idx));
  };

  const addReference = () => setReferences([...references, '']);
  const updateReference = (idx: number, val: string) => {
    const updated = [...references];
    updated[idx] = val;
    setReferences(updated);
  };
  const removeReference = (idx: number) => {
    setReferences(references.filter((_, i) => i !== idx));
  };

  const addGrading = () => setGradingSystem([...gradingSystem, { component: '', weight: 10 }]);
  const updateGrading = (idx: number, field: 'component' | 'weight', val: any) => {
    const updated = [...gradingSystem];
    updated[idx] = { ...updated[idx], [field]: val };
    setGradingSystem(updated);
  };
  const removeGrading = (idx: number) => {
    setGradingSystem(gradingSystem.filter((_, i) => i !== idx));
  };

  const handleSaveRevision = async () => {
    setError('');

    if (!changeSummary.trim()) {
      setError('A Change Summary is mandatory to record what was modified in this version.');
      return;
    }

    setSubmitting(true);

    const payload = {
      changeSummary: changeSummary.trim(),
      changeType: 'Edit',
      schedule,
      courseDescription,
      learningOutcomes: learningOutcomes.filter((o) => o.trim().length > 0),
      topics: topics.filter((t) => t.topic.trim().length > 0),
      references: references.filter((r) => r.trim().length > 0),
      gradingSystem: gradingSystem.filter((g) => g.component.trim().length > 0),
    };

    try {
      const res = await fetch(`/api/syllabi/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save revision.');
        setSubmitting(false);
        return;
      }

      router.push(`/syllabi/${id}`);
    } catch (err) {
      setError('Connection error. Could not record revision in PostgreSQL.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-[#005A36] animate-spin" />
          <p className="text-slate-500 text-xs font-semibold">Loading syllabus for revision...</p>
        </div>
      </div>
    );
  }

  const nextVersionNumber = (syllabus?.currentVersionNumber || 1) + 1;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
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
              <span className="text-xs font-bold text-[#005A36]">{syllabus?.course?.code}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-600 font-medium">Currently on Version {syllabus?.currentVersionNumber}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">Revise Course Syllabus</h1>
          </div>
        </div>

        <button
          onClick={handleSaveRevision}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#005A36] hover:bg-[#004529] text-white flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
        >
          {submitting ? (
            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4 text-[#FEF08A]" />
              <span>Save Version {nextVersionNumber}</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Mandatory Change Summary Banner */}
      <div className="bg-[#FEF9C3] p-6 rounded-2xl border border-[#CA8A04]/40 space-y-3 shadow-sm">
        <div className="flex items-center space-x-2 text-[#854D0E] font-bold text-sm">
          <GitBranch className="w-4 h-4 text-[#CA8A04]" />
          <span>Mandatory Change Summary for Version {nextVersionNumber}</span>
        </div>
        <p className="text-xs text-[#713F12]">
          Describe the modifications made in this revision. All prior versions remain historically preserved and immutable in the database.
        </p>
        <input
          type="text"
          required
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
          placeholder="Describe specific changes made in this version..."
          className="w-full bg-white border border-[#CA8A04]/50 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005A36] focus:ring-1 focus:ring-[#005A36]"
        />
      </div>

      {/* Structured Editable Fields */}
      <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        {/* Schedule & Description */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-[#005A36] uppercase tracking-wider border-b border-slate-100 pb-2">
            1. Course Details & Schedule
          </h2>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Class Schedule</label>
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Class schedule (days and time)"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Course Description</label>
            <textarea
              rows={3}
              value={courseDescription}
              onChange={(e) => setCourseDescription(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
            />
          </div>
        </div>

        {/* Learning Outcomes */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#005A36] uppercase tracking-wider">
              2. Learning Outcomes
            </h2>
            <button
              type="button"
              onClick={addOutcome}
              className="text-xs font-bold text-[#005A36] hover:text-[#004529] flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Outcome</span>
            </button>
          </div>

          <div className="space-y-2">
            {learningOutcomes.map((outcome, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-mono w-6 text-right">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={outcome}
                  onChange={(e) => updateOutcome(idx, e.target.value)}
                  placeholder="Enter learning outcome..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                />
                {learningOutcomes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOutcome(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Topics */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#005A36] uppercase tracking-wider">
              3. Weekly Topics Outline
            </h2>
            <button
              type="button"
              onClick={addTopic}
              className="text-xs font-bold text-[#005A36] hover:text-[#004529] flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Topic</span>
            </button>
          </div>

          <div className="space-y-2">
            {topics.map((t, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-slate-500 font-bold">Wk</span>
                  <input
                    type="number"
                    value={t.week}
                    onChange={(e) => updateTopic(idx, 'week', Number(e.target.value))}
                    className="w-14 bg-white border border-slate-300 rounded-xl px-2 py-2 text-center text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                  />
                </div>
                <input
                  type="text"
                  value={t.topic}
                  onChange={(e) => updateTopic(idx, 'topic', e.target.value)}
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                />
                {topics.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTopic(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Grading & References */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#005A36] uppercase tracking-wider">
                4. Grading Criteria
              </h2>
              <button
                type="button"
                onClick={addGrading}
                className="text-xs font-bold text-[#005A36] hover:text-[#004529] flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {gradingSystem.map((g, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={g.component}
                    onChange={(e) => updateGrading(idx, 'component', e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                  />
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      value={g.weight}
                      onChange={(e) => updateGrading(idx, 'weight', Number(e.target.value))}
                      className="w-16 bg-white border border-slate-300 rounded-xl px-2 py-2 text-center text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                    />
                    <span className="text-xs text-slate-600 font-bold">%</span>
                  </div>
                  {gradingSystem.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGrading(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#005A36] uppercase tracking-wider">
                5. References
              </h2>
              <button
                type="button"
                onClick={addReference}
                className="text-xs font-bold text-[#005A36] hover:text-[#004529] flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Reference</span>
              </button>
            </div>

            <div className="space-y-2">
              {references.map((r, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={r}
                    onChange={(e) => updateReference(idx, e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#005A36]"
                  />
                  {references.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeReference(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
