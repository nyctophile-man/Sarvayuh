const r = require('express').Router(), crypto = require('crypto');
const { q, tx } = require('../../infrastructure/postgresql/db'), storage = require('../../infrastructure/encrypted-storage/storage');
const { auth, audit, wrap } = require('../../api-gateway/middleware');

// POST /shares  { recordIds:[], recipientEmail?, expiresInHours? }
r.post('/', auth('patient'), wrap(async (req, res) => {
  const { recordIds, recipientEmail, expiresInHours = 24 } = req.body || {};
  if (!Array.isArray(recordIds) || !recordIds.length) return res.status(400).json({ error: 'recordIds required' });
  if (req.body?.recipientRole && !recipientEmail) return res.status(400).json({ error: 'recipientEmail required for a role-specific share' });
  const mine = await q('select id from records where user_id=$1 and id = any($2::text[])', [req.user.id, recordIds]);
  if (mine.length !== new Set(recordIds).size) return res.status(403).json({ error: 'You can only share your own records' });
  let rid = null;
  let recipientRole = null;
  if (recipientEmail) {
    const [u] = await q('select id,role from users where email=$1', [String(recipientEmail).toLowerCase()]);
    if (!u) return res.status(404).json({ error: 'Recipient is not on SARVAYUH' });
    if (req.body?.recipientRole && req.body.recipientRole !== u.role) {
      return res.status(400).json({ error: `Recipient must have the ${req.body.recipientRole} role` });
    }
    rid = u.id; recipientRole = u.role;
  }
  const s = { id: crypto.randomUUID(), token: rid ? null : crypto.randomBytes(24).toString('hex'),
    expires_at: new Date(Date.now() + Math.min(+expiresInHours || 24, 720) * 3600e3).toISOString() };
  await tx(async (client) => {
    await client.query('insert into shares(id,owner_id,recipient_id,token,record_ids,expires_at) values($1,$2,$3,$4,$5,$6)', [s.id, req.user.id, rid, s.token, JSON.stringify(recordIds), s.expires_at]);
    if (recipientRole === 'doctor') {
      await client.query(
        `insert into doctor_inbox_events(id,doctor_id,patient_id,event_type,message,reference_id)
         values($1,$2,$3,'records_shared',$4,$5)`,
        [crypto.randomUUID(), rid, req.user.id, `Shared ${recordIds.length} health record${recordIds.length === 1 ? '' : 's'}`, s.id],
      );
    }
  });
  audit(req.user.id, 'shares.create', s.id);
  res.status(201).json({ ...s, expiresIn: Math.round(Math.min(+expiresInHours || 24, 720) * 3600) });
}));

// GET /shares  -> maine kya kya share kiya
r.get('/', auth('patient'), wrap(async (req, res) =>
  res.json(await q('select id,recipient_id,record_ids,expires_at,revoked from shares where owner_id=$1 order by created_at desc', [req.user.id]))));

// DELETE /shares/:id  -> revoke
r.delete('/:id', auth('patient'), wrap(async (req, res) => {
  const rows = await q('update shares set revoked=true where id=$1 and owner_id=$2 returning id', [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'Share not found' });
  audit(req.user.id, 'shares.revoke', req.params.id);
  res.json({ revoked: true });
}));
// GET /shares/public/:token  -> public manifest for a QR share link (no login, the token is the secret)
r.get('/public/:token', wrap(async (req, res) => {
  const [s] = await q('select id,record_ids,expires_at,revoked from shares where token=$1', [req.params.token]);
  if (!s || s.revoked || new Date(s.expires_at) < new Date()) return res.status(404).json({ error: 'This share link is invalid or has expired' });
  const rows = await q('select id,title,category,mime,size,created_at from records where id = any($1::text[])', [s.record_ids]);
  res.json({ shareId: s.id, expiresAt: s.expires_at, records: rows });
}));

// GET /shares/public/:token/file/:recordId -> download one file from a share link
r.get('/public/:token/file/:recordId', wrap(async (req, res) => {
  const [s] = await q('select record_ids,expires_at,revoked from shares where token=$1', [req.params.token]);
  if (!s || s.revoked || new Date(s.expires_at) < new Date()) return res.status(404).json({ error: 'This share link is invalid or has expired' });
  if (!s.record_ids.includes(req.params.recordId)) return res.status(404).json({ error: 'Record not found' });
  const [rec] = await q('select * from records where id=$1', [req.params.recordId]);
  if (!rec) return res.status(404).json({ error: 'Record not found' });
  res.type(rec.mime).send(storage.read(rec.file_key));
}));

module.exports = r;
