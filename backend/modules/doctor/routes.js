const r = require('express').Router(), crypto = require('crypto');
const { q } = require('../../infrastructure/postgresql/db');
const { auth, audit, wrap } = require('../../api-gateway/middleware');

const validDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const activeShare = `exists (
  select 1 from shares s
  where s.owner_id=u.id and s.recipient_id=$1 and s.revoked=false and s.expires_at>now()
)`;

// GET /doctor/patients [ ?healthId=... ] - only patients who actively shared with this doctor
r.get('/patients', auth('doctor'), wrap(async (req, res) => {
  const healthId = typeof req.query.healthId === 'string' ? req.query.healthId.trim() : '';
  const rows = await q(
    `select u.id,u.name,p.dob,p.gender,p.phone,p.blood,p.conditions,m.card_id as health_id,
      max(s.created_at) as last_shared_at
     from users u
     join shares s on s.owner_id=u.id and s.recipient_id=$1 and s.revoked=false and s.expires_at>now()
     left join profiles p on p.user_id=u.id
     left join medcards m on m.user_id=u.id
     where u.role='patient' and ($2='' or upper(m.card_id)=upper($2))
     group by u.id,u.name,p.dob,p.gender,p.phone,p.blood,p.conditions,m.card_id
     order by max(s.created_at) desc`,
    [req.user.id, healthId],
  );
  audit(req.user.id, 'doctor.patients.list', null);
  res.json(rows);
}));

// GET /doctor/inbox - activity events for patients who still share with this doctor
r.get('/inbox', auth('doctor'), wrap(async (req, res) => {
  const rows = await q(
    `select e.id,e.patient_id as pid,u.name as patient_name,e.event_type as type,e.message,e.reference_id,
      e.read_at is null as unread,e.created_at
     from doctor_inbox_events e
     join users u on u.id=e.patient_id
     where e.doctor_id=$1 and ${activeShare}
     order by e.created_at desc limit 100`,
    [req.user.id],
  );
  res.json(rows);
}));

// PATCH /doctor/inbox/:id/read
r.patch('/inbox/:id/read', auth('doctor'), wrap(async (req, res) => {
  const rows = await q(
    'update doctor_inbox_events set read_at=coalesce(read_at,now()) where id=$1 and doctor_id=$2 returning id',
    [req.params.id, req.user.id],
  );
  if (!rows.length) return res.status(404).json({ error: 'Inbox item not found' });
  res.json({ read: true });
}));

// GET /doctor/appointments?date=YYYY-MM-DD
r.get('/appointments', auth('doctor'), wrap(async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : '';
  if (!validDate(date)) {
    return res.status(400).json({ error: 'A valid date in YYYY-MM-DD format is required' });
  }
  const rows = await q(
    `select a.id,a.patient_id as pid,u.name as patient_name,a.appointment_date::text as date,
      a.minutes,a.appointment_type as type,a.status
     from doctor_appointments a
     join users u on u.id=a.patient_id
     where a.doctor_id=$1 and a.appointment_date=$2 and ${activeShare}
     order by a.minutes`,
    [req.user.id, date],
  );
  res.json(rows);
}));

// POST /doctor/appointments { patientId, date, minutes, type }
r.post('/appointments', auth('doctor'), wrap(async (req, res) => {
  const { patientId, date, minutes, type } = req.body || {};
  if (typeof patientId !== 'string' || !patientId ||
      !validDate(date) ||
      !Number.isInteger(minutes) || minutes < 0 || minutes > 1439 ||
      typeof type !== 'string' || !type.trim() || type.length > 100) {
    return res.status(400).json({ error: 'patientId, valid date, minutes, and appointment type are required' });
  }
  const [patient] = await q(
    `select u.id from users u where u.id=$2 and u.role='patient' and ${activeShare}`,
    [req.user.id, patientId],
  );
  if (!patient) return res.status(403).json({ error: 'The patient must actively share records with you before booking' });
  const id = crypto.randomUUID();
  const [appointment] = await q(
    `insert into doctor_appointments(id,doctor_id,patient_id,appointment_date,minutes,appointment_type)
     values($1,$2,$3,$4,$5,$6)
     returning id,patient_id as pid,appointment_date::text as date,minutes,appointment_type as type,status`,
    [id, req.user.id, patientId, date, minutes, type.trim()],
  );
  audit(req.user.id, 'doctor.appointment.create', id);
  res.status(201).json(appointment);
}));

// PATCH /doctor/appointments/:id/complete
r.patch('/appointments/:id/complete', auth('doctor'), wrap(async (req, res) => {
  const rows = await q(
    `update doctor_appointments set status='completed'
     where id=$1 and doctor_id=$2 returning id,status`,
    [req.params.id, req.user.id],
  );
  if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
  audit(req.user.id, 'doctor.appointment.complete', req.params.id);
  res.json(rows[0]);
}));

module.exports = r;
