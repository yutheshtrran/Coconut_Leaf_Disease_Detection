import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getFarmMapProgress, getFarmMapResult } from '../services/farmMapService';

const JobContext = createContext(null);

const STORAGE_KEY = 'coco_farm_map_jobs';
const POLL_MS = 3000;

// job shape: { sessionId, status: 'processing'|'done'|'error', progress, stage, treeMeta, error, notified, startedAt }
// NOTE: we never persist the full result (map_b64, crop_image) to localStorage — it would exceed the 5 MB quota.
// treeMeta stores only { tree_count, gps } — the lightweight summary shown in the badge.

function stripHeavyFields(jobs) {
  const out = {};
  for (const [sid, job] of Object.entries(jobs)) {
    const { result: _result, ...rest } = job; // drop full result
    out[sid] = rest;
  }
  return out;
}

function loadJobs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

export function JobProvider({ children }) {
  const [jobs, setJobs] = useState(loadJobs);
  const jobsRef = useRef(jobs);

  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  // Persist whenever jobs change — strip base64-heavy result fields first
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripHeavyFields(jobs)));
    } catch {
      // If still too large (e.g. many jobs), evict oldest done jobs and retry
      const evicted = {};
      const sorted = Object.values(jobs).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      for (const j of sorted.slice(0, 5)) evicted[j.sessionId] = j; // keep newest 5
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stripHeavyFields(evicted))); } catch { /* ignore */ }
    }
  }, [jobs]);

  // Request notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const updateJob = useCallback((sid, patch) => {
    setJobs(prev => {
      if (!prev[sid]) return prev;
      return { ...prev, [sid]: { ...prev[sid], ...patch } };
    });
  }, []);

  // Global polling loop — runs independently of any component
  useEffect(() => {
    const poll = async () => {
      const active = Object.values(jobsRef.current).filter(j => j.status === 'processing');
      for (const job of active) {
        try {
          const data = await getFarmMapProgress(job.sessionId);
          if (data.status === 'done') {
            // Fetch lightweight meta only — don't store map_b64 or crop_images in context
            const result = await getFarmMapResult(job.sessionId);
            const treeMeta = { tree_count: result.tree_count || 0, gps: result.gps || null };
            updateJob(job.sessionId, { status: 'done', progress: 100, treeMeta });
            // Browser notification
            if (!job.notified && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('Farm Map Analysis Complete', {
                body: `${treeMeta.tree_count} trees detected. Click to view results.`,
              });
              updateJob(job.sessionId, { notified: true });
            }
          } else if (data.status === 'error') {
            updateJob(job.sessionId, { status: 'error', error: data.error || 'Analysis failed' });
          } else {
            updateJob(job.sessionId, {
              progress: data.progress || 0,
              stage: data.stage,
            });
          }
        } catch { /* network hiccup — keep polling */ }
      }
    };

    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [updateJob]); // stable updateJob ref means this runs once

  const startJob = useCallback((sessionId) => {
    setJobs(prev => ({
      ...prev,
      [sessionId]: {
        sessionId,
        status:    'processing',
        progress:  0,
        stage:     'stitch',
        result:    null,
        error:     null,
        notified:  false,
        startedAt: Date.now(),
      },
    }));
  }, []);

  const dismissJob = useCallback((sessionId) => {
    setJobs(prev => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  }, []);

  const activeJobs = Object.values(jobs).filter(j => j.status === 'processing');
  const doneJobs   = Object.values(jobs).filter(j => j.status === 'done' && !j.dismissed);

  return (
    <JobContext.Provider value={{ jobs, startJob, dismissJob, activeJobs, doneJobs }}>
      {children}
    </JobContext.Provider>
  );
}

export const useJobs = () => {
  const ctx = useContext(JobContext);
  if (!ctx) throw new Error('useJobs must be used inside <JobProvider>');
  return ctx;
};
