const r = require('express').Router(), jwt = require('jsonwebtoken'), crypto = require('crypto');
const { q } = require('../../infrastructure/postgresql/db'), redis = require('../../infrastructure/redis/client');
const { auth, kiosk, audit, wrap } = require('../../api-gateway/middleware');

// POST /medatm/scan (kiosk)  { qrToken } -> patient + active prescriptions + 10 min session
r.post('/scan', kiosk, wrap(async (req, res) => {
  let p;
  try { p = jwt.verify(req.body.qrToken, process.env.QR_SECRET); if (p.typ !== 'medcard-qr') throw 0; }
  catch { return res.status(401).json({ error: 'QR expired or invalid. Ask the patient to refresh it.' }); }
  const uid = await redis.getdel('qr:' + p.jti);               // atomic: one QR works only once
  if (uid !== p.sub) return res.status(409).json({ error: 'QR already used or expired' });
  const [u] = await q('select u.name, m.card_id, pr.allergies from users u join medcards m on m.user_id=u.id left join profiles pr on pr.user_id=u.id where u.id=$1', [p.sub]);
  audit(p.sub, 'medatm.scan', p.jti);
  res.json({ sessionToken: jwt.sign({ sub: p.sub, typ: 'kiosk-session' }, process.env.JWT_SECRET, { expiresIn: '10m' }), patient: u,
    prescriptions: await q("select * from prescriptions where patient_id=$1 and status='active'", [p.sub]) });
}));

// POST /medatm/orders (kiosk)  { sessionToken, prescriptionId, paymentMethod }
r.post('/orders', kiosk, wrap(async (req, res) => {
  const { sessionToken, prescriptionId, paymentMethod } = req.body || {};
  let s; try { s = jwt.verify(sessionToken, process.env.JWT_SECRET); if (s.typ !== 'kiosk-session') throw 0; } catch { return res.status(401).json({ error: 'Session expired. Scan again.' }); }
  if (!['UPI', 'CARD', 'CASH'].includes(paymentMethod)) return res.status(400).json({ error: 'paymentMethod must be UPI, CARD or CASH' });
  const [rx] = await q("select * from prescriptions where id=$1 and patient_id=$2 and status='active'", [prescriptionId, s.sub]);
  if (!rx) return res.status(404).json({ error: 'Active prescription not found' });
  const id = crypto.randomUUID(); // items from prescription only, no auto-substitution
  await q("insert into orders(id,patient_id,prescription_id,items,payment,status) values($1,$2,$3,$4,$5,'awaiting_pharmacist')", [id, s.sub, rx.id, JSON.stringify(rx.items), paymentMethod]);
  audit(s.sub, 'medatm.order', id);
  res.status(201).json({ id, status: 'awaiting_pharmacist' });
}));

// GET /medatm/orders/:id (kiosk) -> status poll; machine dispenses on 'approved'
r.get('/orders/:id', kiosk, wrap(async (req, res) => {
  const [o] = await q('select id,status from orders where id=$1', [req.params.id]);
  if (o) res.json(o); else res.status(404).json({ error: 'Order not found' });
}));

// Pharmacist: GET /medatm/orders?status=  |  POST /medatm/orders/:id/approve (digital sign-off)
r.get('/orders', auth('pharmacist'), wrap(async (req, res) =>
  res.json(await q('select * from orders where status=$1 order by created_at', [req.query.status || 'awaiting_pharmacist']))));
r.post('/orders/:id/approve', auth('pharmacist'), wrap(async (req, res) => {
  const rows = await q("update orders set status='approved', approved_by=$1 where id=$2 and status='awaiting_pharmacist' returning prescription_id", [req.user.id, req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'No pending order with this id' });
  await q("update prescriptions set status='dispensed' where id=$1", [rows[0].prescription_id]);
  audit(req.user.id, 'medatm.approve', req.params.id);
  res.json({ id: req.params.id, status: 'approved' });
}));
module.exports = r;
