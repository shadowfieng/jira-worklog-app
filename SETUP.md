# JIRA Worklog Tracker Setup Guide

This application allows users to authenticate with JIRA via OAuth 2.0 and track their worklogs with advanced search and filtering capabilities.

## Prerequisites

- Node.js 18+ 
- pnpm (or npm/yarn)
- A JIRA Cloud instance with admin access to create OAuth apps

## Step 1: Create a JIRA OAuth App

1. Go to your Atlassian Developer Console: https://developer.atlassian.com/console/myapps/
2. Click "Create" → "OAuth 2.0 integration"
3. Fill in the app details:
   - App name: "JIRA Worklog Tracker"
   - Description: "Track and manage JIRA worklogs"
4. Add permissions:
   - **Jira API**: `read:jira-work`, `read:jira-user`
5. Configure OAuth 2.0 (3LO):
   - Callback URL: `http://localhost:3000/api/auth/callback/atlassian`
   - For production: `https://yourdomain.com/api/auth/callback/atlassian`
6. Note down your:
   - Client ID
   - Client Secret

## Step 2: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your values:
   ```env
   NEXTAUTH_SECRET=your-generated-secret-key
   NEXTAUTH_URL=http://localhost:3000

   JIRA_CLIENT_ID=your-jira-client-id
   JIRA_CLIENT_SECRET=your-jira-client-secret
   JIRA_SITE_URL=https://your-domain.atlassian.net
   JIRA_API_URL=https://your-domain.atlassian.net/rest/api/3
   ```

3. Generate a secure NextAuth secret:
   ```bash
   openssl rand -base64 32
   ```

## Step 3: Install Dependencies and Run

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run the development server:
   ```bash
   pnpm dev
   ```

3. Open http://localhost:3000 in your browser

## Step 4: First Time Setup

1. Click "Sign in with Atlassian"
2. You'll be redirected to Atlassian to authorize the app
3. Grant the required permissions
4. You'll be redirected back to the dashboard
5. The app will automatically load your recent worklogs

## Features

### Authentication
- OAuth 2.0 integration with Atlassian
- Secure token management with NextAuth.js
- Automatic session refresh

### Worklog Management
- View recent worklogs with issue details
- Search by date range, issue key, or project
- Time tracking summaries
- Direct links to JIRA issues

### Dashboard
- Total worklogs count
- Total time logged
- Unique issues worked on
- Filterable worklog list

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production  
- `pnpm start` - Start production server
- `pnpm lint` - Run Biome linter
- `pnpm format` - Format code with Biome

## Troubleshooting

### Common Issues

1. **"Authentication Error"**
   - Verify your Client ID and Client Secret are correct
   - Check that the callback URL matches exactly
   - Ensure your JIRA instance URL is correct

2. **"No JIRA site access found"**
   - Make sure your Atlassian account has access to the JIRA site
   - Verify the JIRA_SITE_URL is correct

3. **"Failed to fetch worklogs"**
   - Check that your account has permission to view worklogs
   - Verify the JIRA API permissions include `read:jira-work`

### Debugging

Enable debug logs by adding to `.env.local`:
```env
NEXTAUTH_DEBUG=true
```

## Production Deployment

1. Update environment variables for your production domain
2. Configure OAuth app callback URLs for production
3. Build and deploy:
   ```bash
   pnpm build
   pnpm start
   ```

## Security Notes

- Never commit your `.env.local` file
- Use strong, randomly generated secrets
- Regularly rotate OAuth credentials
- Monitor access logs for suspicious activity

## Support

For issues related to:
- JIRA API permissions: Contact your JIRA admin
- OAuth setup: Check Atlassian Developer documentation
- App bugs: Check the console for error messages