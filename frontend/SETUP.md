# Frontend Setup

The frontend will be a React app built with Vite.

## Create the App

From the repository root:

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

## Recommended Dependencies

```bash
npm install axios react-router-dom
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

- Create routes for login, signup, and dashboard.
- Add an Axios API client with `VITE_API_URL`.
- Store auth token after login/signup.
- Add a protected route wrapper.
- Connect auth forms to the backend endpoints.

