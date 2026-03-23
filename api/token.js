// api/token.js — CommonJS (Vercel Node.js default)
const crypto = require('crypto');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const secret = process.env.SOLI_SECRET;
  if (!secret) {
    console.error('[SoliCAN] SOLI_SECRET env variable tidak diset!');
    return res.status(500).end();
  }

  // Bulatkan per 30 detik → token berlaku maks 30 detik
  const win   = Math.floor(Date.now() / 30000).toString();
  const token = crypto.createHmac('sha256', secret).update(win).digest('hex');

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ t: token });
};
