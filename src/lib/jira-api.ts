import axios, { type AxiosInstance } from "axios";

export interface JiraWorklog {
  self: string;
  id: string;
  issueId: string;
  author: {
    self: string;
    name: string;
    key: string;
    displayName: string;
    emailAddress: string;
    avatarUrls: Record<string, string>;
  };
  comment?: {
    type: string;
    version: number;
    content: any[];
  };
  created: string;
  updated: string;
  started: string;
  timeSpent: string;
  timeSpentSeconds: number;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    issuetype: {
      name: string;
      iconUrl: string;
    };
    project: {
      key: string;
      name: string;
    };
    status: {
      name: string;
      statusCategory: {
        name: string;
        colorName: string;
      };
    };
    assignee?: {
      displayName: string;
      avatarUrls: Record<string, string>;
    };
    worklog?: {
      total: number;
      maxResults: number;
      startAt: number;
      worklogs: JiraWorklog[];
    };
  };
}

export interface WorklogSearchParams {
  startDate?: string;
  endDate?: string;
  issueKey?: string;
  projectKey?: string;
  projectKeys?: string[];
  author?: string;
  maxResults?: number;
  startAt?: number;
}

export interface WorklogProgressCallback {
  onWorklogsFound?: (
    worklogs: JiraWorklog[],
    issues: Record<string, JiraIssue>,
  ) => void;
}

export interface JiraUser {
  self: string;
  name: string;
  key: string;
  displayName: string;
  emailAddress: string;
  avatarUrls: Record<string, string>;
  accountId: string;
  accountType: string;
  active: boolean;
  timeZone: string;
  locale: string;
}

export class JiraAPIService {
  private client: AxiosInstance;
  private static readonly USER_CACHE_KEY = "jira-current-user";

  constructor() {
    this.client = axios.create({
      baseURL: "/api/jira",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  async getCurrentUser(): Promise<JiraUser> {
    // Check localStorage first
    try {
      const cachedUser = localStorage.getItem(JiraAPIService.USER_CACHE_KEY);
      if (cachedUser) {
        return JSON.parse(cachedUser) as JiraUser;
      }
    } catch (error) {
      console.warn("Failed to parse cached user data:", error);
      // Clear invalid cached data
      localStorage.removeItem(JiraAPIService.USER_CACHE_KEY);
    }

    try {
      const response = await this.client.get("/myself");
      const userData = response.data as JiraUser;

      // Cache the user data in localStorage
      localStorage.setItem(
        JiraAPIService.USER_CACHE_KEY,
        JSON.stringify(userData),
      );

      return userData;
    } catch (error) {
      console.error("Error fetching current user:", error);
      throw error;
    }
  }

  // Clear the user cache (useful for logout or when authentication changes)
  clearUserCache() {
    localStorage.removeItem(JiraAPIService.USER_CACHE_KEY);
  }

  async getWorklogs(
    params: WorklogSearchParams = {},
    progressCallback?: WorklogProgressCallback,
  ): Promise<{ worklogs: JiraWorklog[]; issues: Record<string, JiraIssue> }> {
    try {
      const { maxResults = 50, startAt = 0, startDate, endDate } = params;

      // Get current user info to filter worklogs properly
      const currentUser = await this.getCurrentUser();

      // Build JQL query - always filter by current user's worklogs
      let jql = "worklogAuthor = currentUser()";

      // Add date filters - send dates as UTC to JIRA
      if (startDate) {
        // Convert to UTC date for consistent querying
        const startDateUtc = new Date(`${startDate}T00:00:00.000Z`);
        jql += ` AND worklogDate >= "${startDateUtc.toISOString().split("T")[0]}"`;
      } else {
        jql += ` AND worklogDate >= -30d`; // Default to last 30 days
      }

      if (endDate) {
        // Convert to UTC date for consistent querying
        const endDateUtc = new Date(`${endDate}T23:59:59.999Z`);
        jql += ` AND worklogDate <= "${endDateUtc.toISOString().split("T")[0]}"`;
      }

      // If specific issue is requested, combine with user filter
      if (params.issueKey) {
        jql += ` AND key = "${params.issueKey}"`;
      }

      if (params.projectKey) {
        jql += ` AND project = "${params.projectKey}"`;
      }

      if (params.projectKeys && params.projectKeys.length > 0) {
        const projectFilter = params.projectKeys
          .map((key) => `"${key}"`)
          .join(", ");
        jql += ` AND project IN (${projectFilter})`;
      }

      // Note: author parameter is redundant since we always filter by currentUser()
      // but keeping it for potential future use or admin features

      // Search for issues with worklogs
      const searchResponse = await this.client.get("/search", {
        params: {
          jql,
          fields: "key,summary,issuetype,project,status,assignee,worklog",
          expand: "changelog",
          maxResults,
          startAt,
        },
      });

      const issues: JiraIssue[] = searchResponse.data.issues;
      const issuesMap: Record<string, JiraIssue> = {};
      const allWorklogs: JiraWorklog[] = [];

      // Process each issue and extract worklogs
      for (const issue of issues) {
        issuesMap[issue.key] = {
          id: issue.id,
          key: issue.key,
          self: issue.self,
          fields: issue.fields,
        };
      }

      // Fetch worklogs for all issues in parallel
      const worklogPromises = issues
        .filter((issue) => issue.fields.worklog?.total && issue.fields.worklog.total > 0)
        .map(async (issue) => {
          try {
            const worklogResponse = await this.client.get(
              `/issue/${issue.key}/worklog`,
            );
            const worklogs = worklogResponse.data.worklogs || [];

            // Filter worklogs by current user and date parameters
            // Note: JQL filters issues that have current user worklogs, but we still need
            // to filter individual worklogs since issues may have worklogs from multiple users
            const filteredWorklogs = worklogs.filter((worklog: JiraWorklog) => {
              // Always filter by current user - use emailAddress for comparison
              if (worklog.author.emailAddress !== currentUser.emailAddress) {
                return false;
              }

              // Apply date filters using UTC comparison
              if (startDate) {
                const worklogDate = new Date(worklog.started);
                const filterStartDate = new Date(`${startDate}T00:00:00.000Z`);

                if (worklogDate < filterStartDate) {
                  return false;
                }
              }

              if (endDate) {
                const worklogDate = new Date(worklog.started);
                const filterEndDate = new Date(`${endDate}T23:59:59.999Z`);

                if (worklogDate > filterEndDate) {
                  return false;
                }
              }

              return true;
            });

            const processedWorklogs = filteredWorklogs.map(
              (worklog: JiraWorklog) => ({
                ...worklog,
                issueId: issue.id,
              }),
            );

            // Emit progress update if callback is provided and we have worklogs
            if (
              progressCallback?.onWorklogsFound &&
              processedWorklogs.length > 0
            ) {
              progressCallback.onWorklogsFound(processedWorklogs, {
                [issue.key]: issuesMap[issue.key],
              });
            }

            return processedWorklogs;
          } catch (worklogError) {
            console.warn(
              `Failed to fetch worklogs for issue ${issue.key}:`,
              worklogError,
            );
            // Return empty array for failed requests to continue processing
            return [];
          }
        });

      // Wait for all worklog requests to complete
      const worklogResults = await Promise.all(worklogPromises);

      // Flatten all worklogs into a single array
      worklogResults.forEach((worklogs) => {
        allWorklogs.push(...worklogs);
      });

      return {
        worklogs: allWorklogs.sort(
          (a, b) =>
            new Date(b.started).getTime() - new Date(a.started).getTime(),
        ),
        issues: issuesMap,
      };
    } catch (error) {
      console.error("Error fetching worklogs:", error);
      throw error;
    }
  }

  async getProjects() {
    try {
      const response = await this.client.get("/project", {
        params: {
          expand: "description,lead,url,projectKeys",
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching projects:", error);
      throw error;
    }
  }

  async createWorklog(
    issueKey: string,
    worklog: {
      timeSpentSeconds: number;
      started: string;
      comment?: string;
    },
  ) {
    try {
      const response = await this.client.post(`/issue/${issueKey}/worklog`, {
        timeSpentSeconds: worklog.timeSpentSeconds,
        started: worklog.started,
        comment: worklog.comment
          ? {
              type: "doc",
              version: 1,
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: worklog.comment,
                    },
                  ],
                },
              ],
            }
          : undefined,
      });
      return response.data;
    } catch (error) {
      console.error("Error creating worklog:", error);
      throw error;
    }
  }

  async updateWorklog(
    issueKey: string,
    worklogId: string,
    worklog: {
      timeSpentSeconds: number;
      started: string;
      comment?: string;
    },
  ) {
    try {
      const response = await this.client.put(
        `/issue/${issueKey}/worklog/${worklogId}`,
        {
          timeSpentSeconds: worklog.timeSpentSeconds,
          started: worklog.started,
          comment: worklog.comment
            ? {
                type: "doc",
                version: 1,
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: worklog.comment,
                      },
                    ],
                  },
                ],
              }
            : undefined,
        },
      );
      return response.data;
    } catch (error) {
      console.error("Error updating worklog:", error);
      throw error;
    }
  }

  async deleteWorklog(issueKey: string, worklogId: string) {
    try {
      await this.client.delete(`/issue/${issueKey}/worklog/${worklogId}`);
    } catch (error) {
      console.error("Error deleting worklog:", error);
      throw error;
    }
  }
}
