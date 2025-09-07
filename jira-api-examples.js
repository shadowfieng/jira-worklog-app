// JIRA Personal Worklog API Examples
// Make sure to set your JIRA_EMAIL and JIRA_API_TOKEN in .env.local

const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_API_URL = process.env.JIRA_API_URL;

// Basic Auth header for API requests
const authHeader = {
  Authorization: `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64")}`,
  "Content-Type": "application/json",
};

// 1. Get all issues where you logged work
async function getMyWorkloggedIssues() {
  const response = await fetch(
    `${JIRA_API_URL}/search?jql=worklogAuthor=currentUser()&fields=key,summary,worklog`,
    {
      headers: authHeader,
    },
  );
  return response.json();
}

// 2. Get specific issue worklogs
async function getIssueWorklogs(issueKey) {
  const response = await fetch(`${JIRA_API_URL}/issue/${issueKey}/worklog`, {
    headers: authHeader,
  });
  return response.json();
}

// 3. Get your worklogs from a specific date range
async function getMyWorklogsInRange(startDate, endDate) {
  const jql = `worklogAuthor=currentUser() AND worklogDate >= "${startDate}" AND worklogDate <= "${endDate}"`;
  const response = await fetch(
    `${JIRA_API_URL}/search?jql=${encodeURIComponent(jql)}&fields=key,summary,worklog`,
    {
      headers: authHeader,
    },
  );
  return response.json();
}

// 4. Create a new worklog entry
async function createWorklog(issueKey, timeSpent, comment, startDate) {
  const worklogData = {
    timeSpent,
    comment,
    started: startDate, // Format: "2023-12-07T10:00:00.000+0000"
  };

  const response = await fetch(`${JIRA_API_URL}/issue/${issueKey}/worklog`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify(worklogData),
  });
  return response.json();
}

// Usage examples:
// getMyWorkloggedIssues().then(console.log);
// getIssueWorklogs('PROJ-123').then(console.log);
// getMyWorklogsInRange('2023-12-01', '2023-12-07').then(console.log);
// createWorklog('PROJ-123', '2h', 'Working on feature implementation', '2023-12-07T09:00:00.000+0000');
