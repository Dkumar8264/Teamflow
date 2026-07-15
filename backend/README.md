# TeamFlow Backend

Express and MongoDB backend for TeamFlow authentication.

## Folder Structure

```text
backend/
  .env.example
  package.json
  server.js
  src/
    config/
      database.js
    controllers/
      authController.js
    middleware/
      auth.js
      errorHandler.js
    models/
      User.js
    routes/
      auth.js
    utils/
      AppError.js
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env
```

3. Add your MongoDB Atlas connection string and JWT secrets to `.env`:

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/teamflow?retryWrites=true&w=majority
JWT_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<another-long-random-secret>
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=7d
```

4. Start the development server:

```bash
npm run dev
```

The API runs on `http://localhost:5000` by default.

## Auth Endpoints

### Sign Up

`POST /api/auth/signup`

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "password123"
}
```

### Login

`POST /api/auth/login`

```json
{
  "email": "ada@example.com",
  "password": "password123"
}
```

### Refresh Token

`POST /api/auth/refresh-token`

```json
{
  "refreshToken": "<refresh-token>"
}
```

### Current User

`GET /api/auth/me`

Send the access token in the header:

```text
Authorization: Bearer <token>
```
