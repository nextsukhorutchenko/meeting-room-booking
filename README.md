# Meeting Room Booking

Meeting Room Booking is a Next.js application for reserving six office rooms.
Authenticated users can inspect a weekly or mobile daily schedule, create
bookings, cancel their own bookings, and review future and past reservations.

## Prerequisites

- Node.js 22.22.2 or later (`.nvmrc` pins 22.23.1)
- npm
- Docker with Docker Compose

## Local development

From PowerShell, create the local environment file and install the locked
dependencies:

```powershell
Copy-Item .env.example .env
npm ci
```

Start PostgreSQL, generate the Prisma client, apply the development migrations,
and seed the demo data:

```powershell
docker compose --env-file .env up -d --wait postgres
npm run db:generate
npm run db:migrate
npm run db:seed
```

Start the application:

```powershell
npm run dev
```

Open `http://localhost:3000`. To verify the complete startup against the
running application in a second terminal:

```powershell
$env:CLEAN_START_MUTATION_CONSENT = "database=postgresql://localhost:5432/meeting_room_booking;app=http://localhost:3000"
try {
  npm run verify:clean-start
} finally {
  Remove-Item Env:CLEAN_START_MUTATION_CONSENT
}
```

The verifier validates environment values and database readiness, deploys
migrations, runs the seed twice, checks health, registers and logs in a temporary
user, books and cancels one room, and removes its temporary records.

The verifier accepts only local PostgreSQL and HTTP targets. The database host
must be `localhost`, `127.0.0.1`, or `::1`, and the database name must be
`meeting_room_booking` or `meeting_room_booking_test`. The application URL must
be an HTTP loopback origin without a path. Consent must exactly match the
canonical database host, port, and name plus the application origin. It is
process-scoped, deliberately absent from `.env.example`, removed in `finally`,
and never forwarded to migration or seed child processes.

For the documented port overrides, bind the verifier to those exact targets:

```powershell
$env:DATABASE_URL = "postgresql://meeting_room_booking:meeting_room_booking@localhost:55432/meeting_room_booking?schema=public"
$env:APP_URL = "http://localhost:3300"
$env:CLEAN_START_MUTATION_CONSENT = "database=postgresql://localhost:55432/meeting_room_booking;app=http://localhost:3300"
try {
  npm run verify:clean-start
} finally {
  Remove-Item Env:CLEAN_START_MUTATION_CONSENT
}
```

## Docker startup

The Compose application uses the production image. `setup` is a one-shot
service that waits for PostgreSQL, deploys migrations, and runs the idempotent
seed before the non-root `app` container starts.

```powershell
Copy-Item .env.example .env
docker compose --env-file .env up --build -d --wait
docker compose --env-file .env ps
```

Open `http://localhost:3000`. Inspect setup or application output with:

```powershell
docker compose --env-file .env logs setup
docker compose --env-file .env logs app
```

If ports 3000 or 5432 are already occupied, set the documented Compose
overrides before startup:

```powershell
$env:APP_PORT = "3300"
$env:APP_URL = "http://localhost:3300"
$env:POSTGRES_PORT = "55432"
docker compose --env-file .env up --build -d --wait
```

To apply deploy migrations and seed again explicitly:

```powershell
docker compose --env-file .env run --rm setup
```

Stop the containers without deleting PostgreSQL data:

```powershell
docker compose --env-file .env down
```

## Database commands

```powershell
npm run db:generate
npm run db:migrate
npx prisma migrate deploy
npm run db:seed
npm run db:seed:test
```

`npm run db:reset:test` is destructive and refuses every database whose name
does not end in `_test`. Use it only for the isolated
`meeting_room_booking_test` database.

The development seed is idempotent and creates:

| Room | Floor | Capacity |
| --- | ---: | ---: |
| Maple | 1 | 4 |
| Oak | 1 | 6 |
| Pine | 2 | 8 |
| Spruce | 2 | 10 |
| Willow | 3 | 12 |
| Yew | 3 | 16 |

It also creates two verified demonstration users. These passwords are dummy
local credentials, not secrets:

| User | Email | Password |
| --- | --- | --- |
| Demo Organizer | `organizer@example.test` | `demo-booking-password` |
| Demo Guest | `guest@example.test` | `demo-booking-password` |

New registrations are unverified. `APP_DEPLOYMENT_MODE` and
`VERIFICATION_DELIVERY_MODE` are required.
`console` prints a one-time verification URL only when `APP_URL` is loopback.
It is rejected unless `APP_DEPLOYMENT_MODE=local-development`. Production
deployments must select `production` plus `webhook`, an HTTPS endpoint, and
`VERIFICATION_WEBHOOK_BEARER_TOKEN`. After registration commits, the app sends
an authenticated JSON request containing `recipientEmail`, `recipientName`,
`verificationUrl`, and `expiresAt`. Delivery failures never roll back or expose
the committed token through logs. The token expires after 24 hours and is
removed from browser history as soon as the verification page captures it.

The auth routes read at most `AUTH_REQUEST_BODY_MAX_BYTES` before parsing JSON,
including chunked requests. Login and registration use PostgreSQL-backed
per-client-IP and normalized-email windows. Configure their limits with the
`AUTH_*_LIMIT` values. `AUTH_CLIENT_IP_HEADER` must name a header overwritten by
the trusted reverse proxy; direct clients without it share the conservative
`unknown` bucket.

## Verification

Run the mandatory gates:

```powershell
docker compose --env-file .env.example config --quiet
npm run db:generate
npm run lint
npm run typecheck
npm run check:source
npm test
npm run test:integration
npm run build
npm run test:e2e
```

Useful focused commands are:

```powershell
npm run test:coverage
npm run test:impact
npm run test:e2e:list
npx playwright test --config playwright.config.ts --list
```

The deterministic Playwright suite excludes `e2e/exploratory` and is the
required browser gate. The canonical command always rebuilds current source,
starts the standalone server, and waits on `/api/health` before Playwright.
Pull requests use the impact map to select known-safe
tagged slices; unknown, deleted, renamed, copied, infrastructure, test, or
configuration paths fall back to the full suite. The custom reporter records
selection evidence without changing Playwright's result.

## Time and overlap rules

Bookings use half-open intervals: `[startsAt, endsAt)`. Two bookings overlap
only when `newStart < existingEnd` and `newEnd > existingStart`. A booking that
starts exactly when another ends is therefore valid. The database transaction
locks the room before checking this rule, so concurrent identical requests
produce one booking.

Timestamps are stored in UTC. The server validates office hours and 30-minute
alignment in the configured `OFFICE_TIMEZONE`, with the supplied default policy
of `Europe/Kyiv` and 09:00-19:00. The browser displays booking labels in the
user's IANA timezone and shows the office timezone when the zones differ.
`OFFICE_TIMEZONE`, `OFFICE_OPEN_HOUR`, and `OFFICE_CLOSE_HOUR` remain
environment-configurable.

## Delivered extensions

- One-time verification delivery with hashed, expiring tokens
- Leased and explicitly acknowledged booking handoff notifications
- Responsive daily mobile schedule and IANA timezone display
- Deterministic pull-request E2E impact selection and result reporting
- Optional Midscene visual exploration kept outside the required test suite

Midscene is optional. A credentialed run requires
`MIDSCENE_MODEL_BASE_URL`, `MIDSCENE_MODEL_API_KEY`,
`MIDSCENE_MODEL_NAME`, and `MIDSCENE_MODEL_FAMILY`, followed by:

```powershell
npm run test:exploratory
```

No credentialed Midscene result is implied by the deterministic gates.

## Known limitations

- Notifications use in-app polling every 60 seconds; there is no email, push,
  WebSocket, or background delivery channel. Polling leases each durable ID,
  the browser acknowledges after accepting a valid response, and an
  unacknowledged lease is redelivered after `NOTIFICATION_LEASE_SECONDS`.
  Delivery is therefore at least once and the browser deduplicates by ID.
- Midscene exploration is optional and unavailable without separate provider
  credentials.
- Recurring bookings are not implemented.
- The Compose file is a reproducible local setup, not a production deployment
  topology.
