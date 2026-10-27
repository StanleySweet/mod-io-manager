# 0 A.D. Mod Manager

Internal mod management and signing system for Wildfire Games' 0 A.D.

## Features

- Mod.io synchronization
- Digital signature verification
- User authentication (JWT)
- Role-based access control (admin/mod_signer)
- Audit logging (GDPR-compliant)
- Audit queue for the [modaudit](https://github.com/StanleySweet/modaudit) CLI: every unsigned current version is queued after each sync; results, findings and review status on the **Audits** page
- **API Keys** admin page for modaudit workers (key shown once, argon2 hash stored)
- Writes to mod.io (signature, repackaged file, comment) only after a signer approves in `modaudit review`, and only after the manager re-hashes the bytes and verifies every minisig against the per-alpha public keys

## Quick Start

### Backend
```bash
cd backend
npm install
cp ../.env.example .env  # Configure your environment
npm run migrate
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Deployment (fo27-runner)

The API runs as the systemd unit `mod-io-manager-api` from
`/home/fedora/mod-io-manager/backend`, with `EnvironmentFile=backend/.env.production`.
Do not create `backend/.env`: dotenv would load it too. httpd serves the frontend
from `/var/www/mod-io-manager/`, not from `frontend/dist`.

```bash
# on the server, after pushing main
cd /home/fedora/mod-io-manager && git pull --ff-only
sqlite3 backend/data/modio.db ".backup backend/data/backup-$(date +%Y%m%d%H%M%S).db"  # before schema changes
cd backend && npm ci && npm run build          # build cleans dist; migrations run at startup
cd ../frontend && npm ci && npm run build
sudo cp -r dist/. /var/www/mod-io-manager/ && sudo restorecon -R /var/www/mod-io-manager
sudo systemctl restart mod-io-manager-api && systemctl is-active mod-io-manager-api
```

Create a worker key without the UI: `npx tsx src/scripts/create-api-key.ts <name>` in `backend/`.

## Environment Variables

See `.env.example` for required configuration.

## Tech Stack

- **Backend**: Fastify, Knex, SQLite, JWT, Argon2
- **Frontend**: React, TypeScript, Tailwind CSS, Vite

## Security

- GDPR-compliant (no IP storage, hashed emails)
- Argon2id password hashing
- HMAC-SHA256 JWT signatures
- Audit logging for all critical actions

## License

Internal use only - Wildfire Games
