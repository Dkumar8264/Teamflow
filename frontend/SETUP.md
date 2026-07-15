# Frontend Setup

The frontend will be a React app built with Vite, React Router, Axios, and Tailwind CSS.

## Install Dependencies

From the frontend folder:

```bash
cd frontend
npm install
```

## Environment

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

## Run Locally

```bash
npm run dev
```

The Vite dev server usually runs at:

```text
http://localhost:5173
```

## First Frontend Tasks

- Add `index.html`, `src/main.jsx`, and `src/App.jsx`.
- Create routes for login, signup, and dashboard.
- Add an Axios API client with `VITE_API_URL`.
- Store auth token after login/signup.
- Add a protected route wrapper.
- Connect auth forms to the backend endpoints.
