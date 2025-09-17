"use client";

import { format, formatDistanceToNow } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  JiraAPIService,
  type JiraIssue,
  type JiraUser,
  type JiraWorklog,
  type WorklogSearchParams,
} from "@/lib/jira-api";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multiselect";

interface WorklogWithIssue extends JiraWorklog {
  issue: JiraIssue;
}

function DashboardContent() {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const [worklogs, setWorklogs] = useState<WorklogWithIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jiraSiteUrl, setJiraSiteUrl] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<JiraUser | null>(null);
  const [projects, setProjects] = useState<MultiSelectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  // Create a shared JiraAPIService instance to maintain cache
  const [jiraService] = useState(() => new JiraAPIService())


  // Initialize search params from URL or defaults
  const [searchParams, setSearchParams] = useState<WorklogSearchParams>(() => {
    const defaultStartDate = format(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd",
    );
    const defaultEndDate = format(new Date(), "yyyy-MM-dd");

    const projectKeysParam = urlSearchParams.get("projectKeys");
    const projectKeys = projectKeysParam ? projectKeysParam.split(",") : [];

    return {
      startDate: urlSearchParams.get("startDate") || defaultStartDate,
      endDate: urlSearchParams.get("endDate") || defaultEndDate,
      issueKey: urlSearchParams.get("issueKey") || undefined,
      projectKey: urlSearchParams.get("projectKey") || undefined,
      projectKeys: projectKeys.length > 0 ? projectKeys : undefined,
      author: urlSearchParams.get("author") || undefined,
      maxResults: Number(urlSearchParams.get("maxResults")) || 50,
      startAt: Number(urlSearchParams.get("startAt")) || undefined,
    };
  });

  // Function to update URL search params
  const updateUrlParams = useCallback(
    (params: WorklogSearchParams) => {
      const newParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          if (key === "projectKeys" && Array.isArray(value)) {
            if (value.length > 0) {
              newParams.set(key, value.join(","));
            }
          } else {
            newParams.set(key, value.toString());
          }
        }
      });

      const newUrl = `${window.location.pathname}?${newParams.toString()}`;
      router.replace(newUrl, { scroll: false });
    },
    [router],
  );

  // Fetch JIRA site URL, user info, and projects from server
  useEffect(() => {
    fetch("/api/jira/site-info")
      .then((res) => res.json())
      .then((data) => setJiraSiteUrl(data.siteUrl))
      .catch(() => setJiraSiteUrl(""));

    // Use the shared JiraAPIService instance to get current user (with caching)
    jiraService
      .getCurrentUser()
      .then((data) => {
        setCurrentUser(data);
      })
      .catch(() => setCurrentUser(null));

    // Load available projects
    setLoadingProjects(true);
    fetch("/api/jira/project")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const projectOptions: MultiSelectOption[] = data.map(
            (project: any) => ({
              value: project.key,
              label: `${project.key} - ${project.name}`,
            }),
          );
          setProjects(projectOptions);
        }
      })
      .catch((error) => {
        console.error("Failed to load projects:", error);
        setProjects([]);
      })
      .finally(() => setLoadingProjects(false));
  }, [jiraService]);

  // Logout function
  const handleLogout = async () => {
    try {
      // Clear user cache before logout
      jiraService.clearUserCache();

      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Clear cache and force redirect even if logout fails
      jiraService.clearUserCache();
      router.push("/login");
    }
  };

  // Debounced fetch function with progressive loading
  const debouncedFetch = useCallback((params: WorklogSearchParams) => {
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        setWorklogs([]); // Clear existing worklogs when starting new search

        const allIssues: Record<string, JiraIssue> = {};

        const result = await jiraService.getWorklogs(params, {
          onWorklogsFound: (newWorklogs, newIssues) => {
            // Add new issues to our collection
            Object.assign(allIssues, newIssues);

            // Transform worklogs with issue data
            const worklogsWithIssues: WorklogWithIssue[] = newWorklogs.map(
              (worklog) => ({
                ...worklog,
                issue: allIssues[
                  Object.keys(allIssues).find(
                    (key) => allIssues[key].id === worklog.issueId,
                  ) || ""
                ] || {
                  id: worklog.issueId,
                  key: "UNKNOWN",
                  self: "",
                  fields: {
                    summary: "Unknown Issue",
                    issuetype: { name: "Unknown", iconUrl: "" },
                    project: { key: "UNKNOWN", name: "Unknown Project" },
                    status: {
                      name: "Unknown",
                      statusCategory: { name: "Unknown", colorName: "gray" },
                    },
                  },
                },
              }),
            );

            // Update worklogs progressively - append new worklogs and sort
            setWorklogs((prevWorklogs) => {
              const combined = [...prevWorklogs, ...worklogsWithIssues];
              return combined.sort(
                (a, b) =>
                  new Date(b.started).getTime() - new Date(a.started).getTime(),
              );
            });
          },
        });

        // Merge all issues from final result
        Object.assign(allIssues, result.issues);

        // Final update with any remaining worklogs (in case some weren't emitted progressively)
        const finalWorklogsWithIssues: WorklogWithIssue[] = result.worklogs.map(
          (worklog) => ({
            ...worklog,
            issue: allIssues[
              Object.keys(allIssues).find(
                (key) => allIssues[key].id === worklog.issueId,
              ) || ""
            ] || {
              id: worklog.issueId,
              key: "UNKNOWN",
              self: "",
              fields: {
                summary: "Unknown Issue",
                issuetype: { name: "Unknown", iconUrl: "" },
                project: { key: "UNKNOWN", name: "Unknown Project" },
                status: {
                  name: "Unknown",
                  statusCategory: { name: "Unknown", colorName: "gray" },
                },
              },
            },
          }),
        );

        // Set final sorted result
        setWorklogs(finalWorklogsWithIssues);
      } catch (err: any) {
        console.error("Error fetching worklogs:", err);

        // Clear user cache if authentication error
        if (err.response?.status === 401 || err.response?.status === 403) {
          jiraService.clearUserCache();
        }

        setError(
          err.response?.data?.error ||
            "Failed to fetch worklogs. Please check your JIRA configuration.",
        );
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [jiraService]);

  // Handler for the search button
  const handleSearch = useCallback(() => {
    const cleanup = debouncedFetch(searchParams);
    cleanup(); // Clear any pending debounce
    debouncedFetch(searchParams); // Fetch immediately
  }, [debouncedFetch, searchParams]);

  // Initial fetch when component mounts (only once)
  useEffect(() => {
    const cleanup = debouncedFetch(searchParams);
    return cleanup;
  }, [debouncedFetch]); // Only depend on debouncedFetch, not searchParams

  // Effect to update URL params when search params change (but don't trigger search)
  useEffect(() => {
    updateUrlParams(searchParams);
  }, [
    searchParams.startDate,
    searchParams.endDate,
    searchParams.issueKey,
    searchParams.projectKey,
    searchParams.projectKeys,
    searchParams.author,
    searchParams.maxResults,
    searchParams.startAt,
    updateUrlParams,
  ]);

  // Handler for Enter key press on input fields
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const formatTimeSpent = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours === 0) {
      return `${minutes}m`;
    }
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const getTotalTimeSpent = () => {
    return worklogs.reduce(
      (total, worklog) => total + worklog.timeSpentSeconds,
      0,
    );
  };

  const groupWorklogsByDate = () => {
    const groups: Record<string, WorklogWithIssue[]> = {};

    worklogs.forEach((worklog) => {
      const date = format(new Date(worklog.started), "yyyy-MM-dd");
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(worklog);
    });

    // Sort groups by date (most recent first) and sort worklogs within each group
    const sortedGroups = Object.entries(groups)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([date, groupWorklogs]) => ({
        date,
        worklogs: groupWorklogs.sort(
          (a, b) =>
            new Date(b.started).getTime() - new Date(a.started).getTime(),
        ),
        totalTime: groupWorklogs.reduce(
          (sum, worklog) => sum + worklog.timeSpentSeconds,
          0,
        ),
      }));

    return sortedGroups;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 sm:py-6 gap-4 sm:gap-0">
            <div className="flex-shrink-0">
              <h1 className="text-xl sm:text-2xl font-bold">
                JIRA Worklog Tracker
              </h1>
              <p className="text-sm text-muted-foreground">
                Track and manage your JIRA work logs
              </p>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3">
                {currentUser && (
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <img
                      src={
                        currentUser.avatarUrls?.["48x48"] ||
                        currentUser.avatarUrls?.["32x32"] ||
                        currentUser.avatarUrls?.["24x24"]
                      }
                      alt={currentUser.displayName}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0"
                    />
                    <div className="text-right min-w-0 hidden sm:block">
                      <p className="text-sm font-medium truncate">
                        {currentUser.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {currentUser.emailAddress}
                      </p>
                    </div>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-xs sm:text-sm"
                >
                  Logout
                </Button>
                <ThemeToggleButton />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Worklogs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={searchParams.startDate || ""}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      startDate: e.target.value,
                    })
                  }
                  onKeyDown={handleKeyPress}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={searchParams.endDate || ""}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      endDate: e.target.value,
                    })
                  }
                  onKeyDown={handleKeyPress}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="issue-key">Issue Key</Label>
                <Input
                  id="issue-key"
                  type="text"
                  placeholder="e.g. PROJ-123"
                  value={searchParams.issueKey || ""}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      issueKey: e.target.value,
                    })
                  }
                  onKeyDown={handleKeyPress}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="projects">Projects</Label>
                <MultiSelect
                  options={projects}
                  value={searchParams.projectKeys || []}
                  onChange={(projectKeys) =>
                    setSearchParams({
                      ...searchParams,
                      projectKeys:
                        projectKeys.length > 0 ? projectKeys : undefined,
                    })
                  }
                  placeholder={
                    loadingProjects
                      ? "Loading projects..."
                      : "Select projects..."
                  }
                  disabled={loadingProjects}
                />
              </div>
              <div className="flex items-end md:col-span-2 lg:col-span-4">
                <Button
                  onClick={handleSearch}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {worklogs.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Worklogs
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {formatTimeSpent(getTotalTimeSpent())}
                </div>
                <div className="text-sm text-muted-foreground">Time Logged</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {new Set(worklogs.map((w) => w.issue.key)).size}
                </div>
                <div className="text-sm text-muted-foreground">
                  Unique Issues
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-destructive"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <title>Error</title>
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Worklogs List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Worklogs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading && worklogs.length === 0 ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Loading worklogs...
                </p>
              </div>
            ) : worklogs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">
                  No worklogs found for the selected criteria.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupWorklogsByDate().map((group) => (
                  <div key={group.date}>
                    {/* Date Header */}
                    <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-muted/30 border-b">
                      <h3 className="text-lg font-semibold">
                        {format(new Date(group.date), "EEEE, MMMM dd, yyyy")}
                      </h3>
                      <div className="text-sm font-medium text-green-600 dark:text-green-400">
                        {formatTimeSpent(group.totalTime)}
                      </div>
                    </div>

                    {/* Worklogs for this date */}
                    <div className="divide-y divide-border">
                      {group.worklogs.map((worklog) => (
                        <div
                          key={worklog.id}
                          className="p-4 sm:p-6 hover:bg-accent/50"
                        >
                          <div className="flex items-start space-x-3 sm:space-x-4">
                            <div className="flex-shrink-0">
                              {worklog.issue.fields.issuetype.iconUrl ? (
                                <img
                                  src={worklog.issue.fields.issuetype.iconUrl}
                                  alt={worklog.issue.fields.issuetype.name}
                                  className="h-5 w-5 sm:h-6 sm:w-6"
                                />
                              ) : (
                                <div className="h-5 w-5 sm:h-6 sm:w-6 bg-muted rounded"></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                                <a
                                  href={
                                    jiraSiteUrl
                                      ? `${jiraSiteUrl}/browse/${worklog.issue.key}`
                                      : "#"
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-primary hover:text-primary/80 flex-shrink-0"
                                >
                                  {worklog.issue.key}
                                </a>
                                <span className="hidden sm:inline text-sm text-muted-foreground">
                                  •
                                </span>
                                <span className="text-sm line-clamp-2 sm:truncate">
                                  {worklog.issue.fields.summary}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm text-muted-foreground">
                                <span className="flex-shrink-0">
                                  Logged{" "}
                                  {formatDistanceToNow(
                                    new Date(worklog.started),
                                    {
                                      addSuffix: true,
                                    },
                                  )}
                                </span>
                                <span className="font-medium text-green-600 dark:text-green-400 flex-shrink-0">
                                  {formatTimeSpent(worklog.timeSpentSeconds)}
                                </span>
                                <span className="flex-shrink-0">
                                  {format(new Date(worklog.started), "HH:mm")}
                                </span>
                              </div>
                              {worklog.comment && (
                                <div className="mt-2 text-xs sm:text-sm bg-muted rounded p-2 line-clamp-3">
                                  {worklog.comment.content?.[0]?.content?.[0]
                                    ?.text || "No comment"}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">
              Loading dashboard...
            </p>
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
