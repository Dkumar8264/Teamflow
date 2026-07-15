# TeamFlow Build Prompts

Use this document when asking AI to build or improve one phase of TeamFlow. Keep each request scoped to one phase or one module, then test locally before moving on.

## Phase Build Prompt Template

```markdown
# [PHASE X] - [Feature Name]

## Context
This is Phase X of TeamFlow project management app.
Previous phases completed: [list]

## What to Build
[Specific list of files/features]

## Specifications

### Database
[Relevant schemas]

### API Endpoints
[Relevant endpoints]

### Dependencies
[npm packages needed]

## Instructions for AI

1. Generate folder structure
2. Create all files with:
   - Proper imports
   - Error handling
   - Input validation
   - Comments explaining logic
   - Async/await patterns
   - Try-catch blocks

3. Include:
   - package.json with all dependencies
   - .env.example with required variables
   - README with setup instructions
   - Example usage/testing

4. Follow:
   - REST API conventions
   - Mongoose best practices
   - JWT authentication pattern
   - Error response format (consistent)

## Files to Generate
- backend/src/...
- [List all files]

## Testing
How to test this phase:
[Specific testing instructions]
```

## Scenario A: Generate Complete Module

```markdown
# Generate Backend Authentication Module

## Requirements
- User registration with email validation
- User login with JWT
- Refresh token mechanism
- Password reset via email
- 2FA optional

## Database Schema
[Paste User schema]

## API Endpoints
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/refresh-token
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/me

## Technologies
- Express.js
- MongoDB + Mongoose
- JWT (jsonwebtoken)
- bcrypt for passwords
- Nodemailer for emails

## Constraints
- Password must be 8+ chars, 1 uppercase, 1 number
- JWT expires in 7 days
- Refresh token expires in 30 days
- Email validation required
- Rate limit: 5 attempts per 15 minutes

## Generate
1. All necessary files
2. Models, controllers, routes, middleware
3. Error handling
4. Input validation using Joi
5. Complete .env.example
6. Setup instructions

Format as: Ready-to-use production code
```

## Scenario B: Fix or Improve Existing Code

```markdown
# Improve Task Management API

## Current Issue
[Describe the problem]

## Reference
Here's the current implementation:
[Paste code]

## What to Improve
1. Performance: Add proper indexing
2. Validation: Strengthen input validation
3. Error handling: Better error messages
4. Documentation: Add JSDoc comments
5. Security: Add rate limiting

## Specifications
[Relevant API endpoint spec]

## Generate
- Improved version with explanations
- What changed and why
- Performance improvements made
```

## Scenario C: Generate Frontend Component

```markdown
# Generate Kanban Board Component

## Context
Building real-time project management UI with React + Redux

## Features Required
- Display tasks in 3 columns: Backlog -> In Progress -> Done
- Drag-drop tasks between columns
- Update task status in real-time
- Show task priority colors
- Click task to open details modal
- Live updates via WebSocket

## Data Structure
[Paste Redux task slice]
[Paste API endpoint spec]

## Dependencies
- react-beautiful-dnd (drag-drop)
- redux-toolkit (state)
- socket.io-client (real-time)
- tailwind CSS

## Requirements
- Optimistic updates (show change immediately)
- Loading states
- Error boundaries
- Responsive design
- Keyboard accessibility

## Generate
1. KanbanBoard.jsx (main component)
2. KanbanColumn.jsx (column component)
3. TaskCard.jsx (task card)
4. Custom hooks (useTask, useSocket)
5. CSS modules
6. PropTypes validation
```

## Recommended Workflow

1. Copy the phase build prompt template.
2. Fill in the phase number, previous phases, exact files, schemas, and endpoints.
3. Ask AI to generate only one module at a time when the phase is large.
4. Review the generated code before adding the next module.
5. Run local tests and API checks before moving to the next phase.

