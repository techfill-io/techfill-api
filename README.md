

# TechFill API - NestJS Backend

Backend API for TechFill - Intent-based tech talent matching platform.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

### Environment Variables

Create `.env` file:

```bash
# Server
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# JWT
JWT_SECRET=your-jwt-secret-change-this
JWT_EXPIRES_IN=1h

# CORS
CORS_ORIGIN=http://localhost:3000
```

## Project Structure (After Setup)

```
techfill-api/
├── src/
│   ├── auth/                   # Authentication module
│   ├── users/                  # User management
│   ├── candidates/             # Candidate profiles
│   ├── companies/              # Company profiles
│   ├── jobs/                   # Job listings
│   ├── applications/           # Application flow
│   ├── storage/                # File storage (CVs, logos)
│   ├── admin/                  # Admin endpoints
│   ├── common/                 # Shared utilities
│   ├── database/               # Supabase client
│   ├── app.module.ts
│   └── main.ts
├── supabase/
│   └── migrations/             # Database migrations
├── test/
├── .env
├── .env.example
└── package.json
```

## API Endpoints (MVP)

### Auth
- `POST /api/auth/signup/candidate` - Candidate signup
- `POST /api/auth/signup/company` - Company signup
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Jobs (Public)
- `GET /api/jobs` - List all active jobs
- `GET /api/jobs/:id` - Get job details

### Jobs (Protected - Company)
- `POST /api/jobs` - Create job
- `PUT /api/jobs/:id` - Update job
- `PATCH /api/jobs/:id/status` - Change job status
- `DELETE /api/jobs/:id` - Delete job

### Applications (Protected - Candidate)
- `POST /api/jobs/:id/apply` - Apply to job
- `GET /api/applications` - Get own applications
- `DELETE /api/applications/:id` - Withdraw application

### Applications (Protected - Company)
- `GET /api/jobs/:id/applications` - Get job applicants
- `PATCH /api/applications/:id/status` - Update application status

### Candidates (Protected)
- `GET /api/candidates/profile` - Get own profile
- `PUT /api/candidates/profile` - Update profile
- `PATCH /api/candidates/visibility` - Toggle visibility
- `POST /api/candidates/cv` - Upload CV

### Companies (Protected)
- `GET /api/companies/profile` - Get own profile
- `PUT /api/companies/profile` - Update profile

### Admin (Protected - Admin only)
- `GET /api/admin/users` - List users
- `GET /api/admin/companies` - List companies
- `PATCH /api/admin/companies/:id/approve` - Approve company
- `DELETE /api/admin/jobs/:id` - Delete job

## Related Repositories

- **Frontend**: `../techfill-web` (Next.js)
- **Documentation**: `../techfill-web/docs/`

## Next Steps

1. Follow the [Backend Setup Guide](../techfill-web/docs/BACKEND-SETUP.md)
2. Set up Supabase project
3. Run database migrations
4. Implement modules one by one
5. Test with frontend

## License

Proprietary - All rights reserved

