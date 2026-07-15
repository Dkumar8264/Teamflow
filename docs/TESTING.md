# Testing Guide

## Phase 1 Backend Checks

Run syntax checks:

```bash
cd backend
npm run check
```

Start the backend:

```bash
npm run dev
```

Health check:

```text
GET http://localhost:5000/health
```

## Authentication API Tests

### Signup

```text
POST http://localhost:5000/api/auth/signup
```

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "password123"
}
```

### Login

```text
POST http://localhost:5000/api/auth/login
```

```json
{
  "email": "ada@example.com",
  "password": "password123"
}
```

### Refresh Token

```text
POST http://localhost:5000/api/auth/refresh-token
```

```json
{
  "refreshToken": "<refresh-token>"
}
```

### Current User

```text
GET http://localhost:5000/api/auth/me
Authorization: Bearer <token>
```

## Regression Checklist

- Invalid signup payload returns `400`.
- Duplicate email returns `409`.
- Invalid login returns `401`.
- Missing bearer token returns `401`.
- Invalid refresh token returns `401`.

