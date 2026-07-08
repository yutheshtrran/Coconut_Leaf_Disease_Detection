import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Upload as UploadIcon, AlertCircle, CheckCircle, Video,
  Loader2, Download, RefreshCw, ZoomIn, ZoomOut, Maximize2, Activity,
  TreePine, X, MapPin, Microscope, BarChart3, Eye, Image as ImageIcon,
  ChevronLeft, ChevronRight, Plus, FileText,
} from "lucide-react";
import API from "../services/api";
import * as farmMapService from "../services/farmMapService";
import { useJobs } from "../context/JobContext";
import GenerateReportModal from "../components/GenerateReportModal";
import { buildDroneImageAnalysisData, buildDroneVideoAnalysisData } from "../utils/buildAnalysisData";

// ── Farm-map design tokens ─────────────────────────────────────────────────
const ACCEPTED_VIDEO = '.mp4,.mov,.avi,.mkv,.webm';

const DISEASE_PALETTE = {
  'Healthy':               '#16a34a',   // green
  'Black Beetle Attack':   '#ef4444',   // red
  'Magnesium Deficiency':  '#a855f7',   // violet
  'Potassium Deficiency':  '#0ea5e9',   // sky-blue
  'Yellow Patches':        '#eab308',   // amber
};
const DISEASE_BG = {
  'Healthy':               'rgba(22,163,74,0.12)',
  'Black Beetle Attack':   'rgba(239,68,68,0.12)',
  'Magnesium Deficiency':  'rgba(168,85,247,0.12)',
  'Potassium Deficiency':  'rgba(14,165,233,0.12)',
  'Yellow Patches':        'rgba(234,179,8,0.12)',
};
const FEATURES = [
  { icon: '🛸', title: 'Frame Stitching',  desc: 'Multi-stage ORB / DISK feature matching builds a seamless orthomosaic' },
  { icon: '🌴', title: 'Tree Detection',    desc: 'YOLOv8 tiled inference locates every coconut crown with instance masks' },
  { icon: '🔬', title: 'Disease Analysis',  desc: 'Click any tree marker to run per-tree leaf disease classification' },
];
const fmtSize = (b) => b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
const dColor  = (d) => DISEASE_PALETTE[d] || '#6b7280';
const dBg     = (d) => DISEASE_BG[d]      || 'rgba(107,114,128,0.12)';

// ── HealthRing ─────────────────────────────────────────────────────────────
function HealthRing({ healthy, total }) {
  const pct = total > 0 ? Math.round((healthy / total) * 100) : 0;
  const r = 28, c = 2 * Math.PI * r, dash = (pct / 100) * c;
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

// ── MapViewer canvas ───────────────────────────────────────────────────────
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
    setTransform({ x: (c.clientWidth - img.width * scale) / 2, y: (c.clientHeight - img.height * scale) / 2, scale });
  }, [mapImage]);

  useEffect(() => { fitView(); }, [fitView]);

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    const ro = new ResizeObserver(() => { canvas.width = container.clientWidth; canvas.height = container.clientHeight; });
    ro.observe(container);
    canvas.width = container.clientWidth; canvas.height = container.clientHeight;
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapImage) return;
    const ctx = canvas.getContext('2d');
    const { x, y, scale } = transform;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.drawImage(mapImage, 0, 0);
    const R = 14 / scale, FONT = Math.max(7, 10 / scale);
    trees.forEach(tree => {
      const isSel = selectedTree?.tree_id === tree.tree_id;
      const color = dColor(tree.disease || null);
      if (isSel) {
        ctx.beginPath(); ctx.arc(tree.cx_px, tree.cy_px, R + 7 / scale, 0, Math.PI * 2);
        ctx.fillStyle = `${color}30`; ctx.fill();
        ctx.beginPath(); ctx.arc(tree.cx_px, tree.cy_px, R + 4 / scale, 0, Math.PI * 2);
        ctx.strokeStyle = color; ctx.lineWidth = 2 / scale; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(tree.cx_px, tree.cy_px, R, 0, Math.PI * 2);
      ctx.fillStyle = isSel ? '#fff' : color;
      ctx.strokeStyle = isSel ? color : 'rgba(255,255,255,0.9)';
      ctx.lineWidth = (isSel ? 3 : 2) / scale;
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6 / scale;
      ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = isSel ? color : '#fff';
      ctx.font = `bold ${FONT}px system-ui,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(tree.tree_id), tree.cx_px, tree.cy_px);
    });
    ctx.restore();
  }, [mapImage, trees, selectedTree, transform]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const { x, y, scale } = transformRef.current;
    const f = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const ns = Math.min(Math.max(scale * f, 0.05), 20);
    const sf = ns / scale;
    setTransform({ x: mx - sf * (mx - x), y: my - sf * (my - y), scale: ns });
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.addEventListener('wheel', handleWheel, { passive: false });
    return () => c.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const onMouseDown = (e) => { dragStart.current = { active: true, moved: false, mx: e.clientX, my: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y }; };
  const onMouseMove = (e) => {
    if (!dragStart.current.active) return;
    const dx = e.clientX - dragStart.current.mx, dy = e.clientY - dragStart.current.my;
    if (!dragStart.current.moved && Math.hypot(dx, dy) > 4) dragStart.current.moved = true;
    if (dragStart.current.moved) setTransform(t => ({ ...t, x: dragStart.current.tx + dx, y: dragStart.current.ty + dy }));
  };
  const onMouseUp = (e) => {
    const wasDrag = dragStart.current.moved;
    dragStart.current.active = false;
    if (wasDrag) return;
    const canvas = canvasRef.current, rect = canvas.getBoundingClientRect();
    const { x, y, scale } = transformRef.current;
    const cx = (e.clientX - rect.left - x) / scale, cy = (e.clientY - rect.top - y) / scale;
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
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        {[
          { icon: <Maximize2 size={14} />, fn: fitView, tip: 'Fit view' },
          { icon: <ZoomIn size={14} />, fn: () => setTransform(t => ({ ...t, scale: Math.min(t.scale * 1.3, 20) })), tip: 'Zoom in' },
          { icon: <ZoomOut size={14} />, fn: () => setTransform(t => ({ ...t, scale: Math.max(t.scale / 1.3, 0.05) })), tip: 'Zoom out' },
        ].map(({ icon, fn, tip }) => (
          <button key={tip} title={tip} onClick={fn}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white shadow-lg transition">
            {icon}
          </button>
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-2
        bg-gradient-to-t from-black/60 to-transparent">
        <span className="text-white/60 text-xs">Scroll · Drag · Click marker</span>
        <span className="text-white/40 text-xs">{Math.round(transform.scale * 100)}%</span>
      </div>
    </div>
  );
}

// ── StageStepper ───────────────────────────────────────────────────────────
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
      <div className="relative flex justify-center gap-0">
        {STAGES.map((s, i) => {
          const step = i + 1, done = step < cur, active = step === cur;
          return (
            <React.Fragment key={s.key}>
              <div className="flex flex-col items-center gap-2 w-36">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg transition-all duration-500
                  ${done ? 'bg-green-500 shadow-green-500/40 scale-95' : ''}
                  ${active ? 'bg-white dark:bg-gray-700 ring-2 ring-green-400 ring-offset-2 dark:ring-offset-gray-800 scale-100' : ''}
                  ${!done && !active ? 'bg-gray-100 dark:bg-gray-700/50 scale-90 opacity-50' : ''}`}>
                  {done ? <CheckCircle size={22} className="text-white" /> : s.icon}
                </div>
                <div className="text-center">
                  <p className={`text-xs font-semibold ${active ? 'text-green-600 dark:text-green-400' : done ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>{s.label}</p>
                  {active && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{s.desc}</p>}
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
      <div className="space-y-2.5">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{STAGES.find(s => s.key === stage)?.label || 'Processing'}</span>
          <span className="text-lg font-extrabold text-green-500">{progress}%</span>
        </div>
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#4ade80,#16a34a)', boxShadow: '0 0 12px rgba(74,222,128,0.5)' }} />
        </div>
        {detail && <p className="text-xs text-gray-400 dark:text-gray-500 text-center">{detail}</p>}
      </div>
    </div>
  );
}

// ── DiseaseBadge ───────────────────────────────────────────────────────────
function DiseaseBadge({ disease, size = 'sm' }) {
  if (!disease) return null;
  const color = dColor(disease), bg = dBg(disease);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
      style={{ backgroundColor: bg, color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {disease}
    </span>
  );
}

// Animated step labels shown while drone video is processing
const DRONE_VIDEO_STATUSES = [
  "Uploading video…",
  "Extracting frames…",
  "Generating panoramic image…",
  "Detecting & numbering coconut trees…",
  "Finalising results…",
];

// ── Drone image fullscreen viewer (pan/zoom + click-to-preview) ────────────
function DroneImageViewer({ src, trees, focusTree }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const [transform,  setTransform]  = useState({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragStart    = useRef({ active: false, moved: false, mx: 0, my: 0, tx: 0, ty: 0 });
  const treesRef     = useRef(trees);
  const [mapImg,     setMapImg]     = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [popupTree,  setPopupTree]  = useState(null);

  const applyTransform = useCallback((t) => { setTransform(t); transformRef.current = t; }, []);

  useEffect(() => { treesRef.current = trees; }, [trees]);

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => setMapImg(img);
    img.src = src;
  }, [src]);

  const fitView = useCallback(() => {
    const img = mapImg, c = containerRef.current;
    if (!img || !c) return;
    const scale = Math.min(c.clientWidth / img.width, c.clientHeight / img.height, 1);
    applyTransform({ x: (c.clientWidth - img.width * scale) / 2, y: (c.clientHeight - img.height * scale) / 2, scale });
    setPopupTree(null);
  }, [mapImg, applyTransform]);

  const zoomAt = (factor) => {
    const { x, y, scale } = transformRef.current;
    const c = containerRef.current;
    if (!c) return;
    const cx = c.clientWidth / 2, cy = c.clientHeight / 2;
    const ns = Math.min(Math.max(scale * factor, 0.1), 15);
    const sf = ns / scale;
    applyTransform({ x: cx - sf * (cx - x), y: cy - sf * (cy - y), scale: ns });
  };

  useEffect(() => { fitView(); }, [fitView]);

  // Zoom to focusTree once image is loaded
  useEffect(() => {
    if (!focusTree || !mapImg || !containerRef.current) return;
    const c   = containerRef.current;
    const tw  = Math.max(focusTree.x2 - focusTree.x1, 1);
    const th  = Math.max(focusTree.y2 - focusTree.y1, 1);
    const tcx = (focusTree.x1 + focusTree.x2) / 2;
    const tcy = (focusTree.y1 + focusTree.y2) / 2;
    const scale = Math.min((c.clientWidth * 0.6) / tw, (c.clientHeight * 0.6) / th, 8);
    const t = { x: c.clientWidth / 2 - tcx * scale, y: c.clientHeight / 2 - tcy * scale, scale };
    applyTransform(t);
    setPopupTree({ tree: focusTree, px: tcx * scale + t.x, py: tcy * scale + t.y });
  }, [mapImg, focusTree, applyTransform]);

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current, c = containerRef.current;
    if (!canvas || !c) return;
    const resize = () => { canvas.width = c.clientWidth; canvas.height = c.clientHeight; };
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    resize();
    return () => ro.disconnect();
  }, []);

  // Draw image on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapImg) return;
    const ctx = canvas.getContext('2d');
    const { x, y, scale } = transform;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.drawImage(mapImg, 0, 0);
    ctx.restore();
  }, [mapImg, transform]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const { x, y, scale } = transformRef.current;
    const f    = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx   = e.clientX - rect.left, my = e.clientY - rect.top;
    const ns   = Math.min(Math.max(scale * f, 0.1), 15);
    const sf   = ns / scale;
    applyTransform({ x: mx - sf * (mx - x), y: my - sf * (my - y), scale: ns });
  }, [applyTransform]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.addEventListener('wheel', handleWheel, { passive: false });
    return () => c.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const onMouseDown = (e) => {
    dragStart.current = { active: true, moved: false, mx: e.clientX, my: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y };
    setIsDragging(true);
  };
  const onMouseMove = (e) => {
    if (!dragStart.current.active) return;
    const dx = e.clientX - dragStart.current.mx, dy = e.clientY - dragStart.current.my;
    if (!dragStart.current.moved && Math.hypot(dx, dy) > 4) dragStart.current.moved = true;
    if (dragStart.current.moved)
      applyTransform({ ...transformRef.current, x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
  };
  const onMouseUp = (e) => {
    const wasDrag = dragStart.current.moved;
    dragStart.current.active = false;
    setIsDragging(false);
    if (wasDrag) return;
    const canvas = canvasRef.current, rect = canvas.getBoundingClientRect();
    const { x, y, scale } = transformRef.current;
    const imgX = (e.clientX - rect.left - x) / scale;
    const imgY = (e.clientY - rect.top  - y) / scale;
    const hit  = treesRef.current?.find(t => imgX >= t.x1 && imgX <= t.x2 && imgY >= t.y1 && imgY <= t.y2);
    if (hit) setPopupTree({ tree: hit, px: e.clientX - rect.left, py: e.clientY - rect.top });
    else     setPopupTree(null);
  };

  const cW   = containerRef.current?.clientWidth  || 600;
  const cH   = containerRef.current?.clientHeight || 500;
  const PW   = 224;
  const PH   = popupTree?.tree?.crop_image ? 340 : 160;
  const pLeft = popupTree ? Math.min(popupTree.px + 14, cW - PW - 8) : 0;
  const pTop  = popupTree ? Math.min(popupTree.py + 14, cH - PH - 8) : 0;

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ background: '#0a0f1a' }}>
      <canvas ref={canvasRef} className="absolute inset-0"
        style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onMouseLeave={() => { dragStart.current.active = false; setIsDragging(false); }} />

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        {[
          { icon: <Maximize2 size={14} />,  fn: fitView,          tip: 'Fit view'  },
          { icon: <ZoomIn  size={14} />,    fn: () => zoomAt(1.3),       tip: 'Zoom in'   },
          { icon: <ZoomOut size={14} />,    fn: () => zoomAt(1 / 1.3),   tip: 'Zoom out'  },
        ].map(({ icon, fn, tip }) => (
          <button key={tip} title={tip} onClick={fn}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white shadow-lg transition">
            {icon}
          </button>
        ))}
      </div>

      {/* Hint + scale % */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 z-10 pointer-events-none">
        <span className="text-white/35 text-xs">Scroll · drag · click a box</span>
        <span className="text-white/25 text-xs tabular-nums">{Math.round(transform.scale * 100)}%</span>
      </div>

      {/* Per-tree popup */}
      {popupTree && (
        <div className="absolute z-20 rounded-2xl overflow-hidden border border-white/15 shadow-2xl"
          style={{ left: pLeft, top: pTop, width: PW, background: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(16px)' }}>
          {popupTree.tree.crop_image && (
            <div style={{ aspectRatio: '1/1', background: '#111827' }}>
              <img src={popupTree.tree.crop_image} alt={`Tree #${popupTree.tree.tree_id}`}
                className="w-full h-full object-contain" />
            </div>
          )}
          <div className="p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold text-sm">Tree #{popupTree.tree.tree_id}</span>
              <button onClick={() => setPopupTree(null)}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition">
                <X size={13} />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dColor(popupTree.tree.disease) }} />
              <span className="text-xs font-semibold" style={{ color: dColor(popupTree.tree.disease) }}>
                {popupTree.tree.disease}
              </span>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full"
                  style={{ width: `${Math.round((popupTree.tree.disease_confidence ?? 1) * 100)}%`, backgroundColor: dColor(popupTree.tree.disease) }} />
              </div>
              <p className="text-xs text-white/40 text-right tabular-nums">
                {Math.round((popupTree.tree.disease_confidence ?? 1) * 100)}%
              </p>
            </div>
            {popupTree.tree.all_detections?.length > 1 && (
              <div className="space-y-1 pt-1 border-t border-white/10">
                {popupTree.tree.all_detections.slice(0, 3).map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-white/50 truncate">{d.disease}</span>
                    <span className="text-white/40 tabular-nums flex-shrink-0 ml-2">{Math.round(d.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Zoomable single-image viewer (scroll/pinch to zoom, drag to pan) ──────────
function ZoomableImage({ src, alt }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const [transform,  setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragStart    = useRef({ active: false, moved: false, mx: 0, my: 0, tx: 0, ty: 0 });
  const [mapImg,     setMapImg]    = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const applyT = useCallback((t) => { setTransform(t); transformRef.current = t; }, []);

  // Reload image when src changes
  useEffect(() => {
    if (!src) return;
    setMapImg(null);
    const img = new Image();
    img.onload = () => setMapImg(img);
    img.src = src;
  }, [src]);

  // Fit image inside container, centered
  const fitView = useCallback(() => {
    const img = mapImg, c = containerRef.current;
    if (!img || !c) return;
    const scale = Math.min(c.clientWidth / img.width, c.clientHeight / img.height, 1);
    applyT({
      x: (c.clientWidth  - img.width  * scale) / 2,
      y: (c.clientHeight - img.height * scale) / 2,
      scale,
    });
  }, [mapImg, applyT]);

  useEffect(() => { fitView(); }, [fitView]);

  // Keep canvas sized to container
  useEffect(() => {
    const canvas = canvasRef.current, c = containerRef.current;
    if (!canvas || !c) return;
    const resize = () => { canvas.width = c.clientWidth; canvas.height = c.clientHeight; };
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    resize();
    return () => ro.disconnect();
  }, []);

  // Redraw whenever image or transform changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapImg) return;
    const ctx = canvas.getContext('2d');
    const { x, y, scale } = transform;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.drawImage(mapImg, 0, 0);
    ctx.restore();
  }, [mapImg, transform]);

  // Scroll-wheel zoom centred on cursor
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const { x, y, scale } = transformRef.current;
    const f    = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx   = e.clientX - rect.left, my = e.clientY - rect.top;
    const ns   = Math.min(Math.max(scale * f, 0.3), 12);
    const sf   = ns / scale;
    applyT({ x: mx - sf * (mx - x), y: my - sf * (my - y), scale: ns });
  }, [applyT]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.addEventListener('wheel', handleWheel, { passive: false });
    return () => c.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Drag to pan
  const onMouseDown = (e) => {
    dragStart.current = { active: true, moved: false, mx: e.clientX, my: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y };
    setIsDragging(true);
  };
  const onMouseMove = (e) => {
    if (!dragStart.current.active) return;
    const dx = e.clientX - dragStart.current.mx, dy = e.clientY - dragStart.current.my;
    if (!dragStart.current.moved && Math.hypot(dx, dy) > 3) dragStart.current.moved = true;
    if (dragStart.current.moved)
      applyT({ ...transformRef.current, x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
  };
  const onMouseUp = () => { dragStart.current.active = false; setIsDragging(false); };

  // Button zoom centred on canvas centre
  const zoomBtn = (factor) => {
    const { x, y, scale } = transformRef.current;
    const c = containerRef.current;
    if (!c) return;
    const cx = c.clientWidth / 2, cy = c.clientHeight / 2;
    const ns = Math.min(Math.max(scale * factor, 0.3), 12);
    const sf = ns / scale;
    applyT({ x: cx - sf * (cx - x), y: cy - sf * (cy - y), scale: ns });
  };

  const pct = Math.round(transform.scale * 100);

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ background: 'transparent' }}>
      <canvas ref={canvasRef} className="absolute inset-0"
        style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp} />

      {/* Zoom controls — bottom-right */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-10">
        <span className="text-white/30 text-xs tabular-nums">{pct}%</span>
        <button onClick={() => zoomBtn(1.3)} title="Zoom in"
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/10 text-white transition">
          <ZoomIn size={14} />
        </button>
        <button onClick={() => zoomBtn(1 / 1.3)} title="Zoom out"
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/10 text-white transition">
          <ZoomOut size={14} />
        </button>
        <button onClick={fitView} title="Fit"
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/10 text-white transition">
          <Maximize2 size={13} />
        </button>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-3 left-3 pointer-events-none">
        <span className="text-white/20 text-xs">Scroll · drag</span>
      </div>
    </div>
  );
}

const Upload = () => {
  const { startJob, jobs } = useJobs();
  const [searchParams] = useSearchParams();
  const [notes, setNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [diseaseLevels, setDiseaseLevels] = useState([]); // aggregated results
  const [diseaseRemedies, setDiseaseRemedies] = useState({}); // map of disease -> remedy
  const [healthyPercent, setHealthyPercent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [videoAnalysis, setVideoAnalysis] = useState(null); // Video analysis results
  const [uploadType, setUploadType] = useState(null); // 'image' or 'video'
  const [droneResult, setDroneResult] = useState(null); // Drone processing results
  const [showDroneModal, setShowDroneModal] = useState(false); // Modal for drone results
  const [reportMessage, setReportMessage] = useState(''); // Report save feedback
  const [reportError, setReportError] = useState('');
  const [annotatedResults, setAnnotatedResults] = useState([]); // per-image annotated outputs
  const [fullscreenImage, setFullscreenImage]   = useState(null); // image shown in full-screen modal

  // ── Farm-map (Drone Video tab) state ──────────────────────────────────
  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return tab === 'drone-video' ? 'drone-video' : 'drone-images';
  });
  const [fmPhase,        setFmPhase]        = useState('idle'); // idle | processing | done | error
  const [fmVideoFile,    setFmVideoFile]    = useState(null);
  const [fmIsDragActive, setFmIsDragActive] = useState(false);
  const fmFileInputRef = useRef(null);
  const [fmSessionId,    setFmSessionId]    = useState(null);
  const [fmProgressData, setFmProgressData] = useState({ stage: 'stitch', status: 'queued', progress: 0, detail: '' });
  const fmPollRef = useRef(null);
  const [fmMapImage,     setFmMapImage]     = useState(null);
  const [fmTrees,        setFmTrees]        = useState([]);
  const [fmTreeCount,    setFmTreeCount]    = useState(0);
  const [fmErrorMsg,     setFmErrorMsg]     = useState('');
  const [fmSelectedTree,   setFmSelectedTree]   = useState(null);
  const [fmDiseaseResult,  setFmDiseaseResult]  = useState(null);
  const [fmDiseaseLoading, setFmDiseaseLoading] = useState(false);
  const [fmDiseaseError,   setFmDiseaseError]   = useState('');
  const [fmDetectedGps,    setFmDetectedGps]    = useState(null);
  const [showFmReportModal, setShowFmReportModal] = useState(false);

  const handleNotesChange = (e) => setNotes(e.target.value);

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles(files);
      setAnnotatedResults([]);
      const firstFile = files[0];
      const isVideo = firstFile.type && firstFile.type.startsWith('video/');
      setUploadType(isVideo ? 'video' : 'image');
    }
  };
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
      setAnnotatedResults([]);
      const firstFile = e.target.files[0];
      const isVideo = firstFile.type.startsWith('video/');
      setUploadType(isVideo ? 'video' : 'image');
    }
  };

  const isVideoFile = (file) => file.type.startsWith('video/');

  const handleStartAnalysis = async () => {
    if (selectedFiles.length === 0) return alert("Please upload at least one file.");

    const firstFile = selectedFiles[0];
    const isVideo = isVideoFile(firstFile);

    if (isVideo) {
      // Handle video analysis
      await handleVideoAnalysis(firstFile);
    } else {
      // Handle image analysis
      await handleImageAnalysis();
    }
  };

  const handleImageAnalysis = async () => {
    setLoading(true);
    setVideoAnalysis(null);
    setAnnotatedResults([]);
    setReportMessage('');
    setReportError('');

    const counts = {}; // disease occurrence counts
    const totalImages = selectedFiles.length;
    const annotated = [];

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("http://127.0.0.1:5001/predict", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();

        // Support responses shaped like { prediction: { disease, confidence, percentage }, ... }
        const pred = data && (data.prediction || data);
        const diseaseName = (pred && (pred.disease || pred.class)) || 'Unknown';
        const confidenceVal = pred && (pred.percentage ?? (pred.confidence != null ? Math.round(pred.confidence * 100) : null));
        const remedy = pred && pred.remedy;

        if (!counts[diseaseName]) counts[diseaseName] = 0;
        counts[diseaseName] += 1;

        if (remedy) setDiseaseRemedies(prev => ({ ...prev, [diseaseName]: remedy }));

        if (pred?.annotated_image) {
          annotated.push({
            filename: file.name,
            disease: diseaseName,
            confidence: confidenceVal,
            top3: pred.top3 || [],
            image: pred.annotated_image,
          });
        }
      } catch (err) {
        console.error("Prediction error:", err);
      }
    }
    setAnnotatedResults(annotated);

    // Convert counts to percentages
    const aggregatedResults = Object.keys(counts).map((name) => ({
      name,
      level: Math.round((counts[name] / totalImages) * 100),
    }));

    // Compute healthy percentage (case-insensitive key match)
    const healthyCount = Object.keys(counts).reduce((acc, n) => acc + ((n && n.toLowerCase() === 'healthy') ? counts[n] : 0), 0);
    const healthyPct = totalImages > 0 ? Math.round((healthyCount / totalImages) * 100) : 0;

    setHealthyPercent(healthyPct);
    setDiseaseLevels(aggregatedResults);

    // Save analysis as report to backend
    await saveAnalysisReport(aggregatedResults, healthyPct);

    setLoading(false);
  };

  const saveAnalysisReport = async (diseases, healthyPercent) => {
    try {
      const farmName = 'General Analysis';

      // Determine primary issue and severity
      let primaryIssue = 'Plantation Health Analysis';
      let maxSeverityValue = 0;
      let maxSeverityLabel = 'LOW';

      if (diseases.length > 0) {
        // Find the disease with highest percentage
        const worstDisease = diseases.reduce((prev, current) =>
          (prev.level > current.level) ? prev : current
        );

        primaryIssue = `${worstDisease.name} detected (${worstDisease.level}%)`;
        maxSeverityValue = worstDisease.level;

        // Determine severity label based on percentage
        if (maxSeverityValue >= 75) {
          maxSeverityLabel = 'CRITICAL';
        } else if (maxSeverityValue >= 50) {
          maxSeverityLabel = 'HIGH';
        } else if (maxSeverityValue >= 25) {
          maxSeverityLabel = 'MODERATE';
        } else {
          maxSeverityLabel = 'LOW';
        }
      }

      const reportData = {
        farm: farmName,
        date: new Date().toISOString().split('T')[0],
        issue: primaryIssue,
        severity: {
          value: maxSeverityValue,
          label: maxSeverityLabel
        },
        status: 'Finalized',
        note: notes || null,
        analysisData: {
          totalImagesAnalyzed: selectedFiles.length,
          healthyPercent,
          diseases: diseases.map(d => ({ name: d.name, percentage: d.level }))
        }
      };

      const response = await API.post('/reports', reportData);
      setReportMessage('Analysis saved as report successfully!');

      // Clear message after 3 seconds
      setTimeout(() => setReportMessage(''), 3000);
    } catch (err) {
      console.error('Error saving analysis as report:', err);
      setReportError(err.response?.data?.message || 'Failed to save analysis report');
    }
  };

  const handleVideoAnalysis = async (videoFile) => {
    setLoading(true);
    setHealthyPercent(null);
    setDiseaseLevels([]);

    const formData = new FormData();
    formData.append("file", videoFile);

    try {
      const response = await fetch("http://127.0.0.1:5001/analyze-video", {
        method: "POST",
        body: formData,
      });

      let data = null;
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error('Failed to parse JSON response from /analyze-video', parseErr);
      }

      if (!response.ok) {
        const msg = (data && (data.error || data.message)) || `Server returned ${response.status}`;
        console.error('Video analysis failed:', response.status, data);
        alert(`Video analysis failed: ${msg}`);
        setLoading(false);
        return;
      }

      // Parse video analysis response
      const analysis = {
        coconutTreesFound: data.coconut_trees_found || data.tree_count || 0,
        farmSize: data.farm_size || data.area || 0,
        farmSizeUnit: data.farm_size_unit || 'hectares',
        healthyTrees: data.healthy_trees || 0,
        diseasedTrees: data.diseased_trees || 0,
        treeHealth: data.tree_health_percentage || 0,
        diseaseBreakdown: data.disease_breakdown || {},
        canopyDensity: data.canopy_density || 0,
        videoProcessed: true,
      };

      setVideoAnalysis(analysis);
    } catch (err) {
      console.error("Video analysis error:", err);
      alert("Error analyzing video. Make sure the backend supports video analysis.");
    }

    setLoading(false);
  };

  const handleDroneProcessing = async () => {
    if (selectedFiles.length < 2) {
      alert("Please select at least 2 images for drone processing");
      return;
    }

    setLoading(true);
    setVideoAnalysis(null);
    setHealthyPercent(null);
    setDiseaseLevels([]);

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append("files", file);
    });

    try {
      const response = await fetch("http://127.0.0.1:5001/process-drone-images", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`Drone processing failed: ${data.error || 'Unknown error'}`);
        setLoading(false);
        return;
      }

      setDroneResult(data);
      setShowDroneModal(true);
    } catch (err) {
      console.error("Drone processing error:", err);
      alert("Error processing drone images. Make sure the backend supports drone processing.");
    }

    setLoading(false);
  };

  // ── Farm-map polling ───────────────────────────────────────────────────
  useEffect(() => {
    if (!fmSessionId || fmPhase !== 'processing') return;
    const poll = async () => {
      try {
        const data = await farmMapService.getFarmMapProgress(fmSessionId);
        setFmProgressData(data);
        if (data.status === 'done')  { clearInterval(fmPollRef.current); fmFetchResult(fmSessionId); }
        if (data.status === 'error') {
          clearInterval(fmPollRef.current);
          if (data.traceback) console.error('[FarmMap] Server traceback:\n', data.traceback);
          setFmErrorMsg(data.error || 'Pipeline failed — check the ML server console for the traceback');
          setFmPhase('error');
        }
      } catch (err) {
        // 404 = session gone (server restarted); stop polling and reset
        if (err.message?.includes('404')) {
          clearInterval(fmPollRef.current);
          setFmErrorMsg('Session expired — the ML server was restarted. Please upload the video again.');
          setFmPhase('error');
        }
        // Other errors (network blip) — keep polling silently
      }
    };
    poll();
    fmPollRef.current = setInterval(poll, 2000);
    return () => clearInterval(fmPollRef.current);
  }, [fmSessionId, fmPhase]);

  const fmFetchResult = async (sid) => {
    try {
      const data = await farmMapService.getFarmMapResult(sid);
      if (!data.success) {
        // 404 / session-not-found after server restart — just reset quietly
        if (data.status === 404 || data.error?.toLowerCase().includes('not found')) {
          setFmPhase('idle');
          return;
        }
        setFmErrorMsg(data.error || 'Failed');
        setFmPhase('error');
        return;
      }
      setFmTreeCount(data.tree_count || 0);
      setFmTrees(data.trees || []);
      if (data.gps?.lat != null) setFmDetectedGps({ lat: data.gps.lat, lon: data.gps.lon });
      if (data.map_b64) {
        const img = new Image();
        img.onload  = () => { setFmMapImage(img); setFmPhase('done'); };
        img.onerror = () => { setFmErrorMsg('Failed to decode map image'); setFmPhase('error'); };
        img.src = data.map_b64;
      } else { setFmPhase('done'); }
    } catch (err) { setFmErrorMsg(err.message); setFmPhase('error'); }
  };

  const fmPickFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) { alert('Please select a video file.'); return; }
    setFmVideoFile(file);
  };
  const fmHandleDragOver  = (e) => { e.preventDefault(); setFmIsDragActive(true); };
  const fmHandleDragLeave = () => setFmIsDragActive(false);
  const fmHandleDrop = (e) => { e.preventDefault(); setFmIsDragActive(false); fmPickFile(e.dataTransfer.files?.[0]); };

  const fmHandleStart = async () => {
    if (!fmVideoFile) return;
    setFmPhase('processing');
    setFmErrorMsg(''); setFmSelectedTree(null); setFmDiseaseResult(null); setFmMapImage(null); setFmTrees([]); setFmDetectedGps(null);
    try {
      const { session_id } = await farmMapService.startFarmMap(fmVideoFile);
      setFmSessionId(session_id);
      startJob(session_id);
    } catch (err) { setFmErrorMsg(err.message); setFmPhase('error'); }
  };

  const fmHandleAnalyseDisease = async () => {
    if (!fmSelectedTree || !fmSessionId) return;
    setFmDiseaseLoading(true); setFmDiseaseError(''); setFmDiseaseResult(null);
    try {
      const r = await farmMapService.analyseTreeDisease(fmSessionId, fmSelectedTree.tree_id);
      if (!r.success) throw new Error(r.error || 'Analysis failed');
      setFmDiseaseResult(r);
      setFmTrees(prev => prev.map(t =>
        t.tree_id === fmSelectedTree.tree_id
          ? { ...t, disease: r.disease, disease_confidence: r.disease_confidence } : t));
      setFmSelectedTree(t => ({ ...t, disease: r.disease, disease_confidence: r.disease_confidence }));
    } catch (err) { setFmDiseaseError(err.message); }
    finally { setFmDiseaseLoading(false); }
  };

  const fmHandleReset = () => {
    clearInterval(fmPollRef.current);
    setFmPhase('idle'); setFmVideoFile(null); setFmSessionId(null);
    setFmProgressData({ stage: 'stitch', status: 'queued', progress: 0, detail: '' });
    setFmMapImage(null); setFmTrees([]); setFmSelectedTree(null); setFmDiseaseResult(null); setFmErrorMsg('');
    setFmDetectedGps(null); setShowFmReportModal(false);
  };

  // ── Deep-link resume: /upload?tab=drone-video&session=<sid> ──────────
  // Fires when the URL gains a ?session= param OR when jobs updates.
  // The ref guards against double-applying the resume within the same mount.
  const fmResumedRef = useRef(false);
  useEffect(() => {
    if (fmResumedRef.current) return;
    const sid = searchParams.get('session');
    if (!sid) return;
    const job = jobs[sid];
    if (!job) return; // context not yet populated — will re-run on next jobs update
    if (fmPhase !== 'idle') return;
    fmResumedRef.current = true;
    setActiveTab('drone-video');
    if (job.status === 'done') {
      setFmSessionId(sid);
      fmFetchResult(sid);
    } else if (job.status === 'processing') {
      setFmSessionId(sid);
      setFmPhase('processing');
    }
  }, [searchParams, jobs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-populate disease when pre-analysed tree is selected ─────────
  useEffect(() => {
    if (!fmSelectedTree) { setFmDiseaseResult(null); return; }
    if (fmSelectedTree.crop_image && fmSelectedTree.disease) {
      setFmDiseaseResult({
        tree_id:            fmSelectedTree.tree_id,
        crop_image:         fmSelectedTree.crop_image,
        disease:            fmSelectedTree.disease,
        disease_confidence: fmSelectedTree.disease_confidence ?? 1.0,
        all_detections:     fmSelectedTree.all_detections || [],
      });
    } else {
      setFmDiseaseResult(null);
    }
  }, [fmSelectedTree]);

  // ── Drone Images tab state ────────────────────────────────────────────
  const [diPhase,      setDiPhase]      = useState('idle'); // 'idle'|'loading'|'done'
  const [diFiles,      setDiFiles]      = useState([]);
  const [diIsDrag,     setDiIsDrag]     = useState(false);
  const diInputRef = useRef(null);
  const [diResults,    setDiResults]    = useState([]); // [{filename, tree_count, annotated_b64, trees, gps?, error?}]
  const [diCurrentIdx, setDiCurrentIdx] = useState(0);
  const [diLoadMsg,    setDiLoadMsg]    = useState('');
  const [diDetectedGps,     setDiDetectedGps]     = useState(null); // averaged GPS from EXIF across all images
  const [diFsImage,         setDiFsImage]         = useState(null); // {src, title, trees} for pan-zoom fullscreen
  const [diTreeFs,          setDiTreeFs]          = useState(null); // {treeIdx, trees} for crop navigation fullscreen
  const [showDiReportModal, setShowDiReportModal] = useState(false);

  const diPickFiles = (files) => {
    const valid = Array.from(files).filter(f => f.type.match(/image\/(jpeg|png|webp|tiff|jpg)/));
    if (!valid.length) return;
    setDiFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      return [...prev, ...valid.filter(f => !existingNames.has(f.name))];
    });
    setDiResults([]);
  };

  const [diPreviewUrls, setDiPreviewUrls] = useState([]);
  useEffect(() => {
    const urls = diFiles.map(f => URL.createObjectURL(f));
    setDiPreviewUrls(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [diFiles]);

  const diRemoveFile = (idx) => {
    setDiFiles(prev => prev.filter((_, i) => i !== idx));
    setDiResults([]);
  };

  const diHandleAnalyse = async () => {
    if (!diFiles.length) return;
    setDiPhase('loading');
    setDiResults([]);
    setDiDetectedGps(null);
    const out = [];
    for (let i = 0; i < diFiles.length; i++) {
      const file = diFiles[i];
      setDiLoadMsg(`Analysing ${file.name} (${i + 1}/${diFiles.length})…`);
      try {
        const data = await farmMapService.analyzeDroneImage(file);
        if (!data.success) throw new Error(data.error || 'Analysis failed');
        out.push({ filename: file.name, tree_count: data.tree_count, annotated_b64: data.annotated_b64, trees: data.trees, gps: data.gps || null });
      } catch (err) {
        out.push({ filename: file.name, error: err.message, tree_count: 0, annotated_b64: null, trees: [], gps: null });
      }
    }
    setDiResults(out);
    setDiCurrentIdx(0);
    // Average GPS from all images that had EXIF coordinates
    const gpsPoints = out.filter(r => r.gps?.lat != null);
    if (gpsPoints.length > 0) {
      setDiDetectedGps({
        lat: gpsPoints.reduce((s, r) => s + r.gps.lat, 0) / gpsPoints.length,
        lon: gpsPoints.reduce((s, r) => s + r.gps.lon, 0) / gpsPoints.length,
        source: 'exif',
      });
    }
    setDiPhase('done');
  };

  const diHandleReset = () => {
    setDiPhase('idle'); setDiFiles([]); setDiResults([]); setDiCurrentIdx(0); setDiLoadMsg('');
    if (diInputRef.current) diInputRef.current.value = '';
  };

  const diTreeFsNavigate = (dir) => {
    setDiTreeFs(prev => {
      if (!prev) return prev;
      const next = prev.treeIdx + dir;
      if (next < 0 || next >= prev.trees.length) return prev;
      return { ...prev, treeIdx: next };
    });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape')     { setFullscreenImage(null); setDiFsImage(null); setDiTreeFs(null); }
      if (e.key === 'ArrowLeft')  diTreeFsNavigate(-1);
      if (e.key === 'ArrowRight') diTreeFsNavigate(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fmHealthyCount    = fmTrees.filter(t => !t.disease || t.disease === 'Healthy').length;
  const fmAtRiskCount     = fmTrees.filter(t => t.disease && t.disease !== 'Healthy').length;
  const fmUnanalysedCount = fmTrees.filter(t => !t.disease).length;

  return (
    <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold text-emerald-800 mb-2">Upload &amp; Analyse</h1>
      <p className="text-gray-700 mb-4">
        Upload leaf images, drone images, or a drone video for automated plantation health analysis.
      </p>

      {/* ── Tab switcher ─────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {[
          // { key: 'upload',       label: 'Image / Video Upload', icon: <UploadIcon  size={15} /> },
          { key: 'drone-images', label: 'Drone Images',         icon: <ImageIcon   size={15} /> },
          { key: 'drone-video',  label: 'Drone Video',          icon: <Video       size={15} /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-xl border-b-2 transition-colors duration-150 ${activeTab === tab.key
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-gray-800'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── UPLOAD TAB content ─────────────────────────────────────── */}
      {activeTab === 'upload' && (<>

        {/* Report Messages */}
        {reportMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center gap-3">
            <CheckCircle size={20} />
            {reportMessage}
          </div>
        )}
        {reportError && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-3">
            <AlertCircle size={20} />
            {reportError}
          </div>
        )}

        {annotatedResults.length > 0 ? (
          /* ══ RESULTS VIEW ══════════════════════════════════════════ */
          <div className="max-w-7xl space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Analysis Complete</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {annotatedResults.length} image{annotatedResults.length > 1 ? 's' : ''} analysed with disease_v5
                </p>
              </div>
              <button
                onClick={() => {
                  setAnnotatedResults([]); setDiseaseLevels([]); setHealthyPercent(null);
                  setSelectedFiles([]); setDiseaseRemedies({}); setReportMessage(''); setReportError('');
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                <RefreshCw size={14} /> New Analysis
              </button>
            </div>

            {/* Gallery + Summary */}
            <div className="flex flex-col lg:flex-row gap-5 items-start">

              {/* ── Annotated Image Gallery ─────────────────────── */}
              <div className="flex-1 min-w-0">
                <div className={`grid gap-5 ${
                  annotatedResults.length === 1 ? 'grid-cols-1 max-w-xl' :
                  annotatedResults.length === 2 ? 'grid-cols-2' :
                  'grid-cols-2 xl:grid-cols-3'
                }`}>
                  {annotatedResults.map((r, idx) => (
                    <div key={idx}
                      onClick={() => setFullscreenImage(r)}
                      className="group cursor-pointer rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-2xl hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-300">

                      {/* Clean annotated image — no text overlays */}
                      <div className="relative overflow-hidden" style={{ aspectRatio: '4/3' }}>
                        <img
                          src={r.image} alt={r.filename}
                          className="w-full h-full object-cover group-hover:scale-[1.015] transition-transform duration-500" />
                        {/* Expand hint on hover */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/15">
                          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-xl px-3 py-1.5 text-white text-xs font-semibold shadow-lg">
                            <Maximize2 size={11} /> Full screen
                          </div>
                        </div>
                      </div>

                      {/* Info below image */}
                      <div className="px-4 py-3 space-y-2.5">
                        {/* Primary result */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: dColor(r.disease) }} />
                            <span className="font-bold text-sm" style={{ color: dColor(r.disease) }}>
                              {r.disease}
                            </span>
                          </div>
                          <span className="text-sm font-extrabold tabular-nums"
                            style={{ color: dColor(r.disease) }}>
                            {Math.round(r.confidence)}%
                          </span>
                        </div>

                        {/* Confidence bar */}
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.round(r.confidence)}%`, backgroundColor: dColor(r.disease) }} />
                        </div>

                        {/* Filename */}
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{r.filename}</p>

                        {/* Secondary detections */}
                        {r.top3?.length > 1 && (
                          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
                            {r.top3.slice(1).map((t, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: dColor(t.disease) }} />
                                <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">{t.disease}</span>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-10 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full"
                                      style={{ width: `${Math.round(t.confidence * 100)}%`, backgroundColor: dColor(t.disease) }} />
                                  </div>
                                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 tabular-nums w-7 text-right">
                                    {Math.round(t.confidence * 100)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Summary Panel ──────────────────────────────────── */}
              <div className="lg:w-72 flex-shrink-0 space-y-4">

                {/* Healthy ring */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <BarChart3 size={13} /> Disease Summary
                  </p>
                  <div className="flex items-center gap-4 mb-5">
                    <HealthRing
                      healthy={Math.round((healthyPercent ?? 0) * annotatedResults.length / 100)}
                      total={annotatedResults.length} />
                    <div>
                      <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                        {healthyPercent ?? '--'}%
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Healthy</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {diseaseLevels.filter(d => d.name !== 'Healthy').map((d, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold" style={{ color: dColor(d.name) }}>{d.name}</span>
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-300 tabular-nums">{d.level}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${d.level}%`, backgroundColor: dColor(d.name) }} />
                        </div>
                      </div>
                    ))}
                    {diseaseLevels.filter(d => d.name !== 'Healthy').length === 0 && (
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold text-center py-2">
                        All images healthy
                      </p>
                    )}
                  </div>
                </div>

                {/* Remedies */}
                {Object.keys(diseaseRemedies).length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Recommended Actions</p>
                    {Object.entries(diseaseRemedies).map(([name, remedy], i) => (
                      <div key={i} className="p-3 rounded-xl" style={{ backgroundColor: dBg(name) }}>
                        <p className="text-xs font-bold mb-1" style={{ color: dColor(name) }}>{name}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{remedy}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        ) : (
          /* ══ IDLE / UPLOAD VIEW ════════════════════════════════════ */
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6 max-w-6xl flex flex-col md:flex-row md:space-x-6">

            {/* LEFT SIDE FORM */}
            <div className="flex-1 space-y-6">
              <label htmlFor="file-upload" className={`flex flex-col items-center justify-center p-10 rounded-xl border-2 border-dashed transition duration-300 cursor-pointer
              ${isDragActive ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/40 hover:bg-gray-200 dark:hover:bg-gray-700/60"}`}
                onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
                <UploadIcon className="h-10 w-10 text-emerald-500 mb-3" />
                <p className="text-gray-800 dark:text-gray-200 mb-2 font-medium">Drop images here</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">or click to browse your computer</p>
                <input type="file" id="file-upload" multiple onChange={handleFileSelect} accept="image/jpeg,image/png,image/tiff,image/webp,image/jpg" className="hidden" />
                {selectedFiles.length > 0 && (
                  <p className="mt-3 text-emerald-700 dark:text-emerald-400 font-semibold">
                    {selectedFiles.length} image{selectedFiles.length > 1 ? 's' : ''} selected
                  </p>
                )}
                <p className="mt-4 text-gray-500 dark:text-gray-500 text-xs">Supported formats: JPG, PNG, TIFF, WEBP (max 50MB per file)</p>
              </label>

              {selectedFiles.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {selectedFiles.slice(0, 7).map((file, idx) => (
                    <div key={idx} className="relative rounded-lg overflow-hidden aspect-square border border-gray-200 dark:border-gray-700 shadow-sm">
                      <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {selectedFiles.length > 7 && (
                    <div className="rounded-lg aspect-square bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">+{selectedFiles.length - 7}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                  Notes <span className="text-gray-400">(Optional)</span>
                </label>
                <textarea value={notes} onChange={handleNotesChange} rows={3}
                  placeholder="Add any observations or context…"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-gray-900 dark:text-gray-100 dark:bg-gray-700 placeholder-gray-400 resize-none" />
              </div>

              <div className="flex gap-3 justify-end">
                <button type="button" onClick={handleStartAnalysis} disabled={loading || selectedFiles.length === 0}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg transition duration-150">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Analysing…</> : <><Microscope size={16} /> Start Analysis</>}
                </button>
                <button type="button" onClick={handleDroneProcessing} disabled={loading || selectedFiles.length < 2}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg transition duration-150">
                  {loading ? "Processing…" : "Process Drone Images"}
                </button>
              </div>
            </div>

            {/* RIGHT SIDE PANEL */}
            <div className="mt-6 md:mt-0 w-full md:w-72 flex-shrink-0 bg-gray-50 dark:bg-gray-700/40 p-5 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col gap-5">
              <div>
                <h3 className="text-emerald-700 dark:text-emerald-400 font-semibold mb-3 text-sm uppercase tracking-wide">Disease Levels</h3>
                <div className="text-center mb-4 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-500">Healthy</p>
                  <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                    {healthyPercent != null ? `${healthyPercent}%` : '--'}
                  </p>
                </div>
                {diseaseLevels.length > 0 ? diseaseLevels.map((d, i) => (
                  <div key={i} className="mb-3">
                    <div className="flex justify-between mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      <span>{d.name}</span><span>{d.level}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${d.level}%`, backgroundColor: dColor(d.name) }} />
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-gray-400 dark:text-gray-500 text-xs mt-2">No predictions yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Drone Processing Modal */}
        {showDroneModal && droneResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-emerald-800">Drone Image Analysis Results</h2>
                  <button
                    onClick={() => setShowDroneModal(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                      <p className="text-sm text-emerald-600 mb-1">Trees Detected</p>
                      <div className="text-3xl font-bold text-emerald-700">{droneResult.num_trees}</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-600 mb-1">Images Processed</p>
                      <div className="text-3xl font-bold text-blue-700">{selectedFiles.length}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <p className="text-sm text-green-600 mb-1">Healthy Trees</p>
                      <div className="text-3xl font-bold text-green-700">
                        {droneResult.segmentation_stats?.healthy_trees || 0}
                      </div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-sm text-red-600 mb-1">Diseased Trees</p>
                      <div className="text-3xl font-bold text-red-700">
                        {droneResult.segmentation_stats?.diseased_trees || 0}
                      </div>
                    </div>
                  </div>

                  {/* Health Percentage */}
                  {droneResult.segmentation_stats && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-300">
                      <div className="flex justify-between mb-2">
                        <p className="text-sm text-gray-600">Overall Farm Health</p>
                        <span className="font-semibold text-emerald-700">
                          {droneResult.segmentation_stats.health_percentage?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-emerald-600 h-3 rounded-full"
                          style={{ width: `${droneResult.segmentation_stats.health_percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Estimated Farm Size: {droneResult.segmentation_stats.estimated_farm_size?.toFixed(1)} hectares
                      </p>
                    </div>
                  )}
                  {/* Annotated Image */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Annotated Panorama</h3>
                    <div className="flex justify-center">
                      <img
                        src={droneResult.annotated_image}
                        alt="Annotated panorama with tree detections"
                        className="max-w-full h-auto rounded-lg shadow-lg border border-gray-300"
                      />
                    </div>
                    <p className="text-sm text-gray-600 mt-2 text-center">
                      Red circles show detected coconut trees with unique IDs
                    </p>
                  </div>

                  {/* Tree Data Table */}
                  {droneResult.tree_data && droneResult.tree_data.length > 0 && (
                    <div className="bg-white p-4 rounded-lg border border-gray-300">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Detected Trees</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full table-auto">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Tree ID</th>
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Bounding Box</th>
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Disease Status</th>
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Health %</th>
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Confidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {droneResult.tree_data.map((tree, idx) => (
                              <tr key={idx} className="border-t border-gray-200">
                                <td className="px-4 py-2 text-sm text-gray-900">{tree.id}</td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  [{tree.bbox.join(', ')}]
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${tree.disease?.toLowerCase() === 'healthy'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                    }`}>
                                    {tree.disease || 'Unknown'}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  {tree.health_percentage ? `${tree.health_percentage.toFixed(1)}%` : 'N/A'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  {tree.confidence ? `${(tree.confidence * 100).toFixed(1)}%` : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Close Button */}
                  <div className="text-center">
                    <button
                      onClick={() => setShowDroneModal(false)}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-md transition duration-150"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </>)} {/* end activeTab === 'upload' */}

      {/* ═══════════════════════════════════════════════════════════════
           DRONE IMAGES TAB — top-view image: tree detect → disease
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'drone-images' && (
        <div className="flex flex-col gap-4">

          {/* Header */}
          <div className="flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">Drone Image Analysis</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">Top-view drone photo → detect trees → disease per tree</p>
            </div>
            <div className="flex items-center gap-2">
              {diPhase === 'done' && diResults.length > 0 && (
                <button
                  onClick={() => setShowDiReportModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition"
                >
                  <FileText size={13} /> Generate Report
                </button>
              )}
              {diPhase !== 'idle' && (
                <button onClick={diHandleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  <RefreshCw size={13} /> New Analysis
                </button>
              )}
            </div>
          </div>

          {/* ── IDLE ─────────────────────────────────────────────────── */}
          {diPhase === 'idle' && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400" />
              <div className="p-6 sm:p-8 space-y-6">
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDiIsDrag(true); }}
                  onDragLeave={() => setDiIsDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDiIsDrag(false); diPickFiles(e.dataTransfer.files); }}
                  onClick={() => diInputRef.current?.click()}
                  className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 ${diIsDrag
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 scale-[1.01]'
                    : 'border-gray-200 dark:border-gray-600 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/30'}`}
                  style={{ minHeight: 200 }}>
                  <input ref={diInputRef} type="file"
                    accept="image/jpeg,image/png,image/webp,image/tiff,image/jpg"
                    multiple className="hidden"
                    onChange={e => diPickFiles(e.target.files)} />
                  {diFiles.length > 0 ? (
                    <div className="p-4" onClick={e => e.stopPropagation()}>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 max-h-52 overflow-y-auto pr-1">
                        {diFiles.map((file, idx) => (
                          <div key={`${file.name}-${idx}`} className="relative aspect-square rounded-xl overflow-hidden group shadow">
                            {diPreviewUrls[idx] && (
                              <img src={diPreviewUrls[idx]} alt={file.name} className="w-full h-full object-cover" />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all" />
                            <button
                              onClick={e => { e.stopPropagation(); diRemoveFile(idx); }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                            >
                              <X size={11} />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-white text-[10px] truncate">{file.name}</p>
                            </div>
                          </div>
                        ))}
                        <div
                          onClick={() => diInputRef.current?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/10 transition-all"
                        >
                          <Plus size={18} className="text-gray-400" />
                          <span className="text-[11px] text-gray-400">Add more</span>
                        </div>
                      </div>
                      <p className="text-center text-xs text-gray-400 mt-3">
                        {diFiles.length} image{diFiles.length !== 1 ? 's' : ''} selected · drag to add more
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-10 text-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${diIsDrag ? 'bg-emerald-100 dark:bg-emerald-900/40 scale-110' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        <ImageIcon size={28} className={diIsDrag ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500'} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-700 dark:text-gray-200 text-base">
                          {diIsDrag ? 'Drop it here!' : 'Drop drone top-view images'}
                        </p>
                        <p className="text-sm text-gray-400 mt-0.5">or click to browse · JPG, PNG, WEBP, TIFF</p>
                      </div>
                    </div>
                  )}
                </div>
                {/* Feature pills */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { icon: '🌴', title: 'Tree Detection',   desc: 'YOLOv8 locates every coconut crown and draws a disease-coloured bounding box' },
                    { icon: '🔬', title: 'Disease Analysis', desc: 'Each detected tree crop is independently diagnosed with disease_v5' },
                    { icon: '🎯', title: 'Instant Results',  desc: 'Annotated image + per-tree disease cards with confidence and crop thumbnails' },
                  ].map(f => (
                    <div key={f.title} className="flex flex-col gap-2 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 p-3.5">
                      <span className="text-2xl">{f.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{f.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {/* CTA */}
                <button onClick={diHandleAnalyse} disabled={!diFiles.length}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.01] enabled:active:scale-[0.99] flex items-center justify-center gap-2.5"
                  style={diFiles.length
                    ? { background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 4px 24px rgba(34,197,94,0.35)' }
                    : { background: '#d1d5db' }}>
                  <Microscope size={18} /> Detect Trees &amp; Analyse Disease
                </button>
              </div>
            </div>
          )}

          {/* ── LOADING ──────────────────────────────────────────────── */}
          {diPhase === 'loading' && (
            <div className="flex items-center justify-center min-h-64">
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-10 text-center space-y-6 w-full max-w-sm">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-emerald-100 dark:bg-emerald-900/30 animate-ping opacity-40" />
                  <div className="relative w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Loader2 size={28} className="text-emerald-500 animate-spin" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Analysing Image</h2>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1.5 leading-relaxed">
                    {diLoadMsg || 'Running tree detection and disease analysis…'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── DONE ─────────────────────────────────────────────────── */}
          {diPhase === 'done' && diResults.length > 0 && (() => {
            const cur = diResults[diCurrentIdx] || diResults[0];
            const healthyCount = (cur.trees || []).filter(t => t.disease === 'Healthy').length;
            const totalTrees   = cur.tree_count || 0;
            const healthPct    = totalTrees > 0 ? Math.round((healthyCount / totalTrees) * 100) : 0;
            return (
              <div className="flex flex-col gap-4">
                {/* Image navigator (prev / filename / next) */}
                {diResults.length > 1 && (
                  <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-2 py-1.5">
                    <button
                      onClick={() => setDiCurrentIdx(i => Math.max(0, i - 1))}
                      disabled={diCurrentIdx === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition flex-shrink-0">
                      <ChevronLeft size={18} />
                    </button>
                    <div className="flex-1 min-w-0 text-center">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {diResults[diCurrentIdx]?.error ? '⚠ ' : ''}{diResults[diCurrentIdx]?.filename}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {diCurrentIdx + 1} / {diResults.length}
                        {!diResults[diCurrentIdx]?.error && ` · ${diResults[diCurrentIdx]?.tree_count ?? 0} trees`}
                      </p>
                    </div>
                    <button
                      onClick={() => setDiCurrentIdx(i => Math.min(diResults.length - 1, i + 1))}
                      disabled={diCurrentIdx === diResults.length - 1}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition flex-shrink-0">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}

                {/* Error for this image */}
                {cur.error ? (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 p-6 flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-700 dark:text-red-400">{cur.filename}</p>
                      <p className="text-sm text-red-600 dark:text-red-300 mt-1">{cur.error}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">

                    {/* Full-width annotated map */}
                    <div>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-full text-xs font-semibold px-3 py-1">
                          <CheckCircle size={11} /> {totalTrees} tree{totalTrees !== 1 ? 's' : ''} detected
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-semibold px-3 py-1">
                          {healthPct}% healthy
                        </span>
                      </div>
                      {cur.annotated_b64 ? (
                        <div className="group relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xl cursor-pointer bg-gray-900"
                          onClick={() => setDiFsImage({ src: cur.annotated_b64, title: cur.filename, trees: cur.trees })}>
                          <img src={cur.annotated_b64} alt={`Annotated: ${cur.filename}`}
                            className="w-full object-contain group-hover:scale-[1.01] transition-transform duration-500 max-h-[40vh] sm:max-h-[55vh] lg:max-h-[65vh]" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/10">
                            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-xl px-3 py-1.5 text-white text-xs font-semibold shadow-lg">
                              <Maximize2 size={11} /> Pan &amp; zoom
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-gray-100 dark:bg-gray-700 h-64 flex items-center justify-center text-gray-400">No image available</div>
                      )}
                      {totalTrees === 0 && (
                        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-4">
                          No coconut trees detected. Try adjusting the camera angle or flight height.
                        </p>
                      )}
                    </div>

                    {/* Summary + tree grid below the map */}
                    {cur.trees && cur.trees.length > 0 && (
                      <div className="space-y-4">
                        {/* Summary row */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex flex-wrap items-center gap-3">
                          <HealthRing healthy={healthyCount} total={totalTrees} />
                          <div className="flex-1 min-w-0 flex flex-wrap gap-2 sm:gap-3">
                            {[
                              { label: 'Healthy', value: healthyCount,              color: '#16a34a', bg: 'rgba(22,163,74,0.1)'  },
                              { label: 'At Risk', value: totalTrees - healthyCount, color: '#dc2626', bg: 'rgba(220,38,38,0.1)'  },
                            ].map(s => (
                              <div key={s.label} className="flex-1 min-w-[90px] flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: s.bg }}>
                                <span className="text-xs text-gray-600 dark:text-gray-400">{s.label}</span>
                                <span className="text-sm font-extrabold" style={{ color: s.color }}>{s.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Tree cards — full-width grid with square thumbnails */}
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-0.5">
                          Trees · tap to inspect
                        </p>
                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 sm:gap-2.5">
                          {cur.trees.map((tree, treeIdx) => (
                            <div key={tree.tree_id}
                              className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200 cursor-pointer group"
                              onClick={() => setDiTreeFs({ treeIdx, trees: cur.trees })}>
                              {/* Square thumbnail */}
                              <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-700">
                                {tree.crop_image
                                  ? <img src={tree.crop_image} alt={`Tree #${tree.tree_id}`}
                                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                  : <div className="absolute inset-0 flex items-center justify-center">
                                      <TreePine size={20} className="text-gray-300 dark:text-gray-600" />
                                    </div>
                                }
                                {/* Disease colour strip */}
                                <div className="absolute bottom-0 left-0 right-0 h-1 opacity-90"
                                  style={{ backgroundColor: dColor(tree.disease) }} />
                                {/* Tree ID badge */}
                                <span className="absolute top-1 left-1 text-xs font-bold text-white bg-black/60 backdrop-blur-sm rounded px-1 py-0.5 leading-none">
                                  #{tree.tree_id}
                                </span>
                              </div>
                              {/* Disease label */}
                              <div className="px-1.5 py-1">
                                <p className="text-xs font-semibold truncate leading-tight"
                                  style={{ color: dColor(tree.disease) }}>
                                  {tree.disease === 'Healthy' ? 'Healthy' : tree.disease.split(' ')[0]}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      )}

      {/* ── Drone image fullscreen viewer ────────────────────────────────── */}
      {diFsImage && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0 bg-black/40">
            <div>
              <p className="text-white font-semibold text-sm">{diFsImage.title}</p>
              {diFsImage.trees?.length > 0 && (
                <p className="text-white/40 text-xs mt-0.5">
                  {diFsImage.trees.length} trees detected · click any rectangle to preview
                </p>
              )}
            </div>
            <button onClick={() => setDiFsImage(null)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition">
              <X size={16} />
            </button>
          </div>
          {/* Zoomable canvas viewer */}
          <div className="flex-1 min-h-0">
            <DroneImageViewer
              src={diFsImage.src}
              trees={diFsImage.trees || []}
              focusTree={diFsImage.focusTree} />
          </div>
        </div>
      )}

      {/* ── Tree crop navigation fullscreen ──────────────────────────────── */}
      {diTreeFs && (() => {
        const tree = diTreeFs.trees[diTreeFs.treeIdx];
        const isFirst = diTreeFs.treeIdx === 0;
        const isLast  = diTreeFs.treeIdx === diTreeFs.trees.length - 1;
        return (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/97 backdrop-blur-md">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dColor(tree.disease) }} />
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    Tree #{tree.tree_id} — {tree.disease}
                  </p>
                  <p className="text-white/40 text-xs tabular-nums">
                    {diTreeFs.treeIdx + 1} / {diTreeFs.trees.length}
                  </p>
                </div>
              </div>
              <button onClick={() => setDiTreeFs(null)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition flex-shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Main: detections sidebar + image navigation */}
            <div className="flex-1 flex min-h-0">

              {/* Left sidebar — per-detection breakdown */}
              <div className="w-56 flex-shrink-0 border-r border-white/10 flex flex-col">
                <div className="px-4 pt-4 pb-2.5 flex-shrink-0">
                  <p className="text-white/35 text-xs font-semibold uppercase tracking-widest">Detections</p>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3">
                  {tree.disease === 'Healthy' || !tree.all_detections?.length ? (
                    <div className="pt-6 flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <CheckCircle size={18} className="text-emerald-400" />
                      </div>
                      <p className="text-emerald-400 text-xs font-semibold">Healthy</p>
                      <p className="text-white/25 text-xs text-center">No disease detected above threshold</p>
                    </div>
                  ) : (
                    tree.all_detections.map((d, i) => {
                      const isPrimary = i === 0;
                      return (
                        <div key={i}
                          className="rounded-xl p-2.5 space-y-2"
                          style={{ background: isPrimary ? `${dColor(d.disease)}18` : 'rgba(255,255,255,0.04)' }}>
                          <div className="flex items-start gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                              style={{ backgroundColor: dColor(d.disease) }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white leading-tight">
                                {d.disease}
                              </p>
                              {isPrimary && (
                                <p className="text-white/35 text-xs mt-0.5">Primary</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${Math.round(d.confidence * 100)}%`, backgroundColor: dColor(d.disease) }} />
                            </div>
                            <span className="text-white/55 text-xs tabular-nums flex-shrink-0 font-medium"
                              style={{ color: isPrimary ? dColor(d.disease) : undefined }}>
                              {Math.round(d.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Image + left/right navigation */}
              <div className="flex-1 flex items-center gap-2 px-2 min-h-0 py-3">
                <button onClick={() => diTreeFsNavigate(-1)} disabled={isFirst}
                  className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0 z-10">
                  <ChevronLeft size={22} />
                </button>

                <div className="flex-1 min-h-0 h-full relative">
                  {tree.crop_image
                    ? <ZoomableImage key={tree.tree_id} src={tree.crop_image} alt={`Tree #${tree.tree_id}`} />
                    : <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/30">
                        <TreePine size={48} />
                        <p className="text-sm">No crop available</p>
                      </div>
                  }
                </div>

                <button onClick={() => diTreeFsNavigate(1)} disabled={isLast}
                  className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0 z-10">
                  <ChevronRight size={22} />
                </button>
              </div>
            </div>

            {/* Footer: confidence + dot indicators */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-white/10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((tree.disease_confidence ?? 1) * 100)}%`, backgroundColor: dColor(tree.disease) }} />
                </div>
                <span className="text-white/60 text-sm font-bold tabular-nums flex-shrink-0">
                  {Math.round((tree.disease_confidence ?? 1) * 100)}%
                </span>
              </div>
              {/* Dot strip — all trees */}
              <div className="flex gap-1 flex-wrap justify-center">
                {diTreeFs.trees.map((t, i) => (
                  <button key={i}
                    onClick={() => setDiTreeFs(prev => ({ ...prev, treeIdx: i }))}
                    className="rounded-full transition-all duration-200 flex-shrink-0"
                    style={{
                      width:           i === diTreeFs.treeIdx ? 18 : 6,
                      height:          6,
                      backgroundColor: i === diTreeFs.treeIdx
                        ? dColor(diTreeFs.trees[i].disease)
                        : 'rgba(255,255,255,0.18)',
                    }} />
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Full-screen image modal ──────────────────────────────────────── */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 backdrop-blur-md p-4"
          onClick={() => setFullscreenImage(null)}>
          <div
            className="relative w-full max-w-5xl flex flex-col gap-4"
            onClick={e => e.stopPropagation()}>

            {/* Close */}
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute -top-2 -right-2 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition">
              <X size={16} />
            </button>

            {/* Annotated image */}
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              <img
                src={fullscreenImage.image}
                alt={fullscreenImage.filename}
                className="w-full object-contain"
                style={{ maxHeight: '72vh' }} />
            </div>

            {/* Info below */}
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-white/8 px-6 py-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dColor(fullscreenImage.disease) }} />
                    <span className="text-xl font-extrabold" style={{ color: dColor(fullscreenImage.disease) }}>
                      {fullscreenImage.disease}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm truncate">{fullscreenImage.filename}</p>
                </div>
                <span className="text-3xl font-extrabold tabular-nums flex-shrink-0"
                  style={{ color: dColor(fullscreenImage.disease) }}>
                  {Math.round(fullscreenImage.confidence)}%
                </span>
              </div>

              {/* Confidence bar */}
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.round(fullscreenImage.confidence)}%`, backgroundColor: dColor(fullscreenImage.disease) }} />
              </div>

              {/* Secondary detections */}
              {fullscreenImage.top3?.length > 1 && (
                <div className="flex flex-wrap gap-3">
                  {fullscreenImage.top3.slice(1).map((t, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dColor(t.disease) }} />
                      <span className="text-sm text-gray-300">{t.disease}</span>
                      <span className="text-sm font-bold" style={{ color: dColor(t.disease) }}>
                        {Math.round(t.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           DRONE VIDEO TAB — Farm Map pipeline
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'drone-video' && (
        <div className="flex flex-col gap-4" style={{ minHeight: 'calc(100vh - 12rem)' }}>

          {/* Header row */}
          <div className="flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">Drone Video Analysis</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">Video → orthomosaic → tree detection → disease analysis</p>
            </div>
            {fmPhase !== 'idle' && (
              <div className="flex items-center gap-2">
                {fmPhase === 'done' && fmTrees.length > 0 && (
                  <button onClick={() => setShowFmReportModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition">
                    <FileText size={13} /> Generate Report
                  </button>
                )}
                <button onClick={fmHandleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  <RefreshCw size={13} /> New Analysis
                </button>
              </div>
            )}
          </div>

          {/* ── IDLE ─────────────────────────────────────────────────── */}
          {fmPhase === 'idle' && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col flex-1">
              <div className="h-2 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 flex-shrink-0" />
              <div className="flex flex-col flex-1 p-6 sm:p-8 gap-5">
                {/* Drop zone */}
                <div
                  onDragOver={fmHandleDragOver} onDragLeave={fmHandleDragLeave} onDrop={fmHandleDrop}
                  onClick={() => fmFileInputRef.current?.click()}
                  className={`flex-1 flex flex-col relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300
                    ${fmIsDragActive
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20 scale-[1.01]'
                      : 'border-gray-200 dark:border-gray-600 hover:border-green-300 dark:hover:border-green-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/30'}`}
                >
                  <input ref={fmFileInputRef} type="file" accept={ACCEPTED_VIDEO} className="hidden"
                    onChange={e => fmPickFile(e.target.files?.[0])} />
                  <div className="flex-1 flex flex-col items-center justify-center p-10 text-center gap-4">
                    {fmVideoFile ? (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Video size={28} className="text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 dark:text-gray-100 text-base">{fmVideoFile.name}</p>
                          <p className="text-sm text-gray-400 mt-0.5">{fmtSize(fmVideoFile.size)}</p>
                        </div>
                        <span className="text-xs text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-full px-3 py-1">Click to change</span>
                      </>
                    ) : (
                      <>
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${fmIsDragActive ? 'bg-green-100 dark:bg-green-900/40 scale-110' : 'bg-gray-100 dark:bg-gray-700'}`}>
                          <UploadIcon size={28} className={fmIsDragActive ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-700 dark:text-gray-200 text-base">{fmIsDragActive ? 'Drop it here!' : 'Drop your drone video'}</p>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0">
                  {FEATURES.map(f => (
                    <div key={f.title} className="flex flex-col gap-2 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 p-3.5">
                      <span className="text-2xl">{f.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{f.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {/* CTA */}
                <button onClick={fmHandleStart} disabled={!fmVideoFile}
                  className="flex-shrink-0 w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:scale-[1.01] enabled:active:scale-[0.99] flex items-center justify-center gap-2.5"
                  style={fmVideoFile
                    ? { background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 4px 24px rgba(34,197,94,0.35)' }
                    : { background: '#d1d5db' }}>
                  <Activity size={18} /> Start Analysis
                </button>
              </div>
            </div>
          )}

          {/* ── PROCESSING ───────────────────────────────────────────── */}
          {fmPhase === 'processing' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-lg">
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="h-1.5 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400" />
                  <div className="p-8 space-y-8">
                    <div className="text-center space-y-2">
                      <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 rounded-full bg-green-100 dark:bg-green-900/30 animate-ping opacity-40" />
                        <div className="relative w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Loader2 size={28} className="text-green-500 animate-spin" />
                        </div>
                      </div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Processing Video</h2>
                      {fmVideoFile && <p className="text-sm text-gray-400 truncate px-4">{fmVideoFile.name}</p>}
                      <p className="text-xs text-gray-400 dark:text-gray-500">This may take a few minutes — keep this tab open</p>
                    </div>
                    <StageStepper progressData={fmProgressData} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ERROR ────────────────────────────────────────────────── */}
          {fmPhase === 'error' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-sm">
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-red-100 dark:border-red-900 p-8 text-center space-y-5">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                    <AlertCircle size={28} className="text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Analysis Failed</h2>
                    <p className="text-sm text-red-500 dark:text-red-400 mt-1.5 leading-relaxed">{fmErrorMsg}</p>
                  </div>
                  <button onClick={fmHandleReset}
                    className="flex items-center gap-2 mx-auto px-6 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold text-sm transition">
                    <RefreshCw size={15} /> Try Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── DONE — Map + Side panel ───────────────────────────────── */}
          {fmPhase === 'done' && (
            <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

              {/* Map area */}
              <div className="flex flex-col gap-2 flex-1 min-w-0 min-h-0">
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-full text-xs font-semibold px-3 py-1">
                    <CheckCircle size={11} /> {fmTreeCount} trees detected
                  </span>
                  {fmAtRiskCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900 rounded-full text-xs font-semibold px-3 py-1">
                      <AlertCircle size={11} /> {fmAtRiskCount} at risk
                    </span>
                  )}
                  {fmSelectedTree && (
                    <span className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900 rounded-full text-xs font-medium px-3 py-1">
                      <MapPin size={10} /> Tree #{fmSelectedTree.tree_id} selected
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-0 h-[50vh] lg:h-auto rounded-2xl overflow-hidden shadow-2xl">
                  <MapViewer mapImage={fmMapImage} trees={fmTrees} selectedTree={fmSelectedTree}
                    onTreeClick={t => { setFmSelectedTree(t); setFmDiseaseResult(null); setFmDiseaseError(''); }} />
                </div>
              </div>

              {/* Side panel */}
              <div className="lg:w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto max-h-[50vh] lg:max-h-none pb-2 pr-0.5">

                {/* Farm health card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <BarChart3 size={15} className="text-green-500" /> Farm Health
                    </p>
                    <span className="text-xs text-gray-400">{fmTreeCount} total</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <HealthRing healthy={fmHealthyCount} total={fmTreeCount} />
                    <div className="flex-1 space-y-1.5">
                      {[
                        { label: 'Healthy',    value: fmHealthyCount,    color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
                        { label: 'At Risk',    value: fmAtRiskCount,     color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
                        { label: 'Unanalysed', value: fmUnanalysedCount, color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
                      ].map(s => (
                        <div key={s.label} className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ backgroundColor: s.bg }}>
                          <span className="text-xs text-gray-600 dark:text-gray-400">{s.label}</span>
                          <span className="text-sm font-extrabold" style={{ color: s.color }}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* No tree selected */}
                {!fmSelectedTree && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center flex-shrink-0 space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
                      <Eye size={22} className="text-gray-300 dark:text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">No tree selected</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">Click any numbered marker on the map to select a tree and run disease analysis</p>
                    </div>
                  </div>
                )}

                {/* Selected tree card */}
                {fmSelectedTree && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700"
                      style={{ background: 'linear-gradient(135deg,rgba(34,197,94,0.06),rgba(16,163,74,0.02))' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
                          <TreePine size={14} className="text-green-600 dark:text-green-400" />
                        </div>
                        <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">Tree #{fmSelectedTree.tree_id}</span>
                        {fmSelectedTree.disease && <DiseaseBadge disease={fmSelectedTree.disease} />}
                      </div>
                      <button onClick={() => { setFmSelectedTree(null); setFmDiseaseResult(null); }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <div className="flex justify-between mb-1.5 text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Detection confidence</span>
                          <span className="font-bold text-green-600 dark:text-green-400">{Math.round(fmSelectedTree.confidence * 100)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-700"
                            style={{ width: `${Math.round(fmSelectedTree.confidence * 100)}%` }} />
                        </div>
                      </div>
                      {!fmDiseaseResult && (
                        <button onClick={fmHandleAnalyseDisease} disabled={fmDiseaseLoading}
                          className="w-full py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                          style={!fmDiseaseLoading
                            ? { background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 2px 12px rgba(34,197,94,0.3)' }
                            : { background: '#86efac' }}>
                          {fmDiseaseLoading ? <><Loader2 size={15} className="animate-spin" /> Analysing…</> : <><Microscope size={15} /> Analyse Disease</>}
                        </button>
                      )}
                      {fmDiseaseError && (
                        <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />{fmDiseaseError}
                        </div>
                      )}
                      {fmDiseaseResult && (
                        <div className="space-y-3">
                          {fmDiseaseResult.crop_image && (
                            <div className="relative overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700">
                              <img src={fmDiseaseResult.crop_image} alt="Tree crop" className="w-full object-cover" style={{ maxHeight: 150 }} />
                              <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent">
                                <DiseaseBadge disease={fmDiseaseResult.disease} size="md" />
                              </div>
                            </div>
                          )}
                          <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                            <div className="px-3 py-2.5 flex items-center justify-between" style={{ backgroundColor: dBg(fmDiseaseResult.disease) }}>
                              <span className="text-xs font-semibold" style={{ color: dColor(fmDiseaseResult.disease) }}>
                                {fmDiseaseResult.disease === 'Healthy' ? '✓ No disease detected' : '⚠ Disease detected'}
                              </span>
                              <span className="text-sm font-extrabold" style={{ color: dColor(fmDiseaseResult.disease) }}>
                                {Math.round(fmDiseaseResult.disease_confidence * 100)}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 dark:bg-gray-700">
                              <div className="h-full transition-all duration-700"
                                style={{ width: `${Math.round(fmDiseaseResult.disease_confidence * 100)}%`, backgroundColor: dColor(fmDiseaseResult.disease) }} />
                            </div>
                          </div>
                          {fmDiseaseResult.all_detections?.length > 1 && (
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">All detections</p>
                              {fmDiseaseResult.all_detections.map((d, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dColor(d.disease) }} />
                                  <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{d.disease}</span>
                                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{Math.round(d.confidence * 100)}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <button onClick={() => { setFmDiseaseResult(null); setFmDiseaseError(''); }}
                            className="w-full py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center justify-center gap-1.5">
                            <RefreshCw size={12} /> Re-analyse
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Marker legend */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-3">Marker Legend</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Unanalysed / Healthy', color: '#16a34a' },
                      { label: 'Black Beetle Attack',   color: '#dc2626' },
                      { label: 'Magnesium Deficiency',  color: '#ea580c' },
                      { label: 'Potassium Deficiency',  color: '#d97706' },
                      { label: 'Yellow Patches',        color: '#ca8a04' },
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
      )}

      {/* Drone Images generate report modal */}
      {showDiReportModal && (
        <GenerateReportModal
          analysisData={buildDroneImageAnalysisData(diResults)}
          detectedGps={diDetectedGps}
          onClose={() => setShowDiReportModal(false)}
          onCreated={() => setShowDiReportModal(false)}
        />
      )}

      {/* Drone Video generate report modal */}
      {showFmReportModal && (
        <GenerateReportModal
          analysisData={buildDroneVideoAnalysisData(fmTrees, fmDetectedGps)}
          detectedGps={fmDetectedGps}
          onClose={() => setShowFmReportModal(false)}
          onCreated={() => setShowFmReportModal(false)}
        />
      )}

    </div>
  );
};

export default Upload;
