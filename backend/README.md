# TeamFlow Backend

Express and MongoDB backend for TeamFlow authentication, projects, tasks, and invitation emails.

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
      projectController.js
      taskController.js
    middleware/
      auth.js
      errorHandler.js
    models/
      Invitation.js
      Project.js
      Task.js
      User.js
    routes/
      auth.js
      invitations.js
      projects.js
      tasks.js
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

## Scripts

- `npm run dev` - start the API with nodemon.
- `npm start` - start the API with Node.
- `npm run check` - syntax-check `server.js`.
- `npm run test:email -- teammate@example.com` - verify SMTP and send a TeamFlow invitation test email.

## Invitation Email

TeamFlow uses SMTP through Nodemailer. Without SMTP values, invitation requests return an email preview instead of sending.
The invitation email includes the first URL from `CLIENT_URL` as the TeamFlow website link.

For Gmail, enable 2-step verification, create an app password, then set:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourgmail@gmail.com
SMTP_PASS=your-16-character-app-password
MAIL_FROM=TeamFlow <yourgmail@gmail.com>
```

After saving `.env`, restart `npm run dev` and test with:

```bash
npm run test:email -- teammate@example.com
```

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
