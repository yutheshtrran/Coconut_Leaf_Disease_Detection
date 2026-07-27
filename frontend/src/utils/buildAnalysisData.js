import DISEASE_DB from '../data/diseases.json';

// ── Fallback descriptions (used when DB has no entry for a class) ─────────────
const DISEASE_FALLBACK = {
  'Black Beetle Attack':  {
    description: 'Rhinoceros beetles bore into the growing point and young fronds, causing characteristic V-shaped cuts and crown damage that can kill the palm.',
    remedy: 'Remove and destroy breeding sites (decaying logs, compost heaps). Apply appropriate insecticide into the bore hole. Use pheromone traps to monitor beetle populations.',
  },
  'Magnesium Deficiency': {
    description: 'Interveinal chlorosis (yellowing) of older fronds with a persistent green midrib. Severe deficiency causes orange-yellow discoloration of the entire frond.',
    remedy: 'Apply Dolomite at 500 g per tree with recommended fertilizer mixture. Long-term: 1 kg Dolomite per bearing tree per year.',
  },
  'Potassium Deficiency': {
    description: 'Orange-brown scorching along leaflet margins and tips of older fronds. Leaves take on a bronzed or "burnt" appearance and may show premature necrosis.',
    remedy: 'Apply Muriate of Potash (KCl) per CRI schedule using split application. Add 500 g extra MOP if deficiency persists.',
  },
  'Yellow Patches': {
    description: 'Irregular yellow spots on fronds caused by fungal pathogens under humid conditions. Spots enlarge and merge into brown lesions with yellow halos.',
    remedy: 'Remove infected leaves. Improve air circulation through pruning. Apply copper-based fungicide in severe cases. Maintain balanced NPK fertilization.',
  },
};

function getInfo(name) {
  const db = DISEASE_DB[name];
  return {
    description: db?.shortDescription || DISEASE_FALLBACK[name]?.description || '',
    remedy:      db?.shortRemedy      || DISEASE_FALLBACK[name]?.remedy      || '',
  };
}

function aggregateDiseases(items, getDiseaseKey, getConf, getDesc, getRemedy) {
  const count = {}, maxConf = {}, desc = {}, remedy = {};
  let healthy = 0;

  items.forEach(item => {
    const d = getDiseaseKey(item);
    if (!d || d === 'Healthy') { healthy++; return; }
    if (d === 'Error' || d === 'Unknown') return;
    count[d]   = (count[d]   || 0) + 1;
    maxConf[d] = Math.max(maxConf[d] || 0, getConf(item));
    if (!desc[d]   && getDesc(item))   desc[d]   = getDesc(item);
    if (!remedy[d] && getRemedy(item)) remedy[d] = getRemedy(item);
  });

  const total = items.length;
  const diseases = Object.entries(count)
    .sort((a, b) => b[1] - a[1])
    .map(([name, cnt]) => {
      const info = getInfo(name);
      return {
        name,
        count: cnt,
        percentage: total > 0 ? Math.round((cnt / total) * 100) : 0,
        topConfidence: maxConf[name] || 0,
        description: desc[name]   || info.description,
        remedy:      remedy[name] || info.remedy,
      };
    });

  return { diseases, healthy, total };
}

// Builds analysisData from AnalyseImages results array
// Each result: { filename, disease, confidence, top3, annotated_image, remedy, description }
export function buildLeafAnalysisData(results) {
  const { diseases, healthy, total } = aggregateDiseases(
    results,
    r => r.disease,
    r => r.confidence || 0,
    r => r.description,
    r => r.remedy,
  );

  const annotatedImages = results
    .filter(r => r.annotated_image)
    .slice(0, 3)
    .map(r => r.annotated_image);

  return {
    analysisType:   'leaf',
    totalImages:    total,
    healthyPercent: total > 0 ? Math.round((healthy / total) * 100) : 0,
    diseases,
    treeSummary:    null,
    annotatedImages,
    gps:            null,
  };
}

// Drone Images tab: diResults[].trees[] each have { disease, disease_confidence, crop_image }
export function buildDroneImageAnalysisData(diResults) {
  const allTreesRaw = diResults.flatMap(r => r.trees || []);
  const annotatedImages = diResults
    .filter(r => r.annotated_b64)
    .map(r => r.annotated_b64);

  const { diseases, healthy, total } = aggregateDiseases(
    allTreesRaw,
    t => t.disease,
    t => t.disease_confidence || 0,
    () => null,
    () => null,
  );

  const allTrees = allTreesRaw
    .filter(t => t.crop_image)
    .map(t => ({
      tree_id:            t.tree_id ?? null,
      disease:            t.disease || 'Healthy',
      disease_confidence: t.disease_confidence ?? 0,
      crop_image:         t.crop_image,
    }));

  // Average GPS from all images that embedded EXIF coordinates
  const gpsPoints = diResults.filter(r => r.gps?.lat != null);
  const gps = gpsPoints.length > 0 ? {
    lat:    Math.round((gpsPoints.reduce((s, r) => s + r.gps.lat, 0) / gpsPoints.length) * 1e7) / 1e7,
    lon:    Math.round((gpsPoints.reduce((s, r) => s + r.gps.lon, 0) / gpsPoints.length) * 1e7) / 1e7,
    source: 'exif',
  } : null;

  return {
    analysisType:   'drone-image',
    totalImages:    diResults.length,
    healthyPercent: total > 0 ? Math.round((healthy / total) * 100) : 0,
    diseases,
    treeSummary:    { total, healthy, atRisk: total - healthy },
    annotatedImages,
    allTrees,
    gps,
  };
}

/**
 * Builds analysisData from FarmMapAnalysis trees + optional GPS + optional compressed map.
 *
 * @param {Array}  trees    - Tree objects: { tree_id, cx_px, cy_px, disease, disease_confidence, crop_image }
 * @param {Object} gps      - { lat, lon } GPS coords extracted from video
 * @param {Object} mapData  - { src, w, h } — compressed JPEG data URL + original map dimensions
 */
export function buildDroneVideoAnalysisData(trees, gps, mapData = null) {
  // crop_image = base64 from live ML run; crop_url = Cloudinary URL from saved detection
  const cropSrc = (t) => t?.crop_image || t?.crop_url || null;

  const { diseases, healthy, total } = aggregateDiseases(
    trees,
    t => t.disease,
    t => t.disease_confidence || 0,
    () => null,
    () => null,
  );

  // Grab crop images from diseased trees for the legacy annotatedImages field (max 3)
  const annotatedImages = trees
    .filter(t => cropSrc(t) && t.disease && t.disease !== 'Healthy')
    .slice(0, 3)
    .map(t => cropSrc(t));

  // All diseased trees with their crop image for the per-tree gallery in the report
  const affectedTrees = trees
    .filter(t => t.disease && t.disease !== 'Healthy' && cropSrc(t))
    .map(t => ({
      tree_id:            t.tree_id,
      disease:            t.disease,
      disease_confidence: t.disease_confidence ?? 0,
      crop_image:         cropSrc(t),
    }));

  // All trees (healthy + diseased) with crop images for the full per-tree gallery
  const allTrees = trees
    .filter(t => cropSrc(t))
    .map(t => ({
      tree_id:            t.tree_id,
      disease:            t.disease || 'Healthy',
      disease_confidence: t.disease_confidence ?? 0,
      crop_image:         cropSrc(t),
    }));

  // Tree positions as percentages of original map dimensions for the overlay rendering
  const treesForMap = (mapData && mapData.w && mapData.h)
    ? trees.map(t => ({
        tree_id: t.tree_id,
        cx_pct:  (t.cx_px / mapData.w) * 100,
        cy_pct:  (t.cy_px / mapData.h) * 100,
        disease: t.disease || null,
      }))
    : [];

  return {
    analysisType:   'drone-video',
    totalImages:    total,
    healthyPercent: total > 0 ? Math.round((healthy / total) * 100) : 0,
    diseases,
    treeSummary:    { total, healthy, atRisk: total - healthy },
    annotatedImages,
    gps: gps ? { lat: gps.lat, lon: gps.lon, source: 'video' } : null,
    // Map + per-tree data
    mapImage:    mapData?.src   || null,
    mapWidth:    mapData?.w     || null,
    mapHeight:   mapData?.h     || null,
    treesForMap,
    affectedTrees,
    allTrees,
  };
}
