# TeamFlow Architecture

## Overview

TeamFlow uses a standard MERN architecture with a React frontend calling a REST API served by Express. MongoDB Atlas stores application data, and Mongoose provides schema definitions, validation, and model relationships.

## High-Level System

```text
React Client
  |
  | HTTPS / JSON REST API
  v
Express API Server
  |
  | Mongoose
  v
MongoDB Atlas
```

## Core Components

### Frontend

- React single-page application.
- Handles routing, forms, dashboards, task boards, and project views.
- Stores short-lived client auth state and sends JWT access tokens in the `Authorization` header.

### Backend

- Express API server.
- Owns authentication, validation, authorization, business logic, and database access.
- Exposes versioned REST endpoints under `/api`.
- Uses centralized error handling for consistent API responses.

### Database

- MongoDB Atlas free tier.
- Mongoose models for users, workspaces, projects, tasks, comments, and notifications.
- ObjectId references connect documents across collections.

## Authentication Design

- Users sign up and log in with email and password.
- Passwords are hashed with bcrypt before storage.
- API issues JWT access tokens with a 7 day expiry.
- Refresh token endpoint reissues auth tokens from a valid refresh token.
- Protected routes use `Authorization: Bearer <token>`.

## Authorization Model

- A user belongs to one or more workspaces.
- Workspace membership controls access to projects and tasks.
- Roles can start with `owner`, `admin`, and `member`.
- Resource ownership and membership checks should happen in route middleware or service-layer helpers.

## Request Flow

```text
Client request
  -> Express route
  -> auth middleware when required
  -> controller
  -> Mongoose model
  -> MongoDB Atlas
  -> normalized JSON response
```

## Error Handling

The backend returns a consistent error response:

```json
{
  "success": false,
  "message": "Error message"
}
```

Development mode may include a stack trace. Production mode should not expose stack traces.

## Deployment Target

- Frontend: Vercel, Netlify, or similar static hosting.
- Backend: Render, Railway, Fly.io, or similar Node.js hosting.
- Database: MongoDB Atlas.
- Environment variables should be managed per deployment environment.

