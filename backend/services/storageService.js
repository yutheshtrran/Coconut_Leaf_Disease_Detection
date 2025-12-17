const multer = require('multer');

// Use memory storage; files will be forwarded to Cloudinary by controller
const storage = multer.memoryStorage();

// Accept only image mime types and limit file size (2MB)
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, or WEBP images are allowed'));
  }
  cb(null, true);
};

// Initialize multer with the storage configuration
const MAX_SIZE_MB = Number(process.env.MAX_PROFILE_IMAGE_MB || 5);
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 }, // default 5MB
});

// Export the upload middleware
module.exports = upload;