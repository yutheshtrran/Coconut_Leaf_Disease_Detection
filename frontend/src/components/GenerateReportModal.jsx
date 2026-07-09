import React, { useState, useCallback, useEffect } from 'react';
import { X, FileText, Leaf, Video, Image, CheckCircle, AlertTriangle, Loader2, MapPin } from 'lucide-react';
import FarmCombobox from './FarmCombobox';
import FarmLocationPicker from './FarmLocationPicker';
import { addFarm, fetchFarms } from '../services/farmService';
import { createReport } from '../services/reportService';

// Haversine distance between two lat/lon points, in metres
function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toR = (d) => d * Math.PI / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ── Design tokens matching existing disease palette ────────────────────────
const DISEASE_PALETTE = {
  'Black Beetle Attack':  '#ef4444',
  'Magnesium Deficiency': '#a855f7',
  'Potassium Deficiency': '#0ea5e9',
  'Yellow Patches':       '#eab308',
};
const dColor = (name) => DISEASE_PALETTE[name] || '#6b7280';

const TYPE_META = {
  'leaf':        { label: 'Leaf Analysis',    Icon: Leaf,  bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-300' },
  'drone-image': { label: 'Drone Images',     Icon: Image, bg: 'bg-sky-100 dark:bg-sky-900/30',      text: 'text-sky-700 dark:text-sky-300' },
  'drone-video': { label: 'Drone Video',      Icon: Video, bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300' },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isInlineImage(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function compressDataUrl(src, maxSide = 720, quality = 0.72) {
  if (!isInlineImage(src)) return src;
  try {
    const img = await loadImage(src);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return src;
  }
}

async function compressTreeImages(trees) {
  if (!Array.isArray(trees)) return trees;
  const out = [];
  for (const tree of trees) {
    out.push({
      ...tree,
      crop_image: tree.crop_image
        ? await compressDataUrl(tree.crop_image, 520, 0.72)
        : tree.crop_image,
    });
  }
  return out;
}

async function prepareReportAnalysisData(analysisData) {
  if (!analysisData) return analysisData;
  const safe = { ...analysisData };

  if (Array.isArray(safe.annotatedImages)) {
    safe.annotatedImages = [];
    for (const img of analysisData.annotatedImages) {
      safe.annotatedImages.push(await compressDataUrl(img, 1400, 0.74));
    }
  }

  if (safe.mapImage) {
    safe.mapImage = await compressDataUrl(safe.mapImage, 1800, 0.72);
  }

  safe.affectedTrees = await compressTreeImages(safe.affectedTrees);
  safe.allTrees = await compressTreeImages(safe.allTrees);

  return safe;
}

// ─────────────────────────────────────────────────────────────────────────────
const GenerateReportModal = ({ analysisData, detectedGps, onClose, onCreated }) => {
  const [farm,     setFarm]     = useState({ name: '', isNew: true, farmId: null });
  const [location, setLocation] = useState(
    // pre-fill with detectedGps if available
    detectedGps ? { lat: detectedGps.lat, lon: detectedGps.lon, address: '' } : null
  );
  const [date,     setDate]     = useState(todayISO());
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  // GPS-based farm auto-match
  const [matchedFarm,   setMatchedFarm]   = useState(null); // { farm, distanceM }
  const [autoMatched,   setAutoMatched]   = useState(false);

  const meta = TYPE_META[analysisData?.analysisType] || TYPE_META['leaf'];
  const { Icon } = meta;

  // On mount: if we have GPS from the image, look for an existing farm within 1 km
  useEffect(() => {
    if (!detectedGps?.lat) return;
    fetchFarms('').then(res => {
      const farms = res.farms || res.data || [];
      let closest = null, closestDist = Infinity;
      for (const f of farms) {
        if (f.location?.lat == null) continue;
        const d = haversineM(detectedGps.lat, detectedGps.lon, f.location.lat, f.location.lon);
        if (d < closestDist) { closestDist = d; closest = f; }
      }
      if (closest && closestDist < 1000) {
        setMatchedFarm({ farm: closest, distanceM: Math.round(closestDist) });
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select matched farm once found (if user hasn't typed anything yet)
  useEffect(() => {
    if (!matchedFarm || autoMatched || farm.name) return;
    const { farm: f } = matchedFarm;
    setFarm({ name: f.name, isNew: false, farmId: f._id });
    setLocation({
      lat:     f.location.lat,
      lon:     f.location.lon,
      address: f.location.address || '',
    });
    setAutoMatched(true);
  }, [matchedFarm, autoMatched, farm.name]);

  // When user picks an existing farm that has a saved GPS, pre-fill the map
  const handleFarmSelected = useCallback((farmDoc) => {
    if (farmDoc.location?.lat != null) {
      setLocation({
        lat: farmDoc.location.lat,
        lon: farmDoc.location.lon,
        address: farmDoc.location.address || '',
      });
    }
  }, []);

  const handleSave = async () => {
    if (!farm.name.trim()) { setError('Please enter a farm name.'); return; }
    setError('');
    setSaving(true);

    try {
      let farmId = farm.farmId;

      // Create new farm if needed
      if (farm.isNew && farm.name.trim()) {
        const payload = { name: farm.name.trim() };
        if (location?.lat != null) {
          payload.location = { lat: location.lat, lon: location.lon, address: location.address || '' };
        }
        const created = await addFarm(payload);
        // farmController returns { message, farm: {...} }
        farmId = (created.farm || created.data || created)._id;
      }

      // Merge GPS into analysisData
      let gps = analysisData.gps;
      if (!gps && location?.lat != null) {
        gps = { lat: location.lat, lon: location.lon, source: 'manual' };
      }
      if (gps?.source === 'video' && location?.lat != null && location?.lat !== gps?.lat) {
        // User moved the pin after GPS pre-fill → treat as manual
        gps = { lat: location.lat, lon: location.lon, source: 'manual' };
      }

      const baseAnalysis = gps ? { ...analysisData, gps } : analysisData;
      const safeAnalysis = await prepareReportAnalysisData(baseAnalysis);

      const payload = {
        farm:         farm.name.trim(),
        farmId:       farmId || null,
        date,
        description:  notes,
        analysisData: safeAnalysis,
      };

      const res = await createReport(payload);
      const savedReport = res.data || res;

      if (onCreated) onCreated(savedReport);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save report.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const top    = analysisData?.diseases?.[0];
  const total  = analysisData?.totalImages  ?? 0;
  const hpct   = analysisData?.healthyPercent ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText size={18} className="text-green-600 dark:text-green-400" />
            <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base">Generate Report</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X size={15} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Analysis summary */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                <Icon size={11} />
                {meta.label}
              </span>
              <span className="text-xs text-gray-400 ml-auto">{total} {total === 1 ? 'image' : 'images'} analysed</span>
            </div>

            <div className="flex items-center gap-4">
              {/* Healthy ring */}
              <HealthMini pct={hpct} />

              <div className="flex-1 min-w-0 space-y-1.5">
                {top ? (
                  <>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Top finding</p>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: dColor(top.name) }}
                      />
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{top.name}</span>
                      <span className="text-xs text-gray-400 tabular-nums ml-auto shrink-0">{Math.round((top.topConfidence || 0) * 100)}% conf</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${top.percentage}%`, backgroundColor: dColor(top.name) }}
                      />
                    </div>
                    <p className="text-xs text-gray-400">{top.percentage}% of analysed images</p>
                  </>
                ) : (
                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5 font-medium">
                    <CheckCircle size={14} />
                    All images look healthy
                  </p>
                )}
              </div>
            </div>

            {analysisData?.treeSummary && (
              <div className="flex gap-3 pt-1 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                <span>🌴 {analysisData.treeSummary.total} trees</span>
                <span>✅ {analysisData.treeSummary.healthy} healthy</span>
                <span>⚠️ {analysisData.treeSummary.atRisk} at risk</span>
              </div>
            )}
          </div>

          {/* GPS auto-match banner */}
          {detectedGps && (
            <div className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs border ${
              autoMatched
                ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
            }`}>
              <MapPin size={13} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                {autoMatched ? (
                  <>
                    <span className="font-semibold">Farm matched from GPS</span>
                    {' — '}<span className="font-medium">{matchedFarm?.farm.name}</span>
                    {matchedFarm?.distanceM != null && ` (${matchedFarm.distanceM} m away)`}
                  </>
                ) : (
                  <>
                    <span className="font-semibold">GPS detected from image</span>
                    {' — '}{detectedGps.lat.toFixed(5)}°N, {detectedGps.lon.toFixed(5)}°E
                    {!matchedFarm && <span className="opacity-70"> · No matching farm found nearby</span>}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Farm name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Farm Name <span className="text-red-500">*</span>
            </label>
            <FarmCombobox
              value={farm}
              onChange={setFarm}
              onFarmSelected={handleFarmSelected}
            />
            {farm.isNew && farm.name.trim() && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle size={11} />
                A new farm will be created with this name
              </p>
            )}
          </div>

          {/* Farm location */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Farm Location
            </label>
            <FarmLocationPicker
              value={location}
              onChange={setLocation}
              detectedGps={detectedGps}
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Notes <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional observations, field conditions, actions taken…"
              className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={13} />
              {error}
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !farm.name.trim()}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {saving ? 'Saving…' : 'Save Report'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Mini health percentage ring for the summary card
function HealthMini({ pct }) {
  const r = 22, c = 2 * Math.PI * r, dash = (pct / 100) * c;
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: 56, height: 56 }}>
      <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor"
          className="text-gray-200 dark:text-gray-700" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke="#16a34a" strokeWidth="5"
          strokeLinecap="round" strokeDasharray={`${dash} ${c}`} />
      </svg>
      <span className="absolute text-xs font-extrabold text-gray-800 dark:text-gray-100">{pct}%</span>
    </div>
  );
}

export default GenerateReportModal;
