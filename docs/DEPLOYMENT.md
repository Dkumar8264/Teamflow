# Deployment Guide

## Targets

- Frontend: Vercel, Netlify, or another static hosting provider.
- Backend: Render, Railway, Fly.io, or another Node.js hosting provider.
- Database: MongoDB Atlas.

## Backend Environment Variables

```env
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/teamflow?retryWrites=true&w=majority
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=<another-long-random-secret>
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=https://your-frontend-domain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourgmail@gmail.com
SMTP_PASS=your-16-character-app-password
MAIL_FROM=TeamFlow <yourgmail@gmail.com>
```

## Backend Deployment Checklist

- Install dependencies with `npm install`.
- Set all production environment variables in the hosting dashboard.
- Confirm MongoDB Atlas network access allows the host.
- Start the server with `npm start`.
- Verify `GET /health` returns a success response.

## Frontend Deployment Checklist

- Deploy the backend first and verify `https://your-backend-domain.com/health`.
- In Vercel frontend project settings, set `VITE_API_URL` to the deployed backend API URL.
- Example: `VITE_API_URL=https://your-backend-domain.com/api`.
- Build with `npm run build`.
- Verify auth pages can call the backend API.
- Confirm protected routes redirect correctly.

## Vercel Frontend Settings

If the frontend is deployed on Vercel, add this environment variable in:

Project Settings -> Environment Variables

```env
VITE_API_URL=https://your-backend-domain.com/api
```

After changing `VITE_API_URL`, redeploy the frontend. Vite reads this value only at build time.

Also update the backend `CLIENT_URL` to your Vercel frontend URL:

```env
CLIENT_URL=https://your-vercel-app.vercel.app
```
