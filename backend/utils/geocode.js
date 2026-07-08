const https = require('https');

/**
 * Reverse-geocode a lat/lon pair using the Nominatim OSM API.
 * Returns the display_name string, or null on failure.
 * Nominatim requires a User-Agent header identifying your application.
 */
function reverseGeocode(lat, lon) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16`;

    const req = https.get(url, {
      headers: {
        'User-Agent': 'CoconutLeafDiseaseDetection/1.0 (myfakem31@gmail.com)',
        'Accept-Language': 'en',
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data.display_name || null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

module.exports = { reverseGeocode };
