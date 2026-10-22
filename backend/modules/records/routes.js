const r = require('express').Router(), multer = require('multer'), crypto = require('crypto');
const path = require('path');
const { q } = require('../../infrastructure/postgresql/db'), storage = require('../../infrastructure/encrypted-storage/storage');
const { auth, audit, wrap } = require('../../api-gateway/middleware');
const mimeByExtension = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, f, cb) => {
    const mimeType = mimeByExtension[path.extname(f.originalname || '').toLowerCase()] ||
      (f.mimetype || '').toLowerCase().split(';')[0];
    if (mimeType === 'application/pdf' || /^image\/(jpeg|png|webp|heic|heif)$/.test(mimeType)) {
      f.mimetype = mimeType;
      return cb(null, true);
    }
    cb(null, false);
  } });

// Which of my records are shared with me (active, not expired, not revoked)
const sharedIds = async (me, owner) =>
  (await q('select record_ids from shares where owner_id=$1 and recipient_id=$2 and revoked=false and expires_at>now()', [owner, me])).flatMap((s) => s.record_ids);
const clean = ({ file_key, ...rest }) => rest;

// GET /records  |  GET /records?patientId=  (doctor/pharmacy: only shared records)
r.get('/', auth(), wrap(async (req, res) => {
  const { patientId, category } = req.query; let rows;
  if (patientId && patientId !== req.user.id) {
    rows = await q('select * from records where user_id=$1 and id = any($2::text[])', [patientId, await sharedIds(req.user.id, patientId)]);
    audit(req.user.id, 'records.list.shared', patientId);
  } else rows = await q('select * from records where user_id=$1 order by created_at desc', [req.user.id]);
  res.json(rows.filter((x) => !category || x.category === category).map(clean));
}));

// POST /records  (multipart: file, title, category)
r.post('/', auth('patient'), upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload a PDF, JPG or PNG (max 10 MB)' });
  const rec = {
    id: crypto.randomUUID(),
    title: req.body.title || req.file.originalname,
    category: req.body.category || 'Others',
    mime: req.file.mimetype,
    size: req.file.size,
  };
  await q('insert into records(id,user_id,title,category,mime,size,file_key) values($1,$2,$3,$4,$5,$6,$7)',
    [rec.id, req.user.id, rec.title, rec.category, rec.mime, rec.size, storage.save(req.file.buffer)]);
  audit(req.user.id, 'records.upload', rec.id);
  res.status(201).json(rec);
}));

// GET /records/:id/file
r.get('/:id/file', auth(), wrap(async (req, res) => {
  const [rec] = await q('select * from records where id=$1', [req.params.id]);
  const ok = rec && (rec.user_id === req.user.id || (await sharedIds(req.user.id, rec.user_id)).includes(rec.id));
  if (!ok) return res.status(404).json({ error: 'Record not found' });
  audit(req.user.id, 'records.download', rec.id);
  res.type(rec.mime).send(storage.read(rec.file_key));
}));
// DELETE /records/:id  (owner only, removes the encrypted file too)
r.delete('/:id', auth('patient'), wrap(async (req, res) => {
  const [rec] = await q('select id,user_id,file_key from records where id=$1', [req.params.id]);
  if (!rec || rec.user_id !== req.user.id) return res.status(404).json({ error: 'Record not found' });
  await q('delete from records where id=$1', [rec.id]);
  try { storage.remove(rec.file_key); } catch {}
  audit(req.user.id, 'records.delete', rec.id);
  res.json({ deleted: true });
}));
module.exports = r;
