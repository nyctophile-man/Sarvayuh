const r = require('express').Router(), crypto = require('crypto');
const { q } = require('../../infrastructure/postgresql/db'), { notifications } = require('../../infrastructure/queue');
const { auth, audit, wrap } = require('../../api-gateway/middleware');

// POST /prescriptions (doctor)  { patientCardId, items:[{medicine,dosage,days}], notes }
r.post('/', auth('doctor'), wrap(async (req, res) => {
  const { patientCardId, items, notes } = req.body || {};
  if (!patientCardId || !Array.isArray(items) || !items.length || items.some((i) => !i.medicine || !i.dosage)) return res.status(400).json({ error: 'patientCardId and items[{medicine,dosage,days}] required' });
  const [card] = await q('select user_id from medcards where card_id=$1', [patientCardId]);
  if (!card) return res.status(404).json({ error: 'MEDCARD not found' });
  const id = crypto.randomUUID();
  await q('insert into prescriptions(id,doctor_id,patient_id,items,notes) values($1,$2,$3,$4,$5)', [id, req.user.id, card.user_id, JSON.stringify(items), notes || null]);
  audit(req.user.id, 'prescription.create', id);
  // Medicine tracker: patient ko notification/reminder queue mein (worker bhejega)
  notifications.add('prescription-created', { patientId: card.user_id, prescriptionId: id, medicines: items.map((i) => i.medicine) }).catch((e) => console.error('queue', e.message));
  res.status(201).json({ id, status: 'active' });
}));

// GET /prescriptions -> patient: meri, doctor: maine likhi
r.get('/', auth('patient', 'doctor'), wrap(async (req, res) => {
  const col = req.user.role === 'doctor' ? 'doctor_id' : 'patient_id';
  res.json(await q(`select * from prescriptions where ${col}=$1 order by created_at desc`, [req.user.id]));
}));
module.exports = r;
