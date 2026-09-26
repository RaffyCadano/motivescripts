/** What the database's scheduled jobs have gone wrong with lately. */

export type JobFailure = { job: string; message: string; createdAt: string };

export type BackgroundHealth = {
  failures: JobFailure[];
  /** Calls to edge functions in the last 24 hours that timed out or came back with an error. */
  failedCalls24h: number;
};

const JOB_LABELS: Record<string, string> = {
  run_scheduled_website_health_checks: "Website uptime checks",
  run_client_reminder_sweep: "Client reminder emails",
  run_scope_reminder_sweep: "Scope reminder emails",
  run_launch_trial_sweep: "Launch trial emails and pauses",
  notify_task_deadlines: "Task deadline alerts",
  notify_domain_ssl_renewals: "Domain and SSL renewal alerts",
  notify_invoices_overdue_email: "Overdue invoice emails",
  purge_old_notifications: "Old notification clean-up",
  run_scheduled_website_backups: "Daily website backups",
  create_monthly_maintenance_review_tasks: "Monthly maintenance review tasks",
  create_monthly_seo_review_tasks: "Monthly SEO review tasks",
};

export function jobLabel(job: string): string {
  return JOB_LABELS[job] ?? job.replace(/_/g, " ");
}

export function parseBackgroundHealth(value: unknown): BackgroundHealth {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rows = Array.isArray(record.failures) ? record.failures : [];
  const failures: JobFailure[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (typeof item.job !== "string") continue;
    failures.push({
      job: item.job,
      message: typeof item.message === "string" ? item.message : "",
      createdAt: typeof item.created_at === "string" ? item.created_at : "",
    });
  }
  const calls = Number(record.failedCalls24h);
  return { failures, failedCalls24h: Number.isFinite(calls) && calls > 0 ? Math.floor(calls) : 0 };
}

/** Whether there is anything to tell an admin about. */
export function hasBackgroundProblems(health: BackgroundHealth): boolean {
  return health.failures.length > 0 || health.failedCalls24h > 0;
}

/** The same job failing repeatedly is one line with a count, newest failure first. */
export function groupFailures(failures: JobFailure[]): { job: string; count: number; latest: JobFailure }[] {
  const byJob = new Map<string, { job: string; count: number; latest: JobFailure }>();
  for (const failure of failures) {
    const existing = byJob.get(failure.job);
    if (!existing) byJob.set(failure.job, { job: failure.job, count: 1, latest: failure });
    else {
      existing.count += 1;
      if (failure.createdAt > existing.latest.createdAt) existing.latest = failure;
    }
  }
  return [...byJob.values()].sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt));
}
