# Backend Setup

The backend is an Express API using MongoDB Atlas and JWT authentication.

## Install Dependencies

From the backend folder:

```bash
npm install
```

## Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/teamflow?retryWrites=true&w=majority
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=<another-long-random-secret>
JWT_REFRESH_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

## MongoDB Atlas

1. Create a free MongoDB Atlas cluster.
2. Create a database user.
3. Add your IP address to the network access allowlist.
4. Copy the Node.js connection string.
5. Replace the username, password, and cluster URL in `MONGO_URI`.

## Run Locally

Development:

```bash
npm run dev
```

Production-style local run:

```bash
npm start
```

## Health Check

```text
GET http://localhost:5000/health
```

Expected response:

```json
{
  "success": true,
  "message": "TeamFlow API is running"
}
```

