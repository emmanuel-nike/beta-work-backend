# BetaWork Backend

AdonisJS API backend for the BetaWork mobile application.

## Stack

- **AdonisJS 6** (API starter kit)
- **PostgreSQL** via Lucid ORM
- **Redis** for application caching
- **Opaque access tokens** for mobile authentication

## Roles

| Role | Description |
|------|-------------|
| `user` | Normal app users who search for artisans |
| `artisan` | Users with an artisan profile (trade + verification) |
| `admin` | System admins with dashboard/management endpoints |

## Setup

1. Use Node.js 22+
2. Copy env and set Postgres/Redis credentials:

```bash
cp .env.example .env
node ace generate:key
```

3. Create the database, then migrate and seed:

```bash
createdb betawork
node ace migration:run
node ace db:seed
```

4. Start the server:

```bash
npm run dev
```

Or with Docker (Postgres + Redis + API):

```bash
cp .env.example .env
# set APP_KEY via: node ace generate:key  (or paste into .env)
npm run docker:dev
```

### Tests

```bash
# Unit only (no DB required for current unit suite)
npm run test:unit

# Full suite / integration (needs Postgres; Redis optional because cache uses memory in test)
cp .env.test .env   # or export DB_* to point at betawork_test
createdb betawork_test   # if needed
npm run test:integration
npm test

# Via Docker
npm run docker:test
```

### Production Docker

```bash
npm run docker:prod
```

Default admin (from seeder):

- Email: `admin@betawork.app`
- Password: `password123`

## Auth

Send the access token as:

```http
Authorization: Bearer <token>
```

## API documentation

Frontend / mobile integration docs:

- Human-readable: [`docs/API.md`](./docs/API.md)
- OpenAPI 3 (Swagger / Postman): [`docs/openapi.yaml`](./docs/openapi.yaml)

### Endpoint summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/validate` | Public | Validate name/email/phone/address before register |
| POST | `/api/v1/auth/validate/identity` | Public | Validate NIN/BVN/photo (stub; returns photoUrl) |
| POST | `/api/v1/auth/otp/send` | Public | Dummy send OTP (returns generated OTP) |
| POST | `/api/v1/auth/otp/verify` | Public | Verify phone number OTP |
| POST | `/api/v1/auth/register` | Public | Register user or artisan |
| POST | `/api/v1/auth/login` | Public | Login and receive token |
| POST | `/api/v1/auth/logout` | Token | Revoke current token |
| GET | `/api/v1/auth/me` | Token | Current user |
| GET | `/api/v1/uploads/artisans/:fileName` | Public | Serve artisan photo |
| GET | `/api/v1/artisans` | Public | Search verified artisans |
| GET | `/api/v1/artisans/:id` | Public | Artisan profile details |
| GET | `/api/v1/artisan/profile` | Artisan | Own artisan profile |
| PUT | `/api/v1/artisan/profile` | Artisan | Update own profile |
| GET | `/api/v1/admin/users` | Admin | List users |
| GET | `/api/v1/admin/users/:id` | Admin | User details |
| PATCH | `/api/v1/admin/users/:id/role` | Admin | Change user role |
| GET | `/api/v1/admin/artisans` | Admin | List artisan profiles |
| PATCH | `/api/v1/admin/artisans/:id/verification` | Admin | Approve/reject artisan |

