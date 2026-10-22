const r = require('express').Router(), bcrypt = require('bcryptjs'), crypto = require('crypto');
const { q, tx } = require('../../infrastructure/postgresql/db'), redis = require('../../infrastructure/redis/client');
const { sign, audit, wrap } = require('../../api-gateway/middleware');
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const RESET_TTL = 900; // 15 minutes

// POST /auth/signup  { name, email, password, role? }
r.post('/signup', wrap(async (req, res) => {
  const { name, email, password, role = 'patient' } = req.body || {};
  if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: 'name, email and password (8+ chars) required' });
  if (!['patient', 'doctor', 'pharmacist'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  // NOTE: production mein doctor/pharmacist ko licence verify karke hi enable karo.
  const u = { id: crypto.randomUUID(), name, email: email.toLowerCase(), role };
  await tx(async (c) => {
    await c.query('insert into users(id,name,email,pass_hash,role) values($1,$2,$3,$4,$5)', [u.id, name, u.email, bcrypt.hashSync(password, 10), role]);
    if (role === 'patient') {
      await c.query('insert into profiles(user_id) values($1)', [u.id]);
      await c.query('insert into medcards(card_id,user_id) values($1,$2)', ['SVH-' + crypto.randomInt(1000, 9999) + '-' + crypto.randomInt(1000, 9999), u.id]);
    }
  });
  res.status(201).json({ token: sign(u), user: pub(u) });
}));

// POST /auth/login  { email, password }
r.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const [u] = await q('select * from users where email=$1', [String(email || '').toLowerCase()]);
  if (!u || !bcrypt.compareSync(String(password || ''), u.pass_hash)) return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ token: sign(u), user: pub(u) });
}));

// POST /auth/forgot-password  { email } -> always replies the same, so accounts cannot be probed
r.post('/forgot-password', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email required' });
  const [u] = await q('select id from users where email=$1', [email]);
  if (u) {
    const token = crypto.randomBytes(24).toString('hex');
    await redis.set('reset:' + token, u.id, 'EX', RESET_TTL);
    audit(u.id, 'auth.reset.request', token);
    // TODO: deliver the token by email/SMS. Until then it is logged and returned in dev.
    console.log('[reset] token for ' + email + ': ' + token);
    if (process.env.DEV_RESET_TOKEN === 'true') return res.json({ sent: true, token });
  }
  res.json({ sent: true });
}));

// POST /auth/reset-password  { token, password }
r.post('/reset-password', wrap(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password || password.length < 8) return res.status(400).json({ error: 'token and password (8+ chars) required' });
  const uid = await redis.getdel('reset:' + token);
  if (!uid) return res.status(400).json({ error: 'This reset link is invalid or has expired' });
  await q('update users set pass_hash=$1 where id=$2', [bcrypt.hashSync(password, 10), uid]);
  audit(uid, 'auth.reset.complete', null);
  res.json({ reset: true });
}));
module.exports = r;
