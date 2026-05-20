// Vercel serverless function: proxies color images from the local HTTP server
// so the HTTPS Vercel page can load them without mixed-content errors.
// Usage: /api/img?code=BK39-GD

const http = require('http');

const IMG_SERVER = '192.168.118.136';
const IMG_PATH   = '/resources/ref_color/';

function fetchImage(colorCode, ext) {
  return new Promise((resolve, reject) => {
    const path = IMG_PATH + colorCode + ext;
    const req = http.get({ host: IMG_SERVER, path, timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), type: res.headers['content-type'] || 'image/jpeg' }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = async (req, res) => {
  const code = (req.query.code || '').replace(/[^A-Za-z0-9\-]/g, '');
  if (!code) return res.status(400).send('Missing code');

  // Try .JPG then .jpg
  let result;
  try {
    result = await fetchImage(code, '.JPG');
  } catch {
    try {
      result = await fetchImage(code, '.jpg');
    } catch (err) {
      return res.status(404).send('Image not found');
    }
  }

  // Cache for 1 hour on CDN, 24h in browser
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=3600');
  res.setHeader('Content-Type', result.type);
  res.send(result.buffer);
};
