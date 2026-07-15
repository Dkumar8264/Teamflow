# TeamFlow

TeamFlow is a MERN stack project management tool for teams to manage workspaces, projects, tasks, assignments, comments, and status tracking.

## Tech Stack

- Frontend: React, Vite, React Router, Axios
- Backend: Node.js, Express.js
- Database: MongoDB Atlas with Mongoose
- Authentication: JWT access tokens and refresh tokens
- Security: bcrypt password hashing, protected routes, centralized error handling
- Development: nodemon, dotenv, CORS

## Repository Structure

```text
TeamFlow/
  README.md
  ARCHITECTURE.md
  PHASES.md
  API_SPEC.md
  API_SPECIFICATION.md
  DATABASE_SCHEMA.md
  BUILD_PROMPTS.md
  .env.example
  frontend/
    package.json
    tailwind.config.js
    folder-structure.txt
    SETUP.md
    src/
  backend/
    src/
    folder-structure.txt
    SETUP.md
  docs/
    DEPLOYMENT.md
    TESTING.md
    TROUBLESHOOTING.md
```

## Current Status

Phase 1 backend authentication has been scaffolded under `backend/` with MongoDB connection setup, user model, auth routes, JWT middleware, bcrypt password hashing, and error handling middleware.

## Local Development

Backend setup is documented in `backend/SETUP.md`.

Frontend setup is documented in `frontend/SETUP.md`.

Reusable AI build prompts are documented in `BUILD_PROMPTS.md`.

Deployment, testing, and troubleshooting notes are in the `docs/` folder.
