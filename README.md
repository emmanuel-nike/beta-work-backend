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

Default admin (from seeder):

- Email: `admin@betawork.app`
- Password: `password123`

## Auth

Send the access token as:

```http
Authorization: Bearer <token>
```

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | Public | Register user or artisan |
| POST | `/api/v1/auth/login` | Public | Login and receive token |
| POST | `/api/v1/auth/logout` | Token | Revoke current token |
| GET | `/api/v1/auth/me` | Token | Current user |
| GET | `/api/v1/artisans` | Public | Search verified artisans |
| GET | `/api/v1/artisans/:id` | Public | Artisan profile details |
| GET | `/api/v1/artisan/profile` | Artisan | Own artisan profile |
| PUT | `/api/v1/artisan/profile` | Artisan | Update own profile |
| GET | `/api/v1/admin/users` | Admin | List users |
| GET | `/api/v1/admin/users/:id` | Admin | User details |
| PATCH | `/api/v1/admin/users/:id/role` | Admin | Change user role |
| GET | `/api/v1/admin/artisans` | Admin | List artisan profiles |
| PATCH | `/api/v1/admin/artisans/:id/verification` | Admin | Approve/reject artisan |
