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
  };
}

export interface WorklogSearchParams {
  startDate?: string;
  endDate?: string;
  issueKey?: string;
  projectKey?: string;
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

export class JiraAPIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: "/api/jira",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  async getCurrentUser() {
    try {
      const response = await this.client.get("/myself");
      return response.data;
    } catch (error) {
      console.error("Error fetching current user:", error);
      throw error;
    }
  }

  async getWorklogs(
    params: WorklogSearchParams = {},
    progressCallback?: WorklogProgressCallback,
  ): Promise<{ worklogs: JiraWorklog[]; issues: Record<string, JiraIssue> }> {
    try {
      const { maxResults = 50, startAt = 0, startDate, endDate } = params;

      // Get current user info first to filter worklogs properly
      const currentUser = await this.getCurrentUser();

      // Build JQL query - always filter by current user's worklogs
      let jql = "worklogAuthor = currentUser()";

      // Add date filters
      if (startDate) {
        jql += ` AND worklogDate >= "${startDate}"`;
      } else {
        jql += ` AND worklogDate >= -30d`; // Default to last 30 days
      }

      if (endDate) {
        jql += ` AND worklogDate <= "${endDate}"`;
      }

      // If specific issue is requested, combine with user filter
      if (params.issueKey) {
        jql += ` AND key = "${params.issueKey}"`;
      }

      if (params.projectKey) {
        jql += ` AND project = "${params.projectKey}"`;
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

      const issues = searchResponse.data.issues;
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

        // Get detailed worklogs for this issue only if worklog field indicates there are worklogs
        if (issue.fields.worklog?.total > 0) {
          try {
            const worklogResponse = await this.client.get(
              `/issue/${issue.key}/worklog`,
            );
            const worklogs = worklogResponse.data.worklogs || [];

            // Filter worklogs by current user and date parameters
            const filteredWorklogs = worklogs.filter((worklog: JiraWorklog) => {
              // Always filter by current user - use emailAddress for comparison
              if (worklog.author.emailAddress !== currentUser.emailAddress) {
                return false;
              }

              // Apply date filters
              if (
                startDate &&
                new Date(worklog.started) < new Date(startDate)
              ) {
                return false;
              }

              if (endDate && new Date(worklog.started) > new Date(endDate)) {
                return false;
              }

              return true;
            });

            const processedWorklogs = filteredWorklogs.map(
              (worklog: JiraWorklog) => ({
                ...worklog,
                issueId: issue.id,
              }),
            );

            allWorklogs.push(...processedWorklogs);

            // Emit progress update if callback is provided and we have worklogs
            if (
              progressCallback?.onWorklogsFound &&
              processedWorklogs.length > 0
            ) {
              progressCallback.onWorklogsFound(processedWorklogs, {
                [issue.key]: issuesMap[issue.key],
              });
            }
          } catch (worklogError) {
            console.warn(
              `Failed to fetch worklogs for issue ${issue.key}:`,
              worklogError,
            );
            // Continue processing other issues even if one fails
          }
        }
      }

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
