import {
  getListWorkActivityLogsQueryKey,
  useListWorkActivityLogs,
  type WorkActivityLog,
} from "@workspace/api-client-react";
import { CalendarDays, CircleAlert, ClipboardList, Sparkles } from "lucide-react";

function displayName(entry: WorkActivityLog) {
  const employee = entry.employee;
  return employee ? `${employee.firstName} ${employee.lastName}` : `Employee ${entry.employeeId}`;
}

export default function WorkActivityReview({ employeeId = "", employeeName = "" }: { employeeId?: string; employeeName?: string }) {
  const params = employeeId ? { employeeId } : undefined;
  const { data: entries, isLoading, isError, refetch } = useListWorkActivityLogs(params, {
    query: {
      queryKey: getListWorkActivityLogsQueryKey(params),
      refetchInterval: 45_000,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const ordered = [...(entries ?? [])].sort((a, b) =>
    b.activityDate.localeCompare(a.activityDate) || b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <section className="overflow-hidden rounded-lg border border-card-border bg-card" aria-labelledby="employee-reported-work-heading" data-testid="admin-activity-review">
      <div className="flex flex-col gap-3 border-b border-border bg-primary/[0.035] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ClipboardList className="h-4 w-4" /></div>
          <div>
            <h2 id="employee-reported-work-heading" className="text-sm font-bold">Employee-reported work</h2>
            <p className="mt-1 text-xs text-muted-foreground">Manual events and accomplishments shared by the team · read only</p>
          </div>
        </div>
        {!isLoading && !isError && <span className="w-fit rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground">{ordered.length} entr{ordered.length === 1 ? "y" : "ies"}</span>}
      </div>
      {isLoading && <div className="space-y-3 p-4 sm:p-5" aria-label="Loading employee-reported work"><div className="h-20 animate-pulse rounded-lg bg-muted/70" /><div className="h-20 animate-pulse rounded-lg bg-muted/50" /></div>}
      {isError && <div role="alert" className="m-4 flex flex-col items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive sm:m-5"><p className="flex items-center gap-2"><CircleAlert className="h-4 w-4" />Could not load employee-reported work.</p><button type="button" onClick={() => void refetch()} className="text-xs font-semibold underline underline-offset-2">Try again</button></div>}
       {!isLoading && !isError && ordered.length === 0 && <div className="px-5 py-9 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><ClipboardList className="h-4 w-4" /></div><p className="mt-3 text-sm font-semibold">{employeeId ? `No reports from ${employeeName || "this employee"} yet` : "No employee entries yet"}</p><p className="mt-1 text-xs text-muted-foreground">Manual work reports will appear here as employees add them.</p></div>}
      {!isLoading && !isError && ordered.length > 0 && (
        <div className="max-h-[34rem] divide-y divide-border overflow-y-auto">
          {ordered.map((entry) => (
            <article key={entry.id} data-testid={`admin-activity-entry-${entry.id}`} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(9rem,0.7fr)_minmax(0,2fr)] sm:px-5">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${entry.kind === "accomplishment" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {entry.kind === "accomplishment" ? <Sparkles className="h-3.5 w-3.5" /> : <CalendarDays className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{displayName(entry)}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{entry.employee?.employeeCode ?? entry.employeeId}</p>
                  <time dateTime={entry.activityDate} className="mt-2 inline-block text-xs text-muted-foreground">{entry.activityDate}</time>
                </div>
              </div>
              <div className="min-w-0 sm:border-l sm:border-border sm:pl-5">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${entry.kind === "accomplishment" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{entry.kind === "accomplishment" ? "Accomplishment" : "Work event"}</span>
                  <span className="text-[10px] text-muted-foreground">Reported {new Date(entry.createdAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" })}</span>
                </div>
                <h3 className="break-words text-sm font-semibold">{entry.title}</h3>
                {entry.details && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{entry.details}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}