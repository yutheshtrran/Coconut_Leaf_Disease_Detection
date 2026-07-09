import React, { useState } from 'react';
import { Loader2, CheckCircle, AlertTriangle, X, Video, ChevronRight } from 'lucide-react';
import { useJobs } from '../context/JobContext';
import { useNavigate } from 'react-router-dom';

const STAGE_LABELS = {
  stitch:  'Stitching frames…',
  detect:  'Detecting trees…',
  disease: 'Analysing disease…',
};

const JobStatusBadge = () => {
  const { activeJobs, doneJobs, dismissJob } = useJobs();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const total = activeJobs.length + doneJobs.length;
  if (total === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 items-end">
      {/* Collapsed pill */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-900 dark:bg-gray-800 text-white rounded-full shadow-xl border border-gray-700 text-xs font-medium hover:bg-gray-800 dark:hover:bg-gray-700 transition"
        >
          {activeJobs.length > 0 ? (
            <Loader2 size={13} className="animate-spin text-green-400" />
          ) : (
            <CheckCircle size={13} className="text-green-400" />
          )}
          {activeJobs.length > 0
            ? `${activeJobs.length} job${activeJobs.length > 1 ? 's' : ''} running`
            : `${doneJobs.length} job${doneJobs.length > 1 ? 's' : ''} done`}
          <ChevronRight size={13} className="opacity-60" />
        </button>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div className="bg-gray-900 dark:bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-72 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Video size={12} className="text-green-400" /> Background Jobs
            </span>
            <button onClick={() => setExpanded(false)} className="text-gray-500 hover:text-white transition">
              <X size={14} />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {[...activeJobs, ...doneJobs].map(job => (
              <JobRow key={job.sessionId} job={job} onDismiss={dismissJob} onNavigate={() => {
                navigate(`/upload?tab=drone-video&session=${job.sessionId}`);
                setExpanded(false);
              }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function JobRow({ job, onDismiss, onNavigate }) {
  const isActive = job.status === 'processing';
  const isDone   = job.status === 'done';
  const isError  = job.status === 'error';

  return (
    <div className="px-4 py-3 border-b border-gray-800 last:border-0">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">
          {isActive && <Loader2 size={14} className="animate-spin text-blue-400" />}
          {isDone   && <CheckCircle size={14} className="text-green-400" />}
          {isError  && <AlertTriangle size={14} className="text-red-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            Farm Map Analysis
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isActive && (STAGE_LABELS[job.stage] || 'Processing…')}
            {isDone   && `${job.treeMeta?.tree_count || 0} trees detected`}
            {isError  && (job.error || 'Failed')}
          </p>
          {isActive && (
            <div className="mt-1.5 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, job.progress || 0)}%` }}
              />
            </div>
          )}
          {isDone && (
            <button
              onClick={onNavigate}
              className="mt-1.5 text-xs text-green-400 hover:text-green-300 underline"
            >
              View results →
            </button>
          )}
        </div>
        <button onClick={() => onDismiss(job.sessionId)} className="text-gray-600 hover:text-gray-400 transition shrink-0">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

export default JobStatusBadge;
