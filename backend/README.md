# SARVAYUH Backend (Node.js)

## Folder structure
    api-gateway/       server.js (rate limit, logging, routes), middleware.js (JWT, roles, kiosk key, audit)
    infrastructure/
      postgresql/      db.js + schema.sql (tables + pgvector extension auto-create hote hain)
      redis/           client.js (QR tokens, TTL)
      queue/           index.js (BullMQ) + worker.js (reminders/notifications)
      encrypted-storage/ storage.js (AES-256-GCM)
      docker-compose.yml  (local Postgres + Redis)
    modules/
      auth | profile | records | sharing-consent | medcard
      prescriptions-med-tracker | pharmacy-medatm | ai-service   (har ek mein routes.js)

## Chalane ke liye
    npm install
    cp .env.example .env      # secrets bharo (FILE_KEY = 64 hex chars)
    npm run infra             # Docker se PostgreSQL + pgvector + Redis (Docker chahiye)
    npm run dev               # API  -> http://localhost:4000
    npm run worker            # (alag terminal) notification worker

The local PostgreSQL service uses `pgvector/pgvector:pg16`. On startup, the migration enables
the `vector` extension and creates `record_embeddings` with a 1536-dimensional vector and
cosine HNSW index. Embedding generation is not automatic yet; records are currently stored as
encrypted files and their metadata is stored in PostgreSQL.

## Endpoints
| Method | Path | Who |
|---|---|---|
| POST | /auth/signup, /auth/login | public |
| GET / PUT | /profile | any / patient |
| GET / POST | /records (multipart upload) | patient; GET ?patientId= doctor/pharmacy (share ke saath) |
| GET | /records/:id/file | owner ya active share |
| POST / GET / DELETE | /shares, /shares/:id (revoke) | patient |
| GET | /medcard | patient |
| POST | /medcard/qr (2 min, single-use) | patient |
| PATCH | /medcard/lock | patient |
| POST / GET | /prescriptions | doctor / patient+doctor |
| GET | /doctor/patients | doctor; only patients with an active record share |
| GET | /doctor/inbox, PATCH /doctor/inbox/:id/read | doctor; recent patient record-share activity |
| GET / POST | /doctor/appointments | doctor; appointments for patients with an active record share |
| PATCH | /doctor/appointments/:id/complete | doctor; own appointment only |
| POST | /medatm/scan, /medatm/orders | kiosk (header x-kiosk-key) |
| GET | /medatm/orders/:id | kiosk |
| GET / POST | /medatm/orders, /medatm/orders/:id/approve | pharmacist |
| POST | /ai/chat | patient |

## Flow test
signup (patient, doctor, pharmacist) -> PUT /profile -> POST /records -> GET /medcard (card id)
-> doctor POST /prescriptions -> patient POST /medcard/qr -> kiosk POST /medatm/scan
-> kiosk POST /medatm/orders -> pharmacist POST /medatm/orders/:id/approve -> kiosk GET /medatm/orders/:id

The doctor workspace lists only patients with an active, doctor-addressed record share.
Sharing records with a doctor creates an inbox activity item. Doctor appointments are
persisted per doctor and patient, and booking requires the patient's active share to remain valid.

## Baaki kaam
- Payment gateway (abhi payment method sirf record hota hai).
- Link-token wale shares (bina email) kholne ka endpoint.
- Local storage -> S3, doctor/pharmacist licence verification, har MedATM ka alag key.
- DPDP Act / ABDM compliance kisi advisor se check karwao.
