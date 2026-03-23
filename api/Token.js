// api/token.js
// Generate token HMAC(timestamp, SECRET) yang expire 30 detik.
// Tidak butuh auth — siapapun bisa minta token.
// Token hanya berguna untuk /api/s selama 30 detik.

import { createHmac } from 'crypto';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const secret = process.env.SOLI_SECRET;
  if (!secret) return res.status(500).end();

  // Timestamp dibulatkan per 30 detik → satu token valid maks 30 detik
  const window = Math.floor(Date.now() / 30000).toString();
  const token  = createHmac('sha256', secret).update(window).digest('hex');

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ t: token });
}
