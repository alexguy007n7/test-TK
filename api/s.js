import { createHmac, timingSafeEqual } from 'crypto';

function makeToken(secret, w) {
  return createHmac('sha256', secret).update(w.toString()).digest('hex');
}

function isValidToken(token, secret) {
  if (!token || !secret) return false;
  const now = Math.floor(Date.now() / 30000);
  return [now, now - 1].some(function (w) {
    const expected = makeToken(secret, w);
    try {
      return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
    } catch (_) { return false; }
  });
}

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const secret = process.env.SOLI_SECRET;
  const token  = req.query.t || '';

  if (!isValidToken(token, secret)) return res.status(403).end();

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/javascript');

  const code = `
var codeReader  = new ZXing.BrowserMultiFormatReader();
var video       = document.getElementById("video");
var hasil       = document.getElementById("hasil");
var _lastResult = null;
var _scanning   = false;

/* ── BEEP saat berhasil scan ───────────────────────────────── */
function beep() {
  try {
    var ctx  = new (window.AudioContext || window.webkitAudioContext)();
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type            = 'sine';
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
  } catch(e) {}
}

/* ── Flash hijau di kotak hasil ───────────────────────────── */
function flash(el) {
  el.style.transition = 'background 0.1s';
  el.style.background = '#003322';
  setTimeout(function() { el.style.background = '#000'; }, 400);
}

/* ── Render hasil scan ─────────────────────────────────────── */
function tampilkan(text) {
  if (!text || text === _lastResult) return;
  _lastResult = text;

  beep();
  flash(hasil);

  var isUrl = /^https?:\\/\\//.test(text);

  hasil.innerHTML =
    '<div style="font-size:11px;color:#555;margin-bottom:6px;letter-spacing:1px;">HASIL SCAN</div>' +
    '<div style="word-break:break-all;font-size:14px;color:#00ffd0;margin-bottom:12px;">' +
      ( isUrl
          ? '<a href="' + text + '" target="_blank" style="color:#00ffd0;">' + text + '</a>'
          : '<span style="color:#fff;">' + text + '</span>'
      ) +
    '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      '<button id="btnSalin" onclick="salinHasil()" style="padding:8px 14px;background:#00ffd0;border:none;border-radius:6px;cursor:pointer;font-size:12px;width:auto;">Salin</button>' +
      ( isUrl
          ? '<a href="' + text + '" target="_blank"><button style="padding:8px 14px;background:#0077ff;border:none;border-radius:6px;cursor:pointer;font-size:12px;color:#fff;width:auto;">Buka Link</button></a>'
          : ''
      ) +
      '<button onclick="resetHasil()" style="padding:8px 14px;background:#222;border:1px solid #333;border-radius:6px;cursor:pointer;font-size:12px;color:#888;width:auto;">Reset</button>' +
    '</div>';
}

/* ── Salin hasil ke clipboard ─────────────────────────────── */
window.salinHasil = function() {
  if (!_lastResult) return;
  var btn = document.getElementById('btnSalin');
  function ok() {
    if (btn) { btn.textContent = '\u2713 Disalin!'; btn.style.background = '#00aa88'; }
    setTimeout(function() {
      if (btn) { btn.textContent = 'Salin'; btn.style.background = '#00ffd0'; }
    }, 1800);
  }
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(_lastResult).then(ok).catch(ok);
  } else {
    var ta = document.createElement('textarea');
    ta.value = _lastResult;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    ok();
  }
};

/* ── Reset hasil ───────────────────────────────────────────── */
window.resetHasil = function() {
  _lastResult = null;
  hasil.innerHTML = 'Belum ada hasil';
  hasil.style.background = '#000';
};

/* ── Aktifkan kamera ───────────────────────────────────────── */
window.startCamera = function() {
  if (_scanning) return;
  _scanning = true;

  var btn = document.querySelector('button[onclick="startCamera()"]');
  if (btn) {
    btn.textContent = 'Kamera Aktif...';
    btn.style.opacity = '0.6';
    btn.disabled = true;
  }

  codeReader.decodeFromVideoDevice(null, video, function(result, err) {
    if (result && result.text) tampilkan(result.text);
  });
};

/* ── Upload gambar ─────────────────────────────────────────── */
document.getElementById("fileInput").addEventListener("change", function(e) {
  var file = e.target.files[0];
  if (!file) return;

  var preview = document.getElementById("preview");
  preview.src = URL.createObjectURL(file);

  var reader = new FileReader();
  reader.onload = function() {
    codeReader.decodeFromImage(undefined, reader.result)
      .then(function(result) {
        tampilkan(result.text);
      })
      .catch(function() {
        hasil.innerHTML =
          '<div style="color:#ff4444;font-size:13px;">\u26a0 Barcode tidak terbaca</div>' +
          '<div style="font-size:11px;color:#555;margin-top:6px;">Coba gambar yang lebih jelas atau terang.</div>';
      });
  };
  reader.readAsDataURL(file);
});
`.trim();

  return res.status(200).send(code);
}
