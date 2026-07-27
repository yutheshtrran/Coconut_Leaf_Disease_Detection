const DroneDetection = require('../models/DroneDetection');
const { uploadBase64, deleteAssets } = require('../utils/cloudinary');

// POST /api/drone-detections — upload images to Cloudinary, save metadata to MongoDB
exports.save = async (req, res) => {
  try {
    const { title, mapImage, mapDims, treeCount, trees = [], gps, sessionId } = req.body;
    const uid = req.user._id.toString();

    // ── Upload orthomosaic map to Cloudinary ──────────────────────────────────
    let mapUrl = null, mapPublicId = null;
    if (mapImage) {
      const r = await uploadBase64(mapImage, `drone_detections/${uid}/maps`);
      mapUrl      = r.url;
      mapPublicId = r.publicId;
    }

    // ── Upload each tree crop to Cloudinary ───────────────────────────────────
    const savedTrees = await Promise.all(
      trees.map(async (tree) => {
        const { crop_image, ...rest } = tree;
        if (!crop_image) return { ...rest, crop_url: null, crop_public_id: null };
        try {
          const r = await uploadBase64(
            crop_image,
            `drone_detections/${uid}/crops`,
          );
          return { ...rest, crop_url: r.url, crop_public_id: r.publicId };
        } catch {
          return { ...rest, crop_url: null, crop_public_id: null };
        }
      })
    );

    const doc = await DroneDetection.create({
      userId: req.user._id,
      title: title || `Detection – ${new Date().toLocaleDateString()}`,
      mapUrl, mapPublicId, mapDims,
      treeCount, trees: savedTrees, gps, sessionId,
    });

    res.status(201).json({ success: true, id: doc._id, savedAt: doc.savedAt, title: doc.title });
  } catch (err) {
    console.error('Save detection error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/drone-detections — list (summary, no blobs)
exports.list = async (req, res) => {
  try {
    const docs = await DroneDetection.find({ userId: req.user._id })
      .select('title mapUrl mapDims treeCount gps sessionId savedAt')
      .sort({ savedAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, detections: docs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/drone-detections/:id — full detail (Cloudinary URLs included)
exports.getOne = async (req, res) => {
  try {
    const doc = await DroneDetection.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!doc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, detection: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/drone-detections/:id — remove doc + Cloudinary assets
exports.remove = async (req, res) => {
  try {
    const doc = await DroneDetection.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (doc) {
      const publicIds = [
        doc.mapPublicId,
        ...(doc.trees || []).map(t => t.crop_public_id),
      ].filter(Boolean);
      await deleteAssets(publicIds);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
