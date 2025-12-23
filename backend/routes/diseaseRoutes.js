const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const diseaseController = require('../controllers/diseaseController');

// Ensure uploads/diseases directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'diseases');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('✅ Created uploads directory:', uploadDir);
} else {
  console.log('ℹ️ Uploads directory already exists:', uploadDir);
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Absolute path
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  },
});

// Routes
router.post('/', upload.array('images', 10), diseaseController.createDisease); // Allow up to 10 images
router.get('/', diseaseController.getAllDiseases);
router.get('/:id', diseaseController.getDiseaseById);
router.put('/:id', upload.array('images', 10), diseaseController.updateDisease);
router.delete('/:id', diseaseController.deleteDisease);

module.exports = router;