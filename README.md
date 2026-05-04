# Visitour API

Backend API for Visitour clients (web and mobile apps).

## API Documentation

- Full reference: `docs/API_DOCS.md`

## Base URL

```text
http://localhost:3000/api
```

## Main API Areas

- Authentication (`/auth/register`, `/auth/login`)
- Itineraries (`/itineraries`)
- Entries (`/entries`)
- Real-time updates (Socket.io events)

## Notes

- This repository keeps API-focused documentation only.
- Client apps should use `docs/API_DOCS.md` as the source of truth for request/response contracts.

## Railway Deployment

- This repository includes `railway.json` and `apps/api/Dockerfile` for API deployment.
- In Railway, create one service from this repo and ensure it uses the repo root.

Required Railway environment variables:

```text
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://...
DB_SCHEMA=visitour_dev
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
JWT_SECRET=replace-with-secure-random-value
CORS_ORIGIN=https://your-web-domain.com,capacitor://localhost
```

Health check endpoint:

```text
/api/health
```

