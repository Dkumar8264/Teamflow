# TeamFlow API Specification

This file uses the long handoff name from the project organization guide. The same API contract is also available in `API_SPEC.md`.

Base URL for local development:

```text
http://localhost:5000/api
```

## Response Shape

Success responses:

```json
{
  "success": true,
  "data": {}
}
```

Error responses:

```json
{
  "success": false,
  "message": "Error message"
}
```

## Authentication

### POST `/auth/signup`

Creates a new user account.

Request:

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "success": true,
  "user": {},
  "token": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

### POST `/auth/login`

Logs in an existing user.

Request:

```json
{
  "email": "ada@example.com",
  "password": "password123"
}
```

### POST `/auth/refresh-token`

Issues a new token pair.

Request:

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

### GET `/auth/me`

Returns the authenticated user.

Headers:

```text
Authorization: Bearer <token>
```

## Users

### GET `/users/me`

Returns the current user's profile.

### PATCH `/users/me`

Updates the current user's profile.

### PATCH `/users/me/password`

Changes the current user's password.

## Workspaces

### GET `/workspaces`

Lists workspaces the authenticated user belongs to.

### POST `/workspaces`

Creates a workspace.

### GET `/workspaces/:workspaceId`

Returns one workspace.

### PATCH `/workspaces/:workspaceId`

Updates a workspace.

### DELETE `/workspaces/:workspaceId`

Deletes a workspace.

### POST `/workspaces/:workspaceId/members`

Adds a member to a workspace.

### PATCH `/workspaces/:workspaceId/members/:userId`

Updates a member role.

### DELETE `/workspaces/:workspaceId/members/:userId`

Removes a member.

## Projects

### GET `/workspaces/:workspaceId/projects`

Lists projects in a workspace.

### POST `/workspaces/:workspaceId/projects`

Creates a project.

### GET `/projects/:projectId`

Returns one project.

### PATCH `/projects/:projectId`

Updates a project.

### DELETE `/projects/:projectId`

Deletes a project.

## Tasks

### GET `/projects/:projectId/tasks`

Lists tasks in a project.

Query parameters:

```text
status
priority
assignee
search
dueBefore
dueAfter
```

### POST `/projects/:projectId/tasks`

Creates a task.

### GET `/tasks/:taskId`

Returns one task.

### PATCH `/tasks/:taskId`

Updates a task.

### DELETE `/tasks/:taskId`

Deletes a task.

### PATCH `/tasks/:taskId/status`

Updates task status.

### PATCH `/tasks/:taskId/assign`

Assigns or unassigns a task.

## Comments

### GET `/tasks/:taskId/comments`

Lists comments for a task.

### POST `/tasks/:taskId/comments`

Creates a task comment.

### PATCH `/comments/:commentId`

Updates a comment.

### DELETE `/comments/:commentId`

Deletes a comment.

## Notifications

### GET `/notifications`

Lists current user notifications.

### PATCH `/notifications/:notificationId/read`

Marks one notification as read.

### PATCH `/notifications/read-all`

Marks all current user notifications as read.

