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
```

## Backend Deployment Checklist

- Install dependencies with `npm install`.
- Set all production environment variables in the hosting dashboard.
- Confirm MongoDB Atlas network access allows the host.
- Start the server with `npm start`.
- Verify `GET /health` returns a success response.

## Frontend Deployment Checklist

- Set `VITE_API_URL` to the deployed backend API URL.
- Build with `npm run build`.
- Verify auth pages can call the backend API.
- Confirm protected routes redirect correctly.

