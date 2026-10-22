const jwt = require('jsonwebtoken'), { q } = require('../infrastructure/postgresql/db');
const sign = (u) => jwt.sign({ sub: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
const auth = (...roles) => (req, res, next) => {            // JWT check + optional role check
  try {
    const p = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET);
    if (roles.length && !roles.includes(p.role)) return res.status(403).json({ error: 'Not allowed for your role' });
    req.user = { id: p.sub, role: p.role }; next();
  } catch { res.status(401).json({ error: 'Login required' }); }
};
const kiosk = (req, res, next) =>                            // MedATM machine key
  req.headers['x-kiosk-key'] && req.headers['x-kiosk-key'] === process.env.KIOSK_API_KEY ? next() : res.status(401).json({ error: 'Invalid kiosk key' });
const audit = (actor, action, target) => q('insert into audit_logs(actor_id,action,target) values($1,$2,$3)', [actor, action, target || null]).catch((e) => console.error('audit', e.message));
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);   // async errors -> error handler
module.exports = { sign, auth, kiosk, audit, wrap };
