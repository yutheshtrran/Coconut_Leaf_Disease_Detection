import React, { useState, useRef, useCallback } from 'react';
import { Upload, Play, RefreshCw, Clock, Layers, ZoomIn, X, Download } from 'lucide-react';

const ML = import.meta.env.VITE_ML_URL || 'http://127.0.0.1:5001';

const STITCH_DIMS = [
  { label: '1280 px  (Fast preview)', value: 1280 },
  { label: '1920 px  (Balanced)', value: 1920 },
  { label: '2560 px  (High quality)', value: 2560 },
  { label: '3840 px  (4K — slow)', value: 3840 },
];

export default function VideoToMap() {
  const [file, setFile]           = useState(null);
  const [dragging, setDragging]   = useState(false);
  const [frameStep, setFrameStep] = useState(2);
  const [stitchDim, setStitchDim] = useState(2560);
  const [running, setRunning]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [detail, setDetail]       = useState('');
  const [runs, setRuns]           = useState([]);
  const [startError, setStartError] = useState('');
  const [viewingId, setViewingId] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const pollRef  = useRef(null);
  const fileRef  = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.type.startsWith('video/') || /\.(mp4|mov|avi|mkv)$/i.test(f.name))) {
      setFile(f);
    }
  }, []);

  const handleStart = async () => {
    if (!file || running) return;
    setRunning(true);
    setStartError('');
    setProgress(0);
    setDetail('Uploading…');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('frame_step', String(frameStep));
    fd.append('stitch_dim', String(stitchDim));

    let sid;
    try {
      const r = await fetch(`${ML}/video-to-map/start`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error(`Upload failed (${r.status})`);
      const data = await r.json();
      if (!data.success) throw new Error(data.error || 'Start failed');
      sid = data.session_id;
    } catch (e) {
      const msg = e.message === 'Failed to fetch'
        ? `Cannot reach ML server at ${ML} — is it running? (python app.py run)`
        : e.message;
      setStartError(msg);
      setRunning(false);
      return;
    }

    const entry = {
      id: sid,
      filename: file.name,
      timestamp: new Date().toLocaleTimeString(),
      frameStep,
      stitchDim,
      status: 'running',
      progress: 0,
      detail: 'Running…',
      mapSrc: null,
      width: null, height: null, frames: null, elapsed: null,
      error: null,
    };
    setRuns(prev => [entry, ...prev]);
    setViewingId(sid);

    pollRef.current = setInterval(async () => {
      try {
        const r    = await fetch(`${ML}/video-to-map/progress/${sid}`);
        const data = await r.json();

        setProgress(data.progress ?? 0);
        setDetail(data.detail ?? '');

        setRuns(prev => prev.map(run =>
          run.id === sid
            ? { ...run, progress: data.progress, detail: data.detail, status: data.status }
            : run
        ));

        if (data.status === 'done' || data.status === 'error') {
          clearInterval(pollRef.current);

          if (data.status === 'done') {
            const res    = await fetch(`${ML}/video-to-map/result/${sid}`);
            const result = await res.json();
            setRuns(prev => prev.map(run =>
              run.id === sid
                ? { ...run, status: 'done', mapSrc: result.map_b64,
                    width: result.width, height: result.height,
                    frames: result.frames, elapsed: result.elapsed,
                    method: result.method }
                : run
            ));
          } else {
            setRuns(prev => prev.map(run =>
              run.id === sid ? { ...run, status: 'error', error: data.error } : run
            ));
          }
          setRunning(false);
        }
      } catch (_) {}
    }, 1200);
  };

  const activeRun = runs.find(r => r.id === viewingId) ?? runs.find(r => r.status === 'done');

  const handleDownload = () => {
    if (!activeRun?.mapSrc) return;
    const a = document.createElement('a');
    a.href = activeRun.mapSrc;
    a.download = `ortho_${activeRun.id?.slice(0, 8)}.jpg`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Video to Map</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Stitch drone video into a high-resolution orthomosaic.
          Uses weighted multi-frame blending — no seam lines, no disease detection.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="xl:col-span-1 space-y-4">

          {/* Upload */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Upload className="w-3.5 h-3.5" /> Video File
            </h2>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragging
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                  : file
                  ? 'border-green-400 bg-green-50/50 dark:bg-green-900/10'
                  : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500'
              }`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept="video/*,.mp4,.mov,.avi,.mkv"
                className="hidden"
                onChange={e => { const f = e.target.files[0]; if (f) setFile(f); }}
              />
              {file ? (
                <div>
                  <div className="text-green-600 dark:text-green-400 font-semibold text-sm truncate px-2">
                    {file.name}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(1)} MB — click to change
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Drop video or click to browse</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">MP4 · MOV · AVI · MKV</p>
                </div>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" /> Stitch Parameters
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Frame Sampling
                  </label>
                  <span className="text-xs text-green-600 dark:text-green-400 font-mono">
                    every {frameStep} frame{frameStep > 1 ? 's' : ''}
                  </span>
                </div>
                <input
                  type="range" min="1" max="8" step="1" value={frameStep}
                  onChange={e => setFrameStep(Number(e.target.value))}
                  className="w-full h-1.5 accent-green-500 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                  <span>Dense / slow</span>
                  <span>Sparse / fast</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                  Frame Resolution
                </label>
                <select
                  value={stitchDim}
                  onChange={e => setStitchDim(Number(e.target.value))}
                  className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600
                    bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-2
                    focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {STITCH_DIMS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Start */}
          <button
            onClick={handleStart}
            disabled={!file || running}
            className="w-full py-3 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2
              bg-green-500 hover:bg-green-600 active:bg-green-700 text-white
              disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing… {progress}%
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Create Map
              </>
            )}
          </button>

          {/* Start error */}
          {startError && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-xs text-red-600 dark:text-red-400 break-all">
              {startError}
            </div>
          )}

          {/* Progress */}
          {running && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
                <span className="font-medium">Progress</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2.5 font-mono leading-relaxed break-all">
                {detail}
              </p>
            </div>
          )}

          {/* Run history */}
          {runs.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> Run History
              </h2>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                {runs.map((run, i) => (
                  <button
                    key={run.id}
                    onClick={() => run.status === 'done' && setViewingId(run.id)}
                    disabled={run.status !== 'done'}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-colors
                      disabled:cursor-default
                      ${viewingId === run.id
                        ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                        : run.status === 'done'
                        ? 'border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 cursor-pointer'
                        : 'border-gray-200 dark:border-gray-700'
                      }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                        #{runs.length - i} — {run.filename}
                      </span>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-full font-semibold ${
                        run.status === 'done'  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                        run.status === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                      }`}>
                        {run.status === 'running' ? `${run.progress}%` : run.status}
                      </span>
                    </div>
                    {run.status === 'done' && (
                      <div className="text-gray-400 dark:text-gray-500 mt-1.5 space-x-2">
                        <span>{run.width}×{run.height}</span>
                        <span>·</span>
                        <span>{run.frames}f</span>
                        <span>·</span>
                        <span>{run.elapsed}s</span>
                        {run.method && (
                          <>
                            <span>·</span>
                            <span className={run.method === 'bundle-adjusted'
                              ? 'text-green-500 font-medium'
                              : 'text-yellow-500 font-medium'}>
                              {run.method === 'bundle-adjusted' ? 'BA ✓' : 'fallback'}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    {run.status === 'error' && (
                      <div className="text-red-400 mt-1 truncate">{run.error}</div>
                    )}
                    {run.status === 'running' && (
                      <div className="text-gray-400 dark:text-gray-500 mt-1 truncate">{run.detail}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: map display ──────────────────────────────────── */}
        <div className="xl:col-span-2">
          {activeRun?.mapSrc ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <ZoomIn className="w-3.5 h-3.5" /> Orthomosaic
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex gap-3 text-xs text-gray-400 dark:text-gray-500">
                    {activeRun.width  && <span className="font-mono">{activeRun.width}×{activeRun.height}</span>}
                    {activeRun.frames && <span>{activeRun.frames} frames</span>}
                    {activeRun.elapsed && <span>{activeRun.elapsed}s</span>}
                  </div>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg
                      bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                      text-gray-600 dark:text-gray-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Save
                  </button>
                  <button
                    onClick={() => setFullscreen(true)}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg
                      bg-green-500 hover:bg-green-600 text-white transition-colors"
                  >
                    <ZoomIn className="w-3.5 h-3.5" /> Fullscreen
                  </button>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden bg-black border border-gray-200 dark:border-gray-700">
                <img
                  src={activeRun.mapSrc}
                  alt="Orthomosaic map"
                  className="w-full h-auto block cursor-zoom-in"
                  style={{ maxHeight: '75vh', objectFit: 'contain' }}
                  onClick={() => setFullscreen(true)}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
                <span>Frame dim: {activeRun.stitchDim} px</span>
                {activeRun.method && (
                  <span className={activeRun.method === 'bundle-adjusted'
                    ? 'text-green-500 font-medium'
                    : 'text-yellow-500 font-medium'}>
                    {activeRun.method === 'bundle-adjusted'
                      ? '✓ Bundle-adjusted (SCANS mode)'
                      : '⚠ Trajectory fallback (best-frame-wins)'}
                  </span>
                )}
                <span>Started: {activeRun.timestamp}</span>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700
              flex flex-col items-center justify-center text-center" style={{ minHeight: '60vh' }}>
              {running ? (
                <div className="p-8">
                  <RefreshCw className="w-12 h-12 text-green-500 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">Stitching map…</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">{detail}</p>
                  <div className="mt-4 w-48 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full transition-all duration-700"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : startError ? (
                <div className="p-8 w-full max-w-sm">
                  <div className="text-5xl mb-4">⚠️</div>
                  <p className="text-red-500 text-sm font-medium mb-2">Failed to start</p>
                  <p className="text-xs text-red-400 break-all">{startError}</p>
                </div>
              ) : (
                <div className="p-8">
                  <div className="text-6xl mb-4">🗺️</div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-2">
                    No map yet
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs max-w-xs">
                    Upload a drone video, configure stitch parameters, then click <strong>Create Map</strong>.
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-xs mt-2 max-w-xs">
                    Uses OpenCV bundle adjustment + graph-cut seam finding for a sharp, seamless orthomosaic. Falls back to trajectory stitching if needed.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen lightbox */}
      {fullscreen && activeRun?.mapSrc && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
          onClick={() => setFullscreen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setFullscreen(false)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={activeRun.mapSrc}
            alt="Orthomosaic fullscreen"
            className="max-w-full max-h-full object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
