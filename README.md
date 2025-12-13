# 0 A.D. Mod Manager

Internal mod management and signing system for Wildfire Games' 0 A.D.

## Features

- Mod.io synchronization
- Digital signature verification
- User authentication (JWT)
- Role-based access control (admin/mod_signer)
- Audit logging (GDPR-compliant)

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
