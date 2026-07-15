# TeamFlow Database Schema

MongoDB database name:

```text
teamflow
```

## users

Stores account and profile data.

```js
{
  _id: ObjectId,
  name: String,
  email: String,
  password: String,
  avatarUrl: String,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

- `email` unique

## workspaces

Stores team spaces.

```js
{
  _id: ObjectId,
  name: String,
  description: String,
  owner: ObjectId,
  members: [
    {
      user: ObjectId,
      role: "owner" | "admin" | "member",
      joinedAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

- `owner`
- `members.user`

## projects

Stores projects inside workspaces.

```js
{
  _id: ObjectId,
  workspace: ObjectId,
  name: String,
  description: String,
  status: "active" | "paused" | "completed" | "archived",
  startDate: Date,
  dueDate: Date,
  members: [ObjectId],
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

- `workspace`
- `createdBy`
- `members`

## tasks

Stores project tasks.

```js
{
  _id: ObjectId,
  project: ObjectId,
  workspace: ObjectId,
  title: String,
  description: String,
  status: "todo" | "in_progress" | "review" | "done",
  priority: "low" | "medium" | "high" | "urgent",
  assignee: ObjectId,
  createdBy: ObjectId,
  dueDate: Date,
  labels: [String],
  position: Number,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

- `project`
- `workspace`
- `assignee`
- `status`
- `dueDate`

## comments

Stores task discussion.

```js
{
  _id: ObjectId,
  task: ObjectId,
  author: ObjectId,
  body: String,
  editedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

- `task`
- `author`

## notifications

Stores user notifications.

```js
{
  _id: ObjectId,
  recipient: ObjectId,
  type: "task_assigned" | "task_updated" | "comment_added" | "mention",
  title: String,
  message: String,
  read: Boolean,
  entityType: "workspace" | "project" | "task" | "comment",
  entityId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

- `recipient`
- `read`
- `createdAt`

## Token Storage

Phase 1 uses stateless JWT refresh tokens. If logout, token rotation, or compromised-token revocation is required later, add a `refresh_tokens` collection with hashed token IDs, user reference, expiry, and revoked status.

