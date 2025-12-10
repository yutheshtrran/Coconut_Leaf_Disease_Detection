// Utility to crop an image using canvas and return a Blob
export async function cropImageToBlob(imageSrc, crop, outputType = 'image/jpeg', quality = 0.9) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(crop.width);
  canvas.height = Math.round(crop.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    image,
    Math.round(crop.x),
    Math.round(crop.y),
    Math.round(crop.width),
    Math.round(crop.height),
    0,
    0,
    Math.round(crop.width),
    Math.round(crop.height)
  );

  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), outputType, quality);
  });
}
