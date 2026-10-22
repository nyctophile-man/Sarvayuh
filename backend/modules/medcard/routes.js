const r = require('express').Router(), jwt = require('jsonwebtoken'), crypto = require('crypto');
const { q } = require('../../infrastructure/postgresql/db'), redis = require('../../infrastructure/redis/client');
const { auth, audit, wrap } = require('../../api-gateway/middleware');
const QR_TTL = 120; // seconds

// GET /medcard
r.get('/', auth('patient'), wrap(async (req, res) => {
  const [c] = await q(`select m.card_id,m.locked,u.name,p.blood,p.dob,p.allergies,p.emergency_name,p.emergency_phone
    from medcards m join users u on u.id=m.user_id left join profiles p on p.user_id=m.user_id where m.user_id=$1`, [req.user.id]);
  if (c) res.json(c); else res.status(404).json({ error: 'MEDCARD not found' });
}));

// POST /medcard/qr -> 2 min, single-use token (QR does not contain real ID, signed token). Redis with TTL.
r.post('/qr', auth('patient'), wrap(async (req, res) => {
  const [c] = await q('select locked from medcards where user_id=$1', [req.user.id]);
  if (!c) return res.status(404).json({ error: 'MEDCARD not found' });
  if (c.locked) return res.status(403).json({ error: 'Card is locked. Unlock it in Security.' });
  const jti = crypto.randomUUID();
  await redis.set('qr:' + jti, req.user.id, 'EX', QR_TTL);
  audit(req.user.id, 'medcard.qr.issue', jti);
  res.json({ qrToken: jwt.sign({ sub: req.user.id, jti, typ: 'medcard-qr' }, process.env.QR_SECRET, { expiresIn: QR_TTL }), expiresIn: QR_TTL });
}));

// PATCH /medcard/lock { locked: true|false }
r.patch('/lock', auth('patient'), wrap(async (req, res) => {
  await q('update medcards set locked=$1 where user_id=$2', [!!req.body.locked, req.user.id]);
  res.json({ locked: !!req.body.locked });
}));
module.exports = r;
