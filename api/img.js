// Vercel serverless proxy: fetches color images from the local network server
// and serves them over HTTPS to avoid browser mixed-content blocks.
// GET /api/img?code=BK39-GD

const http = require('http');

const IMG_SERVER = '192.168.118.136';
const IMG_PATH   = '/resources/ref_color/';
const TIMEOUT_MS = 10000;

function fetchImage(colorCode, ext) {
  return new Promise((resolve, reject) => {
    const options = {
      host: IMG_SERVER,
      port: 80,
      path: IMG_PATH + colorCode + ext,
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': 'Vercel-Proxy/1.0' }
    };
    const req = http.get(options, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${ext}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        type: res.headers['content-type'] || 'image/jpeg'
      }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

module.exports = async (req, res) => {
  // Allow CORS so the browser doesn't block the response
  res.setHeader('Access-Control-Allow-Origin', '*');

  const code = (req.query.code || '').replace(/[^A-Za-z0-9\-]/g, '').substring(0, 30);

  if (!code) {
    return res.status(400).json({ error: 'Missing ?code= parameter' });
  }

  // Try uppercase .JPG first, then lowercase .jpg
  let result = null;
  const errors = [];

  for (const ext of ['.JPG', '.jpg']) {
    try {
      result = await fetchImage(code, ext);
      break;
    } catch (err) {
      errors.push(`${ext}: ${err.message}`);
    }
  }

  if (!result) {
    console.error(`[img-proxy] Failed for ${code}:`, errors.join(' | '));
    return res.status(404).json({ error: 'Image not found', code, details: errors });
  }

  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=3600');
  res.setHeader('Content-Type', result.type);
  return res.send(result.buffer);
};
