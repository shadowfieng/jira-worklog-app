# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build for production with Turbopack
- `pnpm start` - Start production server
- `pnpm lint` - Run Biome linter and check code quality
- `pnpm format` - Format code with Biome

### Environment Setup
- No environment variables required - authentication is handled through the login interface

## Architecture Overview

### API Proxy Architecture
- Frontend makes requests to Next.js API routes (`/api/jira/*`)
- API routes proxy requests to JIRA REST API with authentication
- Credentials are stored server-side only (not exposed to client)
- Solves CORS issues when calling JIRA API directly from browser

### Authentication Flow
- Users authenticate through the login interface with email and API token
- Credentials are stored in secure HTTP-only cookies
- API token can be generated from Atlassian Account Settings > Security > API tokens

### Core Components

#### JIRA API Service (`src/lib/jira-api.ts`)
- `JiraAPIService` class handles communication with Next.js API routes
- Key methods:
  - `getWorklogs()` - Fetch worklogs with filtering (date range, issue, project, author)
  - `getCurrentUser()` - Get authenticated user info
  - `getProjects()` - List accessible projects
  - `createWorklog()`, `updateWorklog()`, `deleteWorklog()` - Worklog CRUD operations
- Makes requests to `/api/jira/*` endpoints instead of direct JIRA API calls
- Returns structured data with TypeScript interfaces: `JiraWorklog`, `JiraIssue`

#### API Routes (`src/app/api/jira/`)
- Next.js API routes that proxy requests to JIRA REST API
- Available endpoints:
  - `/api/jira/search` - Search issues with JQL (uses JIRA REST API v3 `/search/jql` endpoint)
  - `/api/jira/issue/[issueKey]/worklog` - Get/create worklogs for issues
  - `/api/jira/issue/[issueKey]/worklog/[worklogId]` - Update/delete specific worklogs
  - `/api/jira/myself` - Get current user info
  - `/api/jira/project` - Get accessible projects
  - `/api/jira/site-info` - Get JIRA site URL for frontend links
- Handle authentication with credentials from secure cookies
- Provide error handling and CORS-free access
- Search endpoint migrated to use `/rest/api/3/search/jql` from deprecated `/rest/api/3/search`

#### Dashboard (`src/app/dashboard/page.tsx`)
- Main application interface using API proxy routes
- Features:
  - Worklog filtering by date range and issue key
  - Summary statistics (total worklogs, time logged, unique issues)
  - Paginated worklog list with issue details and direct JIRA links
  - Real-time search and filtering
- Uses React hooks for state management

### Data Flow
1. Dashboard initializes JiraAPIService (no credentials needed on client)
2. Service makes requests to Next.js API routes (`/api/jira/*`)
3. API routes authenticate with JIRA using credentials from secure cookies
4. API routes construct JQL queries and fetch data from JIRA REST API
5. Data is proxied back through API routes to the frontend
6. Frontend processes and displays the worklog data

### TypeScript Configuration
- Path aliases: `@/*` maps to `./src/*`
- Strict mode enabled with modern ES2017+ target
- Next.js plugin integration for optimized bundling

### Code Quality
- Biome for linting and formatting (replaces ESLint/Prettier)
- Configuration in `biome.json` with React/Next.js specific rules
- Tailwind CSS for styling with PostCSS processing
- SpellCheck is configured but "worklog" terminology triggers false positives

### File Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/jira/          # API proxy routes for JIRA
│   ├── dashboard/         # Main dashboard page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page (redirects to dashboard)
└── lib/
    └── jira-api.ts       # JIRA API service layer (client-side)
```

### Development Notes
- Application expects JIRA Cloud instances (not Server/Data Center)
- API tokens must be generated from Atlassian Account Settings > Security > API tokens
- Credentials are stored in secure HTTP-only cookies for security
- API proxy routes solve CORS issues and protect credentials
- Search endpoint uses JIRA REST API v3 `/search/jql` endpoint (migrated from deprecated `/search`)
- Error handling includes specific messages for common JIRA access issues
- The `jira-api-examples.js` file contains additional API examples using basic auth
- Authentication is handled through the login interface, no environment variables needed