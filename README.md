# Meeting Room Booking

Bootstrap repository for a Next.js meeting-room booking application.

## Requirements

- Node.js 22.13.0 or later
- Docker Compose for the local PostgreSQL service

## Commands

```bash
npm run dev
npm test -- src/lib/config/env.test.ts
npm run test:e2e
npm run lint
npm run typecheck
docker compose --env-file .env.example config --quiet
```

Copy `.env.example` to a local environment file before running services that require configuration.

## Development email verification

New accounts are unverified. Registration writes one development verification
URL to the server console instead of sending email. Open that one-time URL
within 24 hours to verify the account and enable room booking. Seeded demo users
are already verified.
