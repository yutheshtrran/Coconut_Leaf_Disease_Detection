const { v2: cloudinary } = require('cloudinary');
const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_FOLDER } = process.env;

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} buffer - File buffer from Multer memory storage
 * @param {String} originalname - Original filename for public_id
 * @returns {Promise<String>} - Secure URL of uploaded image
 */
const uploadToCloudinary = async (buffer, originalname) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER || 'diseases/samples', // Uses .env folder or fallback
        public_id: originalname.replace(/\.[^/.]+$/, ''), // Remove extension for clean ID
        resource_type: 'image',
        overwrite: true, // Optional: overwrite if same name
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
};

module.exports = { cloudinary, uploadToCloudinary };