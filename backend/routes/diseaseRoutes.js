const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const diseaseController = require('../controllers/diseaseController');

// Multer with memory storage (for Cloudinary)
const storage = multer.memoryStorage();

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