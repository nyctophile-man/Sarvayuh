require('dotenv').config();
for (const k of ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'QR_SECRET', 'FILE_KEY', 'KIOSK_API_KEY']) if (!process.env[k]) { console.error('Missing env: ' + k + ' (see .env.example)'); process.exit(1); }
const express = require('express'), helmet = require('helmet'), cors = require('cors'), morgan = require('morgan'), rate = require('express-rate-limit');
const { migrate } = require('../infrastructure/postgresql/db');
const app = express();
app.use(helmet(), cors(), morgan('tiny'), express.json({ limit: '100kb' }), rate({ windowMs: 60e3, limit: 120 }));   // logging + rate limit
app.get('/health', (_, res) => res.json({ ok: true }));
app.use('/auth', rate({ windowMs: 60e3, limit: 10 }), require('../modules/auth/routes'));
app.use('/profile', require('../modules/profile/routes'));
app.use('/records', require('../modules/records/routes'));
app.use('/shares', require('../modules/sharing-consent/routes'));
app.use('/medcard', require('../modules/medcard/routes'));
app.use('/prescriptions', require('../modules/prescriptions-med-tracker/routes'));
app.use('/doctor', require('../modules/doctor/routes'));
app.use('/medatm', require('../modules/pharmacy-medatm/routes'));
app.use('/ai', require('../modules/ai-service/routes.ts').aiRouter);
app.use('/feedback', require('../modules/feedback/routes'));
app.use((_, res) => res.status(404).json({ error: 'Not found' }));
app.use((e, _req, res, _next) => {
  if (e.code === '23505') return res.status(409).json({ error: 'Already exists' });
  if (e.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 10 MB)' });
  console.error(e); res.status(500).json({ error: 'Something went wrong' });
});
migrate().then(() => app.listen(process.env.PORT || 4000, () => console.log('SARVAYUH API on :' + (process.env.PORT || 4000))))
  .catch((e) => { console.error('Database not reachable:', e.message); process.exit(1); });
