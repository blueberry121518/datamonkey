# Data Monkey Backend

Express.js backend API for Data Monkey agentic marketplace, built with TypeScript and Supabase.

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files (Supabase, etc.)
│   ├── controllers/     # Request handlers
│   ├── routes/         # Route definitions
│   ├── services/       # Business logic
│   ├── types/          # TypeScript type definitions
│   ├── app.ts          # Express app setup
│   └── server.ts       # Server entry point
├── migrations/          # SQL migration files
├── example.env         # Environment variables template
└── package.json
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `example.env` to `.env` and fill in your values:

```bash
cp example.env .env
```

Required variables:
- `PORT` - Server port (default: 3001)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for direct DB access)
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `JWT_SECRET` - Secret key for JWT tokens (use a strong random string)

### 3. Run Database Migration

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the migration file: `migrations/001_create_users_table.sql`

This will create the `users` table with the necessary columns and indexes.

### 4. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3001` (or your configured PORT).

## API Endpoints

### Health Check
```
GET /health
```

### Authentication

#### Sign Up
```
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    },
    "token": "jwt-token"
  },
  "message": "User created successfully"
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    },
    "token": "jwt-token"
  },
  "message": "Login successful"
}
```

## Development

### Build

```bash
npm run build
```

### Production

```bash
npm start
```

## Architecture

- **Routes**: Define API endpoints and map them to controllers
- **Controllers**: Handle HTTP requests/responses and validation
- **Services**: Contain business logic and database operations
- **Config**: Configuration files (Supabase client, etc.)
- **Types**: TypeScript type definitions

## Security Notes

- Passwords are hashed using bcrypt (10 salt rounds)
- JWT tokens are used for authentication
- Service role key is used for direct database access (bypasses RLS)
- Input validation using Zod schemas
- CORS enabled for cross-origin requests

## Future Enhancements

- Email verification
- Password reset
- Refresh tokens
- Rate limiting
- Request logging
- API documentation (Swagger/OpenAPI)

