# Troubleshooting

## Backend Does Not Start

Check that `backend/.env` exists and includes:

```env
MONGO_URI=
JWT_SECRET=
JWT_REFRESH_SECRET=
```

The server validates these variables on startup.

## MongoDB Connection Fails

- Confirm the MongoDB Atlas connection string is correct.
- Confirm the database user password is URL encoded if it contains special characters.
- Confirm your IP address is allowed in MongoDB Atlas Network Access.
- Confirm the cluster is running.

## Auth Requests Return 401

- Make sure the `Authorization` header uses `Bearer <token>`.
- Make sure you are using the access token for protected routes.
- Make sure you are using the refresh token only with `/api/auth/refresh-token`.

## CORS Errors

Set `CLIENT_URL` in `backend/.env` to the frontend origin.

Example:

```env
CLIENT_URL=http://localhost:5173
```

For multiple allowed origins, separate them with commas.

## npm Audit Warnings

Run:

```bash
cd backend
npm audit
```

Review changes before running `npm audit fix`, because it may update dependency versions.

