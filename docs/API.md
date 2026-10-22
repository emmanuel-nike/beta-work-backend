# BetaWork API Documentation

Base URL: `http://localhost:3333/api/v1`

All responses are JSON unless noted (photo download).

---

## Authentication

Protected endpoints require:

```http
Authorization: Bearer <access_token>
```

Tokens are issued by `POST /auth/register` and `POST /auth/login`.

| Role      | Access                                         |
| --------- | ---------------------------------------------- |
| `user`    | Search artisans, own auth profile              |
| `artisan` | Everything a user can do + own artisan profile |
| `admin`   | Admin dashboard endpoints                      |

---

## Suggested mobile flows

### User registration

1. `POST /auth/validate` — validate name, email, phone, address
2. `POST /auth/otp/send` — request email OTP
3. `POST /auth/otp/verify` — verify email OTP
4. `POST /auth/register` — create account (`role` omitted or `"user"`)

### Artisan registration

1. `POST /auth/validate` — validate name, email, phone, address
2. `POST /auth/otp/send` → `POST /auth/otp/verify` (email OTP)
3. `POST /auth/validate/identity` — NIN, BVN, photo (`multipart`) → save returned `photoUrl` if needed
4. `POST /auth/register` — `role: "artisan"` + `artisanProfile` + `photo` (`multipart`)

### Forgot password

1. `POST /auth/password/forgot` — request a reset code by email (always 200)
2. `POST /auth/password/verify-otp` — check the code (optional UX step)
3. `POST /auth/password/reset` — set a new password with the code

---

## Common error shape

Validation failures typically return **422**:

```json
{
  "errors": [
    {
      "message": "The email has already been taken",
      "rule": "database.unique",
      "field": "email"
    }
  ]
}
```

Unauthorized: **401**. Forbidden (wrong role): **403**.

```json
{ "message": "You do not have permission to access this resource" }
```

---

## Endpoints

### Health

#### `GET /`

Not under `/api/v1` — root of the server.

**Response `200`**

```json
{ "name": "BetaWork API", "version": "1.0.0" }
```

---

### Auth

#### `POST /auth/validate`

Validate user details before registration.

**Auth:** Public  
**Content-Type:** `application/json`

**Body**

| Field       | Type   | Required | Notes        |
| ----------- | ------ | -------- | ------------ |
| firstName   | string | yes      | 1–100        |
| lastName    | string | yes      | 1–100        |
| email       | string | yes      | unique       |
| phoneNumber | string | yes      | 7–30, unique |
| city        | string | no       |              |
| state       | string | no       |              |
| address     | string | no       |              |

**Response `200`**

```json
{
  "message": "User information is valid",
  "data": {
    "firstName": "Ada",
    "lastName": "Okeke",
    "email": "ada@example.com",
    "phoneNumber": "+2348012345678",
    "city": "Lagos",
    "state": "Lagos",
    "address": "12 Example Street"
  }
}
```

---

#### `POST /auth/validate/identity`

Validate artisan NIN/BVN (format + uniqueness stub) and upload photo.

**Auth:** Public  
**Content-Type:** `multipart/form-data`

| Field | Type   | Required | Notes                      |
| ----- | ------ | -------- | -------------------------- |
| nin   | string | yes      | 11 digits, unique          |
| bvn   | string | yes      | 11 digits, unique          |
| photo | file   | yes      | jpg/jpeg/png/webp, max 5MB |

**Response `200`**

```json
{
  "message": "NIN, BVN and photo are valid",
  "verified": true,
  "data": {
    "nin": "12345678901",
    "bvn": "12345678901",
    "photoUrl": "/api/v1/uploads/artisans/clx....jpg"
  }
}
```

---

#### `POST /auth/otp/send`

Send an email OTP (signup / artisan onboarding). The 6-digit code is emailed
(SMTP) and cached for 10 minutes. **Outside production** the `otp` is also
returned in the response to ease development; in production the `otp` field is
omitted.

**Auth:** Public  
**Content-Type:** `application/json`

```json
{ "email": "ada@example.com" }
```

**Response `200`**

```json
{
  "message": "OTP sent successfully",
  "email": "ada@example.com",
  "otp": "483920"
}
```

OTP expires in **10 minutes**.

---

#### `POST /auth/otp/verify`

Verify an email OTP.

**Auth:** Public  
**Content-Type:** `application/json`

```json
{
  "email": "ada@example.com",
  "otp": "483920"
}
```

**Response `200`**

```json
{
  "message": "Email verified successfully",
  "email": "ada@example.com",
  "verified": true
}
```

**Response `422`** — invalid/expired OTP

```json
{ "message": "Invalid or expired OTP" }
```

---

#### `POST /auth/password/forgot`

Start a password reset. **Always** returns `200` with the same message whether
or not an account exists (anti-enumeration). A reset code is generated, cached
for 10 minutes under a reset-only namespace, and emailed **only when the account
exists**. Outside production the `otp` is included in the response for accounts
that exist.

**Auth:** Public  
**Content-Type:** `application/json`

```json
{ "email": "ada@example.com" }
```

**Response `200`**

```json
{
  "message": "If an account exists for that email, a reset code has been sent",
  "otp": "614238"
}
```

For an unknown email the response is identical but omits `otp`.

---

#### `POST /auth/password/verify-otp`

Check a reset code **without consuming it** (optional UX step before showing the
new-password form).

**Auth:** Public  
**Content-Type:** `application/json`

```json
{
  "email": "ada@example.com",
  "otp": "614238"
}
```

**Response `200`**

```json
{
  "message": "OTP verified successfully",
  "verified": true
}
```

**Response `422`** — invalid/expired OTP

```json
{ "message": "Invalid or expired OTP" }
```

---

#### `POST /auth/password/reset`

Set a new password using the reset code. On success the code is consumed and the
user's existing access tokens are revoked.

**Auth:** Public  
**Content-Type:** `application/json`

```json
{
  "email": "ada@example.com",
  "otp": "614238",
  "password": "new-strong-password"
}
```

**Response `200`**

```json
{ "message": "Password reset successfully" }
```

**Response `422`** — invalid/expired OTP or validation failure (`password` must be
8–72 characters)

```json
{ "message": "Invalid or expired OTP" }
```

---

#### `POST /auth/register`

Register a user or artisan. Returns access token.

**Auth:** Public

- Regular user: `application/json` is fine
- Artisan: use `multipart/form-data` (required for `photo`)

**Body (user)**

| Field       | Type                    | Required            |
| ----------- | ----------------------- | ------------------- |
| firstName   | string                  | yes                 |
| lastName    | string                  | yes                 |
| email       | string                  | yes                 |
| phoneNumber | string                  | yes                 |
| password    | string                  | yes (min 8)         |
| city        | string                  | no                  |
| state       | string                  | no                  |
| address     | string                  | no                  |
| role        | `"user"` \| `"artisan"` | no (default `user`) |

**Extra for artisan (`role: "artisan"`)**

| Field                                   | Type   | Required | Notes                      |
| --------------------------------------- | ------ | -------- | -------------------------- |
| photo                                   | file   | yes      | multipart only             |
| artisanProfile[trade]                   | string | yes      |                            |
| artisanProfile[nin]                     | string | yes      | 11 digits                  |
| artisanProfile[bvn]                     | string | yes      | 11 digits                  |
| artisanProfile[businessName]            | string | no       |                            |
| artisanProfile[bio]                     | string | no       |                            |
| artisanProfile[yearsOfExperience]       | number | no       |                            |
| artisanProfile[city]                    | string | no       |                            |
| artisanProfile[state]                   | string | no       |                            |
| artisanProfile[address]                 | string | no       |                            |
| artisanProfile[serviceRadiusKm]         | number | no       |                            |
| artisanProfile[verificationDocumentUrl] | string | no       | URL                        |
| artisanProfile[guarantor][fullName]     | string | no*      | required if guarantor sent |
| artisanProfile[guarantor][email]        | string | no*      |                            |
| artisanProfile[guarantor][phoneNumber]  | string | no*      |                            |
| artisanProfile[guarantor][city]         | string | no*      |                            |
| artisanProfile[guarantor][state]        | string | no*      |                            |
| artisanProfile[guarantor][address]      | string | no*      |                            |

For JSON clients registering artisans, nested objects work when fields are sent as nested form keys, e.g. `artisanProfile[guarantor][fullName]`.

**Response `201`**

```json
{
  "type": "bearer",
  "value": "oat_....",
  "expiresAt": "2026-09-15T12:00:00.000+00:00",
  "user": {
    "id": 1,
    "firstName": "Ada",
    "lastName": "Okeke",
    "email": "ada@example.com",
    "phoneNumber": "+2348012345678",
    "city": "Lagos",
    "state": "Lagos",
    "address": "12 Example Street",
    "role": "artisan",
    "createdAt": "...",
    "updatedAt": "...",
    "artisanProfile": {
      "id": 1,
      "userId": 1,
      "trade": "Plumber",
      "photoUrl": "/api/v1/uploads/artisans/....jpg",
      "nin": "12345678901",
      "verificationStatus": "pending",
      "guarantorFullName": "John Doe",
      "guarantorEmail": "john@example.com",
      "guarantorPhoneNumber": "+2348099999999",
      "guarantorCity": "Lagos",
      "guarantorState": "Lagos",
      "guarantorAddress": "1 Guarantor Rd"
    }
  }
}
```

Notes:

- `password` is never returned
- `bvn` is never returned on artisan profile

Store `value` and send it as `Authorization: Bearer <value>`.

---

#### `POST /auth/login`

**Auth:** Public  
**Content-Type:** `application/json`

```json
{
  "email": "ada@example.com",
  "password": "password123"
}
```

**Response `200`** — same token shape as register.

---

#### `POST /auth/logout`

**Auth:** Bearer token

**Response `200`**

```json
{ "message": "Logged out successfully" }
```

---

#### `GET /auth/me`

**Auth:** Bearer token

**Response `200`**

```json
{
  "user": { "...": "serialized user + artisanProfile if any" }
}
```

---

### Artisans (public)

#### `GET /artisans`

Search verified, available artisans.

**Auth:** Public

| Query | Type   | Default | Notes         |
| ----- | ------ | ------- | ------------- |
| page  | number | 1       |               |
| limit | number | 20      | max 50        |
| trade | string | —       | partial match |
| city  | string | —       | partial match |

**Response `200`** — Lucid pagination payload (`meta` + `data`).

---

#### `GET /artisans/:id`

Public artisan profile (approved only).

**Auth:** Public

**Response `200`**

```json
{ "artisanProfile": { "...": "..." } }
```

**Response `404`** if not found or not approved.

---

#### `GET /uploads/artisans/:fileName`

Download/view artisan photo.

**Auth:** Public  
**Response:** binary image file

Use the path from `photoUrl` as-is (relative to host), e.g.:

`http://localhost:3333/api/v1/uploads/artisans/clx123.jpg`

---

### Artisan (authenticated)

#### `GET /artisan/profile`

Own artisan profile.

**Auth:** Bearer + role `artisan`

**Response `200`**

```json
{ "artisanProfile": { "...": "..." } }
```

---

#### `PUT /artisan/profile`

Update own artisan profile. Supports optional photo replace.

**Auth:** Bearer + role `artisan`  
**Content-Type:** `multipart/form-data` (if uploading photo) or `application/json`

All fields optional:

| Field                   | Type           |
| ----------------------- | -------------- |
| trade                   | string         |
| businessName            | string \| null |
| bio                     | string \| null |
| yearsOfExperience       | number         |
| city                    | string \| null |
| state                   | string \| null |
| address                 | string \| null |
| serviceRadiusKm         | number \| null |
| isAvailable             | boolean        |
| nin                     | string         |
| bvn                     | string         |
| verificationDocumentUrl | string \| null |
| guarantorFullName       | string \| null |
| guarantorEmail          | string \| null |
| guarantorPhoneNumber    | string \| null |
| guarantorCity           | string \| null |
| guarantorState          | string \| null |
| guarantorAddress        | string \| null |
| photo                   | file           | optional replacement |

**Response `200`**

```json
{ "artisanProfile": { "...": "..." } }
```

---

### Admin

All require **Bearer + role `admin`**.

#### `GET /admin/users`

| Query | Notes                                    |
| ----- | ---------------------------------------- |
| page  | default 1                                |
| limit | default 20, max 100                      |
| role  | optional: `user` \| `artisan` \| `admin` |

---

#### `GET /admin/users/:id`

**Response `200`**

```json
{ "user": { "...": "..." } }
```

---

#### `PATCH /admin/users/:id/role`

```json
{ "role": "artisan" }
```

`role` must be `user` | `artisan` | `admin`.

---

#### `GET /admin/artisans`

| Query              | Notes                                 |
| ------------------ | ------------------------------------- |
| page               |                                       |
| limit              |                                       |
| verificationStatus | `pending` \| `approved` \| `rejected` |

---

#### `PATCH /admin/artisans/:id/verification`

```json
{
  "verificationStatus": "approved",
  "verificationNotes": "Documents look good"
}
```

---

## Enums

### `role`

- `user`
- `artisan`
- `admin`

### `verificationStatus`

- `pending`
- `approved`
- `rejected`

---

## OpenAPI

Machine-readable spec: [`openapi.yaml`](./openapi.yaml)

Import into Swagger UI, Postman, Insomnia, or generate API clients for the mobile/web UI.
