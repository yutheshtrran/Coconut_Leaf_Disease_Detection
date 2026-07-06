import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Video, Layers, AlertCircle, RefreshCw,
  ZoomIn, ZoomOut, Maximize2, Leaf, Activity,
  CheckCircle, Loader2, TreePine, X, MapPin,
  ShieldCheck, Microscope, BarChart3, Eye,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import * as farmMapService from '../services/farmMapService';

// ── Design tokens ──────────────────────────────────────────────────────────
const ACCEPTED_VIDEO = '.mp4,.mov,.avi,.mkv,.webm';

const DISEASE_PALETTE = {
  'Healthy':               '#16a34a',
  'Black Beetle Attack':   '#dc2626',
  'Magnesium Deficiency':  '#ea580c',
  'Potassium Deficiency':  '#d97706',
  'Yellow Patches':        '#ca8a04',
};

const DISEASE_BG = {
  'Healthy':               'rgba(22,163,74,0.12)',
  'Black Beetle Attack':   'rgba(220,38,38,0.12)',
  'Magnesium Deficiency':  'rgba(234,88,12,0.12)',
  'Potassium Deficiency':  'rgba(217,119,6,0.12)',
  'Yellow Patches':        'rgba(202,138,4,0.12)',
};

const FEATURES = [
  { icon: '🛸', title: 'Frame Stitching',   desc: 'Multi-stage ORB / DISK feature matching builds a seamless orthomosaic' },
  { icon: '🌴', title: 'Tree Detection',     desc: 'YOLOv8 tiled inference locates every coconut crown with instance masks' },
  { icon: '🔬', title: 'Disease Analysis',   desc: 'Click any tree marker to run per-tree leaf disease classification' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtSize = (b) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

const dColor   = (d) => DISEASE_PALETTE[d] || '#6b7280';
const dBg      = (d) => DISEASE_BG[d]      || 'rgba(107,114,128,0.12)';

// ── Health Ring (SVG) ──────────────────────────────────────────────────────
function HealthRing({ healthy, total }) {
  const pct = total > 0 ? Math.round((healthy / total) * 100) : 0;
  const r = 28, c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor"
          className="text-gray-100 dark:text-gray-700" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke="#16a34a" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <span className="absolute text-sm font-extrabold text-gray-800 dark:text-gray-100">{pct}%</span>
    </div>
  );
}

// ── Map Viewer canvas ──────────────────────────────────────────────────────
function MapViewer({ mapImage, trees, selectedTree, onTreeClick }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef(transform);
  const dragStart    = useRef({ active: false, moved: false, mx: 0, my: 0, tx: 0, ty: 0 });
  const treesRef     = useRef(trees);
  const onClickRef   = useRef(onTreeClick);

  useEffect(() => { transformRef.current = transform; },  [transform]);
  useEffect(() => { treesRef.current    = trees; },       [trees]);
  useEffect(() => { onClickRef.current  = onTreeClick; }, [onTreeClick]);

  const fitView = useCallback(() => {
    const img = mapImage, c = containerRef.current;
    if (!img || !c) return;
    const scale = Math.min(c.clientWidth / img.width, c.clientHeight / img.height, 1);
    setTransform({
      x: (c.clientWidth  - img.width  * scale) / 2,
      y: (c.clientHeight - img.height * scale) / 2,
      scale,
    });
  }, [mapImage]);

  useEffect(() => { fitView(); }, [fitView]);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
    });
    ro.observe(container);
    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;
    return () => ro.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapImage) return;
    const ctx = canvas.getContext('2d');
    const { x, y, scale } = transform;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.drawImage(mapImage, 0, 0);

    const R    = 14 / scale;
    const FONT = Math.max(7, 10 / scale);

    trees.forEach(tree => {
      const isSel  = selectedTree?.tree_id === tree.tree_id;
      const color  = dColor(tree.disease || null);

      // outer glow ring for selected
      if (isSel) {
        ctx.beginPath();
        ctx.arc(tree.cx_px, tree.cy_px, R + 7 / scale, 0, Math.PI * 2);
        ctx.fillStyle = `${color}30`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tree.cx_px, tree.cy_px, R + 4 / scale, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2 / scale;
        ctx.stroke();
      }

      // marker circle
      ctx.beginPath();
      ctx.arc(tree.cx_px, tree.cy_px, R, 0, Math.PI * 2);
      ctx.fillStyle   = isSel ? '#fff' : color;
      ctx.strokeStyle = isSel ? color : 'rgba(255,255,255,0.9)';
      ctx.lineWidth   = (isSel ? 3 : 2) / scale;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur  = 6 / scale;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // label
      ctx.fillStyle    = isSel ? color : '#fff';
      ctx.font         = `bold ${FONT}px system-ui,sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(tree.tree_id), tree.cx_px, tree.cy_px);
    });

    ctx.restore();
  }, [mapImage, trees, selectedTree, transform]);

  // Non-passive wheel
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const { x, y, scale } = transformRef.current;
    const f      = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    const rect   = canvasRef.current.getBoundingClientRect();
    const mx     = e.clientX - rect.left;
    const my     = e.clientY - rect.top;
    const ns     = Math.min(Math.max(scale * f, 0.05), 20);
    const sf     = ns / scale;
    setTransform({ x: mx - sf * (mx - x), y: my - sf * (my - y), scale: ns });
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.addEventListener('wheel', handleWheel, { passive: false });
    return () => c.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const onMouseDown = (e) => {
    dragStart.current = { active: true, moved: false, mx: e.clientX, my: e.clientY,
      tx: transformRef.current.x, ty: transformRef.current.y };
  };
  const onMouseMove = (e) => {
    if (!dragStart.current.active) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (!dragStart.current.moved && Math.hypot(dx, dy) > 4) dragStart.current.moved = true;
    if (dragStart.current.moved)
      setTransform(t => ({ ...t, x: dragStart.current.tx + dx, y: dragStart.current.ty + dy }));
  };
  const onMouseUp = (e) => {
    const wasDrag = dragStart.current.moved;
    dragStart.current.active = false;
    if (wasDrag) return;
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const { x, y, scale } = transformRef.current;
    const cx = (e.clientX - rect.left - x) / scale;
    const cy = (e.clientY - rect.top  - y) / scale;
    const hit = treesRef.current.find(t => Math.hypot(cx - t.cx_px, cy - t.cy_px) < 18 / scale);
    onClickRef.current(hit || null);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-2xl select-none"
      style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)' }}>

      <canvas ref={canvasRef} className="absolute inset-0"
        style={{ cursor: dragStart.current?.moved ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onMouseLeave={() => { dragStart.current.active = false; }} />

      {/* Glass toolbar */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        {[
          { icon: <Maximize2 size={14} />, fn: fitView,     tip: 'Fit view' },
          { icon: <ZoomIn    size={14} />, fn: () => setTransform(t => ({ ...t, scale: Math.min(t.scale * 1.3, 20) })), tip: 'Zoom in' },
          { icon: <ZoomOut   size={14} />, fn: () => setTransform(t => ({ ...t, scale: Math.max(t.scale / 1.3, 0.05) })), tip: 'Zoom out' },
        ].map(({ icon, fn, tip }) => (
          <button key={tip} title={tip} onClick={fn}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white shadow-lg transition">
            {icon}
          </button>
        ))}
      </div>

      {/* Bottom hint bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2
        bg-gradient-to-t from-black/60 to-transparent">
        <span className="text-white/60 text-xs">Scroll · Drag · Click marker</span>
        <span className="text-white/40 text-xs">
          {Math.round(transform.scale * 100)}%
        </span>
      </div>
    </div>
  );
}

// ── Stage stepper (processing) ─────────────────────────────────────────────
const STAGES = [
  { key: 'stitch', label: 'Stitching Frames', icon: '🛸', desc: 'Aligning drone footage into orthomosaic' },
  { key: 'detect', label: 'Detecting Trees',  icon: '🌴', desc: 'Running YOLO tiled inference' },
];

function StageStepper({ progressData }) {
  const { stage, progress = 0, detail } = progressData;
  const STAGE_MAP = { stitch: 1, detect: 2, complete: 3 };
  const cur = STAGE_MAP[stage] || 1;

  return (
    <div className="space-y-8">
      {/* Steps */}
      <div className="relative flex justify-center gap-0">
        {STAGES.map((s, i) => {
          const step   = i + 1;
          const done   = step < cur;
          const active = step === cur;
          return (
            <React.Fragment key={s.key}>
              <div className="flex flex-col items-center gap-2 w-36">
                <div className={`
                  w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg transition-all duration-500
                  ${done   ? 'bg-green-500 shadow-green-500/40 scale-95' : ''}
                  ${active ? 'bg-white dark:bg-gray-700 ring-2 ring-green-400 ring-offset-2 dark:ring-offset-gray-800 scale-100' : ''}
                  ${!done && !active ? 'bg-gray-100 dark:bg-gray-700/50 scale-90 opacity-50' : ''}
                `}>
                  {done ? <CheckCircle size={22} className="text-white" /> : s.icon}
                </div>
                <div className="text-center">
                  <p className={`text-xs font-semibold ${active ? 'text-green-600 dark:text-green-400' : done ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>
                    {s.label}
                  </p>
                  {active && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{s.desc}</p>
                  )}
                </div>
              </div>

              {i < STAGES.length - 1 && (
                <div className="flex-1 flex items-start pt-7 max-w-12">
                  <div className="w-full h-0.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className={`h-full bg-green-400 transition-all duration-700 ${cur > step + 1 ? 'w-full' : cur === step + 1 ? 'w-1/2' : 'w-0'}`} />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-2.5">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {STAGES.find(s => s.key === stage)?.label || 'Processing'}
          </span>
          <span className="text-lg font-extrabold text-green-500">{progress}%</span>
        </div>
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg,#4ade80,#16a34a)',
              boxShadow: '0 0 12px rgba(74,222,128,0.5)',
            }}
          />
        </div>
        {detail && <p className="text-xs text-gray-400 dark:text-gray-500 text-center">{detail}</p>}
      </div>
    </div>
  );
}

// ── Disease badge ──────────────────────────────────────────────────────────
function DiseaseBadge({ disease, size = 'sm' }) {
  if (!disease) return null;
  const color = dColor(disease);
  const bg    = dBg(disease);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
      style={{ backgroundColor: bg, color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {disease}
    </span>
  );
}

// ── Stat mini card ─────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg }) {
  return (
    <div className="flex-1 rounded-xl p-3 text-center min-w-0" style={{ backgroundColor: bg }}>
      <p className="text-lg font-extrabold" style={{ color }}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{label}</p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
const FarmMapAnalysis = () => {
  const { theme } = useTheme();

  const [phase,        setPhase]        = useState('idle');
  const [videoFile,    setVideoFile]    = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const [sessionId,    setSessionId]    = useState(null);
  const [progressData, setProgressData] = useState({ stage: 'stitch', status: 'queued', progress: 0, detail: '' });
  const pollRef = useRef(null);

  const [mapImage,  setMapImage]  = useState(null);
  const [trees,     setTrees]     = useState([]);
  const [treeCount, setTreeCount] = useState(0);
  const [errorMsg,  setErrorMsg]  = useState('');

  const [selectedTree,   setSelectedTree]   = useState(null);
  const [diseaseResult,  setDiseaseResult]  = useState(null);
  const [diseaseLoading, setDiseaseLoading] = useState(false);
  const [diseaseError,   setDiseaseError]   = useState('');

  // ── Polling ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || phase !== 'processing') return;
    const poll = async () => {
      try {
        const data = await farmMapService.getFarmMapProgress(sessionId);
        setProgressData(data);
        if (data.status === 'done')  { clearInterval(pollRef.current); fetchResult(sessionId); }
        if (data.status === 'error') { clearInterval(pollRef.current); setErrorMsg(data.error || 'Failed'); setPhase('error'); }
      } catch { /* network hiccup — keep polling */ }
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => clearInterval(pollRef.current);
  }, [sessionId, phase]);

  const fetchResult = async (sid) => {
    try {
      const data = await farmMapService.getFarmMapResult(sid);
      if (!data.success) { setErrorMsg(data.error || 'Failed'); setPhase('error'); return; }
      setTreeCount(data.tree_count || 0);
      setTrees(data.trees || []);
      if (data.map_b64) {
        const img   = new Image();
        img.onload  = () => { setMapImage(img); setPhase('done'); };
        img.onerror = () => { setErrorMsg('Failed to decode map image'); setPhase('error'); };
        img.src     = data.map_b64;
      } else { setPhase('done'); }
    } catch (err) { setErrorMsg(err.message); setPhase('error'); }
  };

  // ── File handling ──────────────────────────────────────────────────────────
  const pickFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) { alert('Please select a video file.'); return; }
    setVideoFile(file);
  };
  const handleDragOver  = (e) => { e.preventDefault(); setIsDragActive(true); };
  const handleDragLeave = () => setIsDragActive(false);
  const handleDrop = (e) => { e.preventDefault(); setIsDragActive(false); pickFile(e.dataTransfer.files?.[0]); };

  // ── Start ──────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!videoFile) return;
    setPhase('processing');
    setErrorMsg(''); setSelectedTree(null); setDiseaseResult(null); setMapImage(null); setTrees([]);
    try {
      const { session_id } = await farmMapService.startFarmMap(videoFile);
      setSessionId(session_id);
    } catch (err) { setErrorMsg(err.message); setPhase('error'); }
  };

  // ── Disease ────────────────────────────────────────────────────────────────
  const handleAnalyseDisease = async () => {
    if (!selectedTree || !sessionId) return;
    setDiseaseLoading(true); setDiseaseError(''); setDiseaseResult(null);
    try {
      const r = await farmMapService.analyseTreeDisease(sessionId, selectedTree.tree_id);
      if (!r.success) throw new Error(r.error || 'Analysis failed');
      setDiseaseResult(r);
      setTrees(prev => prev.map(t =>
        t.tree_id === selectedTree.tree_id
          ? { ...t, disease: r.disease, disease_confidence: r.disease_confidence } : t));
      setSelectedTree(t => ({ ...t, disease: r.disease, disease_confidence: r.disease_confidence }));
    } catch (err) { setDiseaseError(err.message); }
    finally { setDiseaseLoading(false); }
  };

  const handleReset = () => {
    clearInterval(pollRef.current);
    setPhase('idle'); setVideoFile(null); setSessionId(null);
    setProgressData({ stage: 'stitch', status: 'queued', progress: 0, detail: '' });
    setMapImage(null); setTrees([]); setSelectedTree(null); setDiseaseResult(null); setErrorMsg('');
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const healthyCount    = trees.filter(t => !t.disease || t.disease === 'Healthy').length;
  const atRiskCount     = trees.filter(t => t.disease && t.disease !== 'Healthy').length;
  const unanalysedCount = trees.filter(t => !t.disease).length;

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col gap-4 p-1" style={{ height: 'calc(100vh - 2rem)' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center">
            <Layers size={18} className="text-green-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
              Farm Map Analysis
            </h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Drone video → orthomosaic → tree detection → disease analysis
            </p>
          </div>
        </div>

        {phase !== 'idle' && (
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400
              hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            <RefreshCw size={13} /> New Analysis
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          IDLE — Upload
      ════════════════════════════════════════════════════════════════════════ */}
      {phase === 'idle' && (
        <div className="flex-1 flex items-center justify-center overflow-auto py-4">
          <div className="w-full max-w-2xl space-y-4">

            {/* Upload card */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">

              {/* Gradient banner */}
              <div className="h-2 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400" />

              <div className="p-6 sm:p-8 space-y-6">
                {/* Drop zone */}
                <div
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300
                    ${isDragActive
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20 scale-[1.01]'
                      : 'border-gray-200 dark:border-gray-600 hover:border-green-300 dark:hover:border-green-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/30'}
                  `}
                  style={{ minHeight: 200 }}
                >
                  <input ref={fileInputRef} type="file" accept={ACCEPTED_VIDEO} className="hidden"
                    onChange={e => pickFile(e.target.files?.[0])} />

                  <div className="flex flex-col items-center justify-center p-10 text-center gap-4">
                    {videoFile ? (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Video size={28} className="text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 dark:text-gray-100 text-base">{videoFile.name}</p>
                          <p className="text-sm text-gray-400 mt-0.5">{fmtSize(videoFile.size)}</p>
                        </div>
                        <span className="text-xs text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-full px-3 py-1">
                          Click to change
                        </span>
                      </>
                    ) : (
                      <>
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all
                          ${isDragActive ? 'bg-green-100 dark:bg-green-900/40 scale-110' : 'bg-gray-100 dark:bg-gray-700'}`}>
                          <Upload size={28} className={isDragActive ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-700 dark:text-gray-200 text-base">
                            {isDragActive ? 'Drop it here!' : 'Drop your drone video'}
                          </p>
                          <p className="text-sm text-gray-400 mt-0.5">or click to browse</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          {['MP4', 'MOV', 'AVI', 'MKV', 'WebM'].map((ext, i, a) => (
                            <React.Fragment key={ext}>
                              <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 font-mono">{ext}</span>
                              {i < a.length - 1 && <span className="text-gray-300 dark:text-gray-600">·</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Feature pills */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {FEATURES.map(f => (
                    <div key={f.title}
                      className="flex flex-col gap-2 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 p-3.5">
                      <span className="text-2xl">{f.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{f.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  onClick={handleStart}
                  disabled={!videoFile}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all duration-200
                    disabled:opacity-40 disabled:cursor-not-allowed
                    enabled:hover:scale-[1.01] enabled:active:scale-[0.99] flex items-center justify-center gap-2.5"
                  style={videoFile
                    ? { background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 4px 24px rgba(34,197,94,0.35)' }
                    : { background: '#d1d5db' }}
                >
                  <Activity size={18} />
                  Start Analysis
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PROCESSING
      ════════════════════════════════════════════════════════════════════════ */}
      {phase === 'processing' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400" />

              <div className="p-8 space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 rounded-full bg-green-100 dark:bg-green-900/30 animate-ping opacity-40" />
                    <div className="relative w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Loader2 size={28} className="text-green-500 animate-spin" />
                    </div>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Processing Video</h2>
                  {videoFile && (
                    <p className="text-sm text-gray-400 truncate px-4">
                      {videoFile.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    This may take a few minutes — keep this tab open
                  </p>
                </div>

                <StageStepper progressData={progressData} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ERROR
      ════════════════════════════════════════════════════════════════════════ */}
      {phase === 'error' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-red-100 dark:border-red-900 p-8 text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <AlertCircle size={28} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Analysis Failed</h2>
                <p className="text-sm text-red-500 dark:text-red-400 mt-1.5 leading-relaxed">{errorMsg}</p>
              </div>
              <button onClick={handleReset}
                className="flex items-center gap-2 mx-auto px-6 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold text-sm transition">
                <RefreshCw size={15} /> Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DONE — Map + Panel
      ════════════════════════════════════════════════════════════════════════ */}
      {phase === 'done' && (
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

          {/* ── Map area ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2 flex-1 min-w-0 min-h-0">

            {/* Map status bar */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <span className="inline-flex items-center gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400
                border border-green-200 dark:border-green-800 rounded-full text-xs font-semibold px-3 py-1">
                <CheckCircle size={11} />
                {treeCount} trees detected
              </span>
              {atRiskCount > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400
                  border border-red-100 dark:border-red-900 rounded-full text-xs font-semibold px-3 py-1">
                  <AlertCircle size={11} />
                  {atRiskCount} at risk
                </span>
              )}
              {selectedTree && (
                <span className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400
                  border border-blue-100 dark:border-blue-900 rounded-full text-xs font-medium px-3 py-1">
                  <MapPin size={10} />
                  Tree #{selectedTree.tree_id} selected
                </span>
              )}
            </div>

            {/* Canvas */}
            <div className="flex-1 min-h-0 h-[50vh] lg:h-auto rounded-2xl overflow-hidden shadow-2xl">
              <MapViewer
                mapImage={mapImage} trees={trees}
                selectedTree={selectedTree} onTreeClick={t => { setSelectedTree(t); setDiseaseResult(null); setDiseaseError(''); }}
              />
            </div>
          </div>

          {/* ── Side panel ───────────────────────────────────────────────── */}
          <div className="lg:w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto
            max-h-[50vh] lg:max-h-none pb-2 pr-0.5">

            {/* Stats card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <BarChart3 size={15} className="text-green-500" /> Farm Health
                </p>
                <span className="text-xs text-gray-400">{treeCount} total</span>
              </div>
              <div className="flex items-center gap-4">
                <HealthRing healthy={healthyCount} total={treeCount} />
                <div className="flex-1 space-y-1.5">
                  {[
                    { label: 'Healthy',     value: healthyCount,    color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
                    { label: 'At Risk',     value: atRiskCount,     color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
                    { label: 'Unanalysed',  value: unanalysedCount, color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ backgroundColor: s.bg }}>
                      <span className="text-xs text-gray-600 dark:text-gray-400">{s.label}</span>
                      <span className="text-sm font-extrabold" style={{ color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Empty state */}
            {!selectedTree && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6
                text-center flex-shrink-0 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
                  <Eye size={22} className="text-gray-300 dark:text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">No tree selected</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">
                    Click any numbered marker on the map to select a tree and run disease analysis
                  </p>
                </div>
              </div>
            )}

            {/* Selected tree card */}
            {selectedTree && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0">

                {/* Card header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700"
                  style={{ background: 'linear-gradient(135deg,rgba(34,197,94,0.06),rgba(16,163,74,0.02))' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
                      <TreePine size={14} className="text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">Tree #{selectedTree.tree_id}</span>
                    {selectedTree.disease && <DiseaseBadge disease={selectedTree.disease} />}
                  </div>
                  <button onClick={() => { setSelectedTree(null); setDiseaseResult(null); }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                    <X size={13} />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Detection confidence */}
                  <div>
                    <div className="flex justify-between mb-1.5 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Detection confidence</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {Math.round(selectedTree.confidence * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-700"
                        style={{ width: `${Math.round(selectedTree.confidence * 100)}%` }} />
                    </div>
                  </div>

                  {/* Analyse button */}
                  {!diseaseResult && (
                    <button onClick={handleAnalyseDisease} disabled={diseaseLoading}
                      className="w-full py-2.5 rounded-xl font-semibold text-sm text-white
                        disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                      style={!diseaseLoading
                        ? { background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 2px 12px rgba(34,197,94,0.3)' }
                        : { background: '#86efac' }}>
                      {diseaseLoading
                        ? <><Loader2 size={15} className="animate-spin" /> Analysing…</>
                        : <><Microscope size={15} /> Analyse Disease</>}
                    </button>
                  )}

                  {diseaseError && (
                    <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                      <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                      {diseaseError}
                    </div>
                  )}

                  {/* Disease result */}
                  {diseaseResult && (
                    <div className="space-y-3">
                      {/* Crop */}
                      {diseaseResult.crop_image && (
                        <div className="relative overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700">
                          <img src={diseaseResult.crop_image} alt="Tree crop"
                            className="w-full object-cover" style={{ maxHeight: 150 }} />
                          <div className="absolute bottom-0 left-0 right-0 px-3 py-2
                            bg-gradient-to-t from-black/70 to-transparent">
                            <DiseaseBadge disease={diseaseResult.disease} size="md" />
                          </div>
                        </div>
                      )}

                      {/* Confidence */}
                      <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                        <div className="px-3 py-2.5 flex items-center justify-between"
                          style={{ backgroundColor: dBg(diseaseResult.disease) }}>
                          <span className="text-xs font-semibold" style={{ color: dColor(diseaseResult.disease) }}>
                            {diseaseResult.is_healthy ? '✓ No disease detected' : '⚠ Disease detected'}
                          </span>
                          <span className="text-sm font-extrabold" style={{ color: dColor(diseaseResult.disease) }}>
                            {Math.round(diseaseResult.disease_confidence * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700">
                          <div className="h-full transition-all duration-700"
                            style={{
                              width: `${Math.round(diseaseResult.disease_confidence * 100)}%`,
                              backgroundColor: dColor(diseaseResult.disease),
                            }} />
                        </div>
                      </div>

                      {/* All detections */}
                      {diseaseResult.all_detections?.length > 1 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">All detections</p>
                          {diseaseResult.all_detections.map((d, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dColor(d.disease) }} />
                              <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{d.disease}</span>
                              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                {Math.round(d.confidence * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Re-analyse */}
                      <button onClick={() => { setDiseaseResult(null); setDiseaseError(''); }}
                        className="w-full py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-xs
                          text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center justify-center gap-1.5">
                        <RefreshCw size={12} /> Re-analyse
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
              <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-3">
                Marker Legend
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Unanalysed / Healthy', color: '#16a34a' },
                  { label: 'Black Beetle Attack',   color: '#dc2626' },
                  { label: 'Magnesium Deficiency',  color: '#ea580c' },
                  { label: 'Potassium Deficiency',  color: '#d97706' },
                  { label: 'Yellow Patches',         color: '#ca8a04' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-600 dark:text-gray-400">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default FarmMapAnalysis;
