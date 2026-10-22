const r = require('express').Router(), crypto = require('crypto');
const { q } = require('../../infrastructure/postgresql/db');
const { auth, wrap } = require('../../api-gateway/middleware');

// POST /feedback  { rating, category, message, email, platform }
r.post('/', auth(), wrap(async (req, res) => {
  const b = req.body || {};
  const rating = Math.max(0, Math.min(5, Number(b.rating) || 0));
  if (!rating) return res.status(400).json({ error: 'Please choose a star rating' });
  const id = crypto.randomUUID();
  await q('insert into feedback(id,user_id,rating,category,message,email,platform) values($1,$2,$3,$4,$5,$6,$7)',
    [id, req.user.id, rating, b.category || 'Other', String(b.message || '').trim() || null, b.email || null, b.platform || null]);
  res.status(201).json({ saved: true, id });
}));

// GET /feedback  (my own feedback)
r.get('/', auth(), wrap(async (req, res) => {
  res.json(await q('select id,rating,category,message,created_at from feedback where user_id=$1 order by created_at desc', [req.user.id]));
}));
module.exports = r;
