# Postgres (dev)

This folder contains the SQL schema + small scripts to apply it.

## 1) Set DATABASE_URL

Add to your root `.env`:

- `DATABASE_URL=postgres://postgres:postgres@localhost:5432/gig_connect`

Notes:
- The schema includes `users.password_hash` for local email/password auth.
- Emails are unique per role: the same email can exist in different roles, but not twice for the same role.

## 2) Apply schema

- `npm run db:migrate`

## 3) Seed sample data (optional)

- `npm run db:seed`

The app can later be updated to read services/categories from Postgres instead of in-memory data.
