const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a base64 data-URI to Cloudinary and return the secure URL + public_id.
 * @param {string} dataUri  "data:image/jpeg;base64,…"
 * @param {string} folder   Cloudinary folder path
 * @param {string} [publicId]  Optional stable public_id (for overwrites)
 */
async function uploadBase64(dataUri, folder, publicId) {
  const opts = { folder, resource_type: 'image' };
  if (publicId) opts.public_id = publicId;
  const result = await cloudinary.uploader.upload(dataUri, opts);
  return { url: result.secure_url, publicId: result.public_id };
}

/**
 * Delete one or many Cloudinary assets by public_id.
 * Silently ignores missing assets (already deleted / never uploaded).
 */
async function deleteAssets(publicIds) {
  const ids = Array.isArray(publicIds) ? publicIds : [publicIds];
  const valid = ids.filter(Boolean);
  if (!valid.length) return;
  await cloudinary.api.delete_resources(valid, { resource_type: 'image' }).catch(() => {});
}

module.exports = { cloudinary, uploadBase64, deleteAssets };
