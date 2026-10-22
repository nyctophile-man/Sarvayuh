const r = require('express').Router(), multer = require('multer');
const { q } = require('../../infrastructure/postgresql/db'), storage = require('../../infrastructure/encrypted-storage/storage');
const { auth, audit, wrap } = require('../../api-gateway/middleware');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, f, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype)) });

// Arrays are stored as comma separated text
const asText = (v) => (Array.isArray(v) ? v.join(', ') : (v == null || v === '' ? null : String(v)));

// GET /profile
r.get('/', auth(), wrap(async (req, res) => {
  const [p] = await q('select u.id,u.name,u.email,u.role,p.dob,p.gender,p.phone,p.blood,p.allergies,p.conditions,p.photo,p.emergency_name,p.emergency_phone from users u left join profiles p on p.user_id=u.id where u.id=$1', [req.user.id]);
  res.json(p);
}));

// PUT /profile  (Profile Setup screen)  { dob, gender, phone, blood, allergies[], conditions[], emergencyName, emergencyPhone }
r.put('/', auth('patient'), wrap(async (req, res) => {
  const b = req.body || {};
  await q(`insert into profiles(user_id,dob,gender,phone,blood,allergies,conditions,emergency_name,emergency_phone) values($1,$2,$3,$4,$5,$6,$7,$8,$9)
    on conflict (user_id) do update set dob=excluded.dob, gender=excluded.gender, phone=excluded.phone, blood=excluded.blood,
    allergies=excluded.allergies, conditions=excluded.conditions,
    emergency_name=excluded.emergency_name, emergency_phone=excluded.emergency_phone`,
    [req.user.id, b.dob || null, b.gender || null, b.phone || null, b.blood || null, asText(b.allergies), asText(b.conditions), b.emergencyName || null, b.emergencyPhone || null]);
  res.json({ saved: true });
}));

// POST /profile/photo  (multipart: file) -> stores an encrypted avatar, returns the file key
r.post('/photo', auth('patient'), upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload a JPG, PNG or WEBP image (max 5 MB)' });
  const key = storage.save(req.file.buffer);
  await q('update profiles set photo=$1, photo_mime=$2 where user_id=$3', [key, req.file.mimetype, req.user.id]);
  audit(req.user.id, 'profile.photo', key);
  res.status(201).json({ photo: key, mime: req.file.mimetype });
}));

// GET /profile/photo -> streams the avatar back
r.get('/photo', auth(), wrap(async (req, res) => {
  const [p] = await q('select photo, photo_mime from profiles where user_id=$1', [req.user.id]);
  if (!p || !p.photo) return res.status(404).json({ error: 'No photo uploaded' });
  res.type(p.photo_mime || 'image/jpeg').send(storage.read(p.photo));
}));
module.exports = r;
