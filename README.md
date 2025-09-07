# JIRA Worklog Tracker

A Next.js application for tracking and managing JIRA worklogs with advanced search and filtering capabilities. This application connects directly to your JIRA Cloud instance using basic authentication.

## Features

- View and search your JIRA worklogs
- Filter by date range and issue key
- Summary statistics (total worklogs, time logged, unique issues)
- Direct links to JIRA issues
- Real-time search and filtering

## Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- JIRA Cloud instance
- JIRA API token

## Setup

1. **Clone and install dependencies:**
   ```bash
   pnpm install
   ```

2. **Generate a JIRA API token:**
   - Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Click "Create API token"
   - Save the token - you'll need it when logging into the application

## Development

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser. You'll be prompted to log in with your JIRA email and API token.

## Available Scripts

- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build for production with Turbopack
- `pnpm start` - Start production server
- `pnpm lint` - Run Biome linter
- `pnpm format` - Format code with Biome

## Architecture

- **Frontend**: Next.js 15 with React 19
- **Backend**: Next.js API routes as JIRA proxy
- **Styling**: Tailwind CSS
- **Authentication**: JIRA Basic Authentication with secure HTTP-only cookies
- **API Client**: Axios for HTTP requests
- **Code Quality**: Biome for linting and formatting

## API Reference

The application uses JIRA REST API v3. Key endpoints:
- `/rest/api/3/search/jql` - Search for issues with JQL (GET method with query parameters)
- `/rest/api/3/issue/{issueKey}/worklog` - Get worklogs for specific issues
- `/rest/api/3/myself` - Get current user information

**Note**: The search endpoint has been migrated from the deprecated `/rest/api/3/search` to `/rest/api/3/search/jql` as required by Atlassian's API changes.

## Troubleshooting

**Common Issues:**

1. **"Failed to fetch worklogs"** - Verify your API token and email are correct in the login form
2. **"No worklogs found"** - Check your date range and ensure you have logged work in JIRA
3. **Login issues** - Make sure your JIRA API token is active and has the correct permissions

## Security

- API credentials are stored in secure HTTP-only cookies (not exposed to client)
- All API calls use HTTPS
- Credentials are never stored in client-side code
- Next.js API routes act as a secure proxy to JIRA API
