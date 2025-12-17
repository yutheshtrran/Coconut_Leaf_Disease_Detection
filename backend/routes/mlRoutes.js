const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// store uploads in backend/uploads/ml
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads', 'ml'));
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});

const upload = multer({ storage });

const mlController = require('../controllers/mlController');

router.post('/predict', upload.array('files'), mlController.predict);

module.exports = router;
