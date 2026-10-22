// Encrypted file storage (AES-256-GCM). Currently local disk; for S3 just change save/read.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const DIR = path.join(process.cwd(), 'storage'); fs.mkdirSync(DIR, { recursive: true });
const key = () => { const k = Buffer.from(process.env.FILE_KEY || '', 'hex'); if (k.length !== 32) throw new Error('FILE_KEY must be 64 hex chars'); return k; };
exports.save = (buf) => {
  const id = crypto.randomUUID(), iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(buf), c.final()]);
  fs.writeFileSync(path.join(DIR, id), Buffer.concat([iv, c.getAuthTag(), enc])); return id;
};
exports.read = (id) => {
  const raw = fs.readFileSync(path.join(DIR, path.basename(id)));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12)); d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
};
exports.remove = (id) => {
  try { fs.unlinkSync(path.join(DIR, path.basename(id))); } catch { /* already gone */ }
};
