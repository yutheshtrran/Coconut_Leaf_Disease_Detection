import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload, Image as ImageIcon, Loader2, AlertCircle, CheckCircle,
  Leaf, RefreshCw, X, ChevronLeft, ChevronRight, Plus, Sprout,
  ZoomIn, ZoomOut, Maximize2, FileText,
} from "lucide-react";
import GenerateReportModal from "../components/GenerateReportModal";
import { buildLeafAnalysisData } from "../utils/buildAnalysisData";

// ── Fullscreen zoom viewer ────────────────────────────────────────────────────
function ZoomableModal({ src, title, onClose }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragStart    = useRef({ active: false, moved: false, mx: 0, my: 0, tx: 0, ty: 0 });
  const [transform,  setTransform]  = useState({ x: 0, y: 0, scale: 1 });
  const [img,        setImg]        = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const applyT = useCallback((t) => {
    setTransform(t);
    transformRef.current = t;
  }, []);

  useEffect(() => {
    if (!src) return;
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);

  const fitView = useCallback(() => {
    const c = containerRef.current;
    if (!img || !c) return;
    const scale = Math.min(c.clientWidth / img.width, c.clientHeight / img.height, 1);
    applyT({
      x: (c.clientWidth  - img.width  * scale) / 2,
      y: (c.clientHeight - img.height * scale) / 2,
      scale,
    });
  }, [img, applyT]);

  useEffect(() => { fitView(); }, [fitView]);

  useEffect(() => {
    const canvas = canvasRef.current, c = containerRef.current;
    if (!canvas || !c) return;
    const resize = () => { canvas.width = c.clientWidth; canvas.height = c.clientHeight; };
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    resize();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    const { x, y, scale } = transform;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }, [img, transform]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const { x, y, scale } = transformRef.current;
    const f  = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const ns = Math.min(Math.max(scale * f, 0.3), 16);
    applyT({ x: mx - (ns / scale) * (mx - x), y: my - (ns / scale) * (my - y), scale: ns });
  }, [applyT]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.addEventListener('wheel', handleWheel, { passive: false });
    return () => c.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const zoom = (factor) => {
    const { x, y, scale } = transformRef.current;
    const c = containerRef.current;
    if (!c) return;
    const cx = c.clientWidth / 2, cy = c.clientHeight / 2;
    const ns = Math.min(Math.max(scale * factor, 0.3), 16);
    applyT({ x: cx - (ns / scale) * (cx - x), y: cy - (ns / scale) * (cy - y), scale: ns });
  };

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

  // Touch support
  const lastTouch = useRef(null);
  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragStart.current = { active: true, moved: false, mx: t.clientX, my: t.clientY, tx: transformRef.current.x, ty: transformRef.current.y };
      lastTouch.current = null;
    } else if (e.touches.length === 2) {
      dragStart.current.active = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouch.current = { dist: Math.hypot(dx, dy) };
    }
  };
  const onTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragStart.current.active) {
      const t = e.touches[0];
      const dx = t.clientX - dragStart.current.mx, dy = t.clientY - dragStart.current.my;
      if (!dragStart.current.moved && Math.hypot(dx, dy) > 3) dragStart.current.moved = true;
      if (dragStart.current.moved)
        applyT({ ...transformRef.current, x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
    } else if (e.touches.length === 2 && lastTouch.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      zoom(dist / lastTouch.current.dist);
      lastTouch.current = { dist };
    }
  };
  const onTouchEnd = () => { dragStart.current.active = false; lastTouch.current = null; };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-white/10 flex-shrink-0">
        <p className="text-white/70 text-sm truncate max-w-xs">{title}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => zoom(1.3)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <ZoomIn size={16} />
          </button>
          <button onClick={() => zoom(1 / 1.3)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <ZoomOut size={16} />
          </button>
          <button onClick={fitView}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
            <Maximize2 size={15} />
          </button>
          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-red-600/80 text-white transition ml-1">
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 touch-none"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="text-white/30 text-xs">Pinch or scroll · drag · ESC to close</span>
        </div>
      </div>
    </div>
  );
}

const ML_URL = import.meta.env.VITE_ML_URL || 'http://127.0.0.1:5001';

const DISEASE_PALETTE = {
  'Healthy':               '#16a34a',
  'Black Beetle Attack':   '#ef4444',
  'Magnesium Deficiency':  '#a855f7',
  'Potassium Deficiency':  '#0ea5e9',
  'Yellow Patches':        '#eab308',
};
const DISEASE_BG = {
  'Healthy':               'rgba(22,163,74,0.12)',
  'Black Beetle Attack':   'rgba(239,68,68,0.12)',
  'Magnesium Deficiency':  'rgba(168,85,247,0.12)',
  'Potassium Deficiency':  'rgba(14,165,233,0.12)',
  'Yellow Patches':        'rgba(234,179,8,0.12)',
};
const DISEASE_DESCRIPTIONS = {
  'Black Beetle Attack': 'Rhinoceros beetle (Oryctes rhinoceros) bores into the crown and chews V-shaped cuts on emerging fronds. Severe infestations destroy the growing point and can kill the palm.',
  'Magnesium Deficiency': 'Magnesium is essential for chlorophyll production. Deficiency causes symmetrical yellowing of older fronds from the tips inward, while midrib stays green, leaving an orange-yellow band across the leaflets.',
  'Potassium Deficiency': 'Potassium regulates water transport and nut filling. Deficiency causes older fronds to develop orange-yellow discolouration, leaf tips turn brown and droop. Nuts may be small and poorly filled.',
  'Yellow Patches': 'Irregular yellow or pale patches appear across leaflets, often caused by fungal infection (e.g. leaf blight), viral disease, or localised nutrient imbalance. Patches may enlarge and coalesce if untreated.',
  'Healthy': 'No visible disease or deficiency symptoms detected. The palm appears to be in good health with normal frond colour, vigour, and crown structure.',
};

const RECOVERY_TIPS = {
  'Black Beetle Attack': [
    'Remove and destroy infested palm fronds immediately to stop spread.',
    'Pack naphthalene balls (5 g) in the crown region as a repellent.',
    'Set up pheromone traps across the plantation to capture adult beetles.',
    'Spray Carbaryl 50 WP (2 g/L) or Chlorpyrifos 20 EC (2.5 mL/L) on the crown.',
    'Clear dead wood and decaying matter — they are primary beetle breeding sites.',
  ],
  'Magnesium Deficiency': [
    'Apply Magnesium Sulphate (MgSO₄) at 1 kg per palm, twice a year.',
    'Foliar spray: 2% MgSO₄ solution on yellowing fronds every 3 months.',
    'Maintain soil pH between 5.5 and 7.0 for optimal Mg uptake.',
    'Reduce excess potassium fertiliser — high K competes with Mg absorption.',
  ],
  'Potassium Deficiency': [
    'Apply Muriate of Potash (MOP) at 1.5 kg per palm per year.',
    'Split the dose: half in January, half in July for steady uptake.',
    'Conduct a soil test first to confirm the deficiency before treating.',
    'Ensure adequate soil moisture so nutrients can dissolve and be absorbed.',
  ],
  'Yellow Patches': [
    'Identify the root cause — yellow patches may be fungal, viral, or nutritional.',
    'Apply copper-based fungicide (Copper Oxychloride, 3 g/L) if fungal origin suspected.',
    'Remove severely affected fronds to prevent disease from spreading to healthy tissue.',
    'Improve field drainage — waterlogged soils strongly promote fungal diseases.',
    'Request a soil or leaf tissue test from an agricultural extension officer.',
  ],
  'Healthy': [
    'Maintain regular N-P-K fertilisation schedule (every 6 months).',
    'Inspect irrigation and drainage systems monthly.',
    'Monitor for early pest or disease signs during routine farm walks.',
    'Keep inter-row vegetation trimmed to reduce shelter for pests.',
  ],
};
const URGENCY = {
  'Black Beetle Attack':  { label: 'High urgency',      color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-900/20'    },
  'Magnesium Deficiency': { label: 'Medium urgency',    color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  'Potassium Deficiency': { label: 'Medium urgency',    color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  'Yellow Patches':       { label: 'Medium urgency',    color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  'Healthy':              { label: 'No action needed',  color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
};

const dColor = (d) => DISEASE_PALETTE[d] || '#6b7280';
const dBg    = (d) => DISEASE_BG[d]    || 'rgba(107,114,128,0.12)';

const AnalyseImages = () => {
  const [files,       setFiles]       = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [loadMsg,     setLoadMsg]     = useState('');
  const [results,     setResults]     = useState([]);
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [error,       setError]       = useState(null);
  const [fullscreen,      setFullscreen]      = useState(null); // { src, title }
  const [showReportModal, setShowReportModal] = useState(false);
  const fileInputRef = useRef(null);
  const addMoreRef   = useRef(null);

  // Rebuild preview URLs whenever the file list changes
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [files]);

  const addFiles = (incoming) => {
    const valid = Array.from(incoming).filter(f =>
      /image\/(jpeg|jpg|png|webp)/.test(f.type)
    );
    if (!valid.length) return;
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...valid.filter(f => !names.has(f.name))];
    });
    setResults([]);
    setError(null);
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setResults([]);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleAnalyse = async () => {
    if (!files.length) return;
    setLoading(true); setResults([]); setError(null); setCurrentIdx(0);
    const out = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setLoadMsg(`Analysing ${i + 1} of ${files.length}…`);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${ML_URL}/predict`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        const pred = data?.prediction || data;
        out.push({
          filename:        file.name,
          disease:         pred.disease  || 'Unknown',
          confidence:      typeof pred.confidence === 'number'
                             ? pred.confidence
                             : (pred.percentage ?? 0) / 100,
          top3:            pred.top3 || [],
          annotated_image: pred.annotated_image || null,
          remedy:          pred.remedy      || null,
          description:     pred.description || null,
        });
      } catch (err) {
        out.push({
          filename: file.name, disease: 'Error', confidence: 0,
          top3: [], annotated_image: null, error: err.message,
        });
      }
    }
    setResults(out);
    setCurrentIdx(0);
    setLoading(false);
  };

  const handleReset = () => {
    setFiles([]); setResults([]); setCurrentIdx(0); setError(null); setLoadMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (addMoreRef.current)   addMoreRef.current.value   = '';
  };

  const cur = results[currentIdx] || null;

  return (
    <div className="pt-4 p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold text-green-800 dark:text-green-400 mb-1">Analyse Images</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Upload leaf or canopy images to identify coconut diseases using our AI model.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">

        {/* ── LEFT: Upload ─────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col gap-5">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Upload size={20} className="text-green-600 dark:text-green-400" />
            Upload Images
          </h2>

          {files.length === 0 ? (
            /* Empty drop zone */
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(e) => { e.preventDefault(); setIsDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-all duration-200
                ${isDragActive
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500 bg-gray-50 dark:bg-gray-700/50'
                }`}
            >
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple className="hidden"
                onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); }} />
              <ImageIcon size={48} className="text-gray-400 dark:text-gray-500" />
              <div className="text-center">
                <p className="font-medium text-gray-700 dark:text-gray-300">Drag &amp; drop images here</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">or click to browse files</p>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Supports: JPG, PNG, WEBP</p>
            </div>
          ) : (
            /* Thumbnail grid */
            <div>
              <div className="grid grid-cols-3 gap-2">
                {files.map((f, i) => (
                  <div key={f.name} className="relative group rounded-xl overflow-hidden aspect-square border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700">
                    <img src={previewUrls[i]} alt={f.name} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                      <X size={11} className="text-white" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 py-0.5 px-1.5">
                      <p className="text-white text-[10px] truncate">{f.name}</p>
                    </div>
                  </div>
                ))}
                {/* Add more tile */}
                <label className="rounded-xl aspect-square border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500 bg-gray-50 dark:bg-gray-700/50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors">
                  <Plus size={20} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">Add more</span>
                  <input ref={addMoreRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
                    multiple className="hidden"
                    onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); }} />
                </label>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
                {files.length} image{files.length > 1 ? 's' : ''} selected
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleAnalyse}
              disabled={!files.length || loading}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg transition duration-150"
            >
              {loading
                ? <><Loader2 size={18} className="animate-spin" />{loadMsg || 'Analysing…'}</>
                : <><Leaf size={18} /> Analyse Images</>}
            </button>
            {(files.length > 0 || results.length > 0) && (
              <button onClick={handleReset}
                title="Reset"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition duration-150">
                <RefreshCw size={16} />
              </button>
            )}
          </div>
        </div>

        {/* ── RIGHT: Results ───────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col gap-4">

          {/* Header row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
              Analysis Results
            </h2>
            <div className="flex items-center gap-2">
              {results.length > 0 && (
                <button
                  onClick={() => setShowReportModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                >
                  <FileText size={13} /> Generate Report
                </button>
              )}
            {results.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                  disabled={currentIdx === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 tabular-nums">
                  {currentIdx + 1} / {results.length}
                </span>
                <button
                  onClick={() => setCurrentIdx(i => Math.min(results.length - 1, i + 1))}
                  disabled={currentIdx === results.length - 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 transition">
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            </div>
          </div>

          {/* Empty state */}
          {!cur && (
            <div className="flex-1 flex flex-col items-center justify-center h-64 gap-4 text-center">
              <Leaf size={48} className="text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">
                Upload images and click "Analyse Images" to see the results here.
              </p>
            </div>
          )}

          {/* Error for this image */}
          {cur?.error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>Could not analyse <strong>{cur.filename}</strong>: {cur.error}</span>
            </div>
          )}

          {/* Result card */}
          {cur && !cur.error && (
            <div className="space-y-4 overflow-y-auto pr-0.5">

              {/* Filename */}
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{cur.filename}</p>

              {/* Annotated image — tap/click to open fullscreen */}
              {cur.annotated_image ? (
                <div
                  onClick={() => setFullscreen({ src: cur.annotated_image, title: cur.filename })}
                  className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-900 cursor-zoom-in"
                  style={{ aspectRatio: '4/3' }}>
                  <img src={cur.annotated_image} alt="Disease detection result"
                    className="w-full h-full object-contain" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-150 bg-black/20">
                    <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 text-white text-xs font-semibold shadow-lg">
                      <Maximize2 size={13} /> Tap to enlarge
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex items-center justify-center"
                  style={{ aspectRatio: '4/3' }}>
                  <p className="text-sm text-gray-400 dark:text-gray-500">No annotated image returned</p>
                </div>
              )}

              {/* All detections — one full card each */}
              {(() => {
                // Merge top disease + top3 into a unified list, deduplicated
                const allDetections = cur.top3?.length
                  ? cur.top3
                  : [{ disease: cur.disease, confidence: cur.confidence }];
                // Attach top-level description/remedy to the first item if top3 doesn't carry them
                return allDetections.map((det, idx) => {
                  const disease    = det.disease;
                  const confidence = det.confidence;
                  const desc       = idx === 0 && cur.description
                                       ? cur.description
                                       : DISEASE_DESCRIPTIONS[disease] || '';
                  const remedy     = idx === 0 && cur.remedy ? cur.remedy : null;
                  const tips       = RECOVERY_TIPS[disease] || [];
                  const urgency    = URGENCY[disease];

                  return (
                    <div key={idx} className="rounded-xl border-2 overflow-hidden"
                      style={{ borderColor: dColor(disease) }}>

                      {/* ── Disease header ── */}
                      <div className="px-4 pt-4 pb-3" style={{ backgroundColor: dBg(disease) }}>
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                          <div className="flex items-center gap-2">
                            {idx === 0 && (
                              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: dColor(disease), color: '#fff' }}>
                                Best match
                              </span>
                            )}
                            <span className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: dColor(disease) }} />
                            <span className="font-bold text-base leading-tight"
                              style={{ color: dColor(disease) }}>{disease}</span>
                          </div>
                          <span className="font-extrabold text-xl tabular-nums"
                            style={{ color: dColor(disease) }}>
                            {Math.round(confidence * 100)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.10)' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.round(confidence * 100)}%`, backgroundColor: dColor(disease) }} />
                        </div>
                        {desc && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">{desc}</p>
                        )}
                      </div>

                      {/* ── Recovery tips ── */}
                      <div className="border-t" style={{ borderColor: `${dColor(disease)}30` }}>
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-700/40">
                          <Sprout size={13} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Recovery Tips</span>
                          {urgency && (
                            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${urgency.color} ${urgency.bg}`}>
                              {urgency.label}
                            </span>
                          )}
                        </div>
                        <div className="px-4 pb-4 pt-2 space-y-2.5 bg-white dark:bg-gray-800">
                          {remedy && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed italic border-l-3 pl-3"
                              style={{ borderColor: dColor(disease) }}>
                              {remedy}
                            </p>
                          )}
                          {tips.length > 0 ? tips.map((tip, ti) => (
                            <div key={ti} className="flex items-start gap-2.5">
                              <span className="mt-0.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${dColor(disease)}20`, color: dColor(disease) }}>
                                {ti + 1}
                              </span>
                              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{tip}</p>
                            </div>
                          )) : (
                            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                              No specific tips available.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}

            </div>
          )}
        </div>
      </div>

      {/* Fullscreen zoom modal */}
      {fullscreen && (
        <ZoomableModal
          src={fullscreen.src}
          title={fullscreen.title}
          onClose={() => setFullscreen(null)}
        />
      )}

      {/* Generate Report modal */}
      {showReportModal && (
        <GenerateReportModal
          analysisData={buildLeafAnalysisData(results)}
          detectedGps={null}
          onClose={() => setShowReportModal(false)}
          onCreated={(report) => {
            setShowReportModal(false);
          }}
        />
      )}
    </div>
  );
};

export default AnalyseImages;
