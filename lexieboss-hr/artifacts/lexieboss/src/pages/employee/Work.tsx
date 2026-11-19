import { useRef, useState } from "react";
import { useGetMyWork, useGetMyWeeklyRecap, useUpdateWorkItem, useUpdateDailyTask, useCompleteMyJob, useCompleteMyJobToday, getGetMyWorkQueryKey, type WorkItemStatus, type WorkJobStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, CheckCircle2, Circle, ClipboardCheck, BriefcaseBusiness } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppUser } from "@/hooks/useAppUser";
import WorkActivityLogs from "./WorkActivityLogs";

const statuses: { value: WorkItemStatus; label: string }[] = [
  { value: "not_started", label: "Not started" }, { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" }, { value: "done", label: "Done" },
];
const statusClass: Record<string, string> = { not_started: "border-blue-200 bg-blue-50 text-blue-700", in_progress: "border-green-200 bg-green-50 text-green-700", blocked: "border-red-200 bg-red-50 text-red-700", done: "border-emerald-200 bg-emerald-50 text-emerald-700" };
const todayInManila = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const projectStatusLabel = (status: WorkJobStatus, endDate: string) => {
  if (status !== "late") return status === "ongoing" ? "Ongoing" : status.charAt(0).toUpperCase() + status.slice(1);
  const days = Math.max(0, Math.floor((Date.parse(`${todayInManila()}T00:00:00Z`) - Date.parse(`${endDate}T00:00:00Z`)) / 86_400_000));
  return days > 0 ? `Late · ${days} day${days === 1 ? "" : "s"} overdue` : "Late";
};
const projectStatusClass: Record<WorkJobStatus, string> = {
  planned: "border border-blue-200 bg-blue-50 text-blue-700",
  ongoing: "border border-green-200 bg-green-50 text-green-700",
  late: "border border-red-200 bg-red-50 text-red-700",
  completed: "border border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default function EmployeeWork() {
  const { data, isLoading } = useGetMyWork({
    query: {
      queryKey: getGetMyWorkQueryKey(),
      refetchInterval: 45_000,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const { data: weeklyRecap, isLoading: recapLoading } = useGetMyWeeklyRecap();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { appUser } = useAppUser();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [dailyDoneLocally, setDailyDoneLocally] = useState<Set<string>>(() => new Set());
  const dailyInFlight = useRef(new Set<string>());
  const updateItem = useUpdateWorkItem({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetMyWorkQueryKey() }),
      onError: () => toast({ title: "Could not update work item", variant: "destructive" }),
    },
  });
  const updateTask = useUpdateDailyTask({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getGetMyWorkQueryKey() }), onError: () => toast({ title: "Could not update task", variant: "destructive" }) } });
  const completeJob = useCompleteMyJob({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMyWorkQueryKey() });
        toast({ title: "Job marked completed" });
      },
      onError: () => toast({ title: "Could not complete job", variant: "destructive" }),
    },
  });
  const completeJobToday = useCompleteMyJobToday({
    mutation: {
      onSuccess: (job) => {
        setDailyDoneLocally((current) => new Set(current).add(`${job.id}:${job.completionDate}`));
        qc.invalidateQueries({ queryKey: getGetMyWorkQueryKey() });
        toast({ title: "Marked done for today" });
      },
      onError: (error) => toast({
        title: "Could not mark job done for today",
        description: (error as any)?.data?.error,
        variant: "destructive",
      }),
      onSettled: (_data, _error, variables) => {
        dailyInFlight.current.delete(variables.id);
      },
    },
  });
  if (isLoading) return <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 text-sm text-muted-foreground">Loading your work...</div>;
  const jobMap = new Map((data?.jobs ?? []).map((job) => [job.id, job]));
  const today = todayInManila();
  const tasks = (data?.tasks ?? []).filter((t) => t.repeatDaily ? t.taskDate <= today : t.taskDate <= today);
  const open = data?.items.filter((i) => i.status !== "done").length ?? 0;
  const markComplete = (itemId: string) => {
    updateItem.mutate(
      { id: itemId, data: { status: "done" } },
      { onSuccess: () => toast({ title: "Work item marked complete" }) },
    );
  };

  return <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 space-y-6">
    <div><p className="text-xs uppercase tracking-wider text-secondary font-bold">My work today</p><h1 className="text-2xl font-bold mt-1">Good day — here’s your brief</h1><p className="text-sm text-muted-foreground mt-1">{open} open work item{open !== 1 ? "s" : ""} · {tasks.filter((t) => !t.completed).length} required task{tasks.filter((t) => !t.completed).length !== 1 ? "s" : ""} remaining</p></div>
     {(recapLoading || weeklyRecap) && <section className="bg-card border border-card-border rounded-lg overflow-hidden"><div className="px-4 sm:px-5 py-4 border-b border-card-border flex flex-wrap items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" /><h2 className="font-semibold text-sm text-foreground">Weekly recap</h2>{weeklyRecap && <span className="text-xs text-muted-foreground sm:ml-auto">{weeklyRecap.periodFrom} → {weeklyRecap.periodTo}</span>}</div>{recapLoading ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 rounded-md bg-muted animate-pulse" />)}</div> : weeklyRecap && <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5"><div className="rounded-md bg-primary/5 p-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tasks done</div><div className="mt-1 text-xl font-bold text-foreground">{weeklyRecap.tasks.completedCount}<span className="text-sm font-medium text-muted-foreground">/{weeklyRecap.tasks.plannedCount}</span></div></div><div className={`rounded-md p-3 ${weeklyRecap.tasks.missedCount > 0 ? "bg-red-50" : "bg-emerald-50"}`}><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Missed plans</div><div className={`mt-1 text-xl font-bold ${weeklyRecap.tasks.missedCount > 0 ? "text-red-700" : "text-emerald-700"}`}>{weeklyRecap.tasks.missedCount}</div></div><div className="rounded-md bg-blue-50 p-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Job items done</div><div className="mt-1 text-xl font-bold text-blue-700">{weeklyRecap.jobs.doneCount}<span className="text-sm font-medium text-muted-foreground">/{weeklyRecap.jobs.totalCount}</span></div>{weeklyRecap.jobs.blockedCount > 0 && <div className="mt-0.5 text-[11px] text-orange-700">{weeklyRecap.jobs.blockedCount} blocked</div>}</div><div className="rounded-md bg-slate-100 p-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Attendance</div><div className="mt-1 text-xl font-bold text-foreground">{weeklyRecap.attendance.presentCount}<span className="text-sm font-medium text-muted-foreground"> days</span></div><div className="mt-0.5 text-[11px] text-muted-foreground">{parseFloat(weeklyRecap.attendance.totalHours).toFixed(1)}h worked · {weeklyRecap.attendance.lateCount} late</div></div></div>}</section>}
    <section className="bg-sidebar text-white rounded-lg p-4 sm:p-5"><div className="text-xs uppercase tracking-wider text-secondary font-semibold mb-2">Coach reminder</div><p className="text-sm leading-relaxed">Work with ownership: check your instructions before starting, report delays or missing materials early, and keep your work area clean and safe.</p></section>

      <WorkActivityLogs />

     <section><h2 className="font-semibold flex items-center gap-2 mb-3"><ClipboardCheck className="w-4 h-4 text-primary" /> Required tasks for today</h2><div className="bg-card border border-card-border rounded-lg divide-y divide-border">{!tasks.length && <div className="p-5 text-sm text-muted-foreground">No daily tasks assigned for today.</div>}{tasks.map((task) => { const missed = !task.repeatDaily && task.taskDate < today && !task.completed; return <div key={task.id} className={`p-4 flex items-start gap-3 ${missed ? "bg-red-50 border-l-4 border-red-500" : ""}`}><button type="button" disabled={updateTask.isPending} aria-busy={updateTask.isPending} aria-pressed={task.completed} aria-label={task.completed ? "Mark task incomplete" : "Complete task"} onClick={() => updateTask.mutate({ id: task.id, data: { completed: !task.completed } })} className={`mt-0.5 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${task.completed ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : missed ? "border-red-200 bg-white text-red-700 hover:bg-red-100" : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"}`}>{task.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}<span>{task.completed ? "Completed" : "Complete"}</span></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><div className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : missed ? "text-red-900" : ""}`}>{task.title}</div>{task.repeatDaily && <span className="text-[11px] rounded-full bg-blue-50 text-blue-700 px-2 py-0.5">Every day</span>}{missed && <span className="text-[11px] rounded-full bg-red-100 text-red-700 px-2 py-0.5 font-semibold">Missed completion</span>}</div>{missed && <div className="text-xs text-red-700 mt-1">Planned for {task.taskDate}</div>}{task.description && <div className="text-xs text-muted-foreground mt-1">{task.description}</div>}<input disabled={updateTask.isPending} placeholder="Add a difficulty or requirement note..." value={notes[task.id] ?? task.employeeNote ?? ""} onChange={(e) => setNotes({ ...notes, [task.id]: e.target.value })} onBlur={(e) => { const note = e.target.value.trim() || null; if (note !== (task.employeeNote ?? null)) updateTask.mutate({ id: task.id, data: { employeeNote: note } }); }} className="input mt-2 w-full text-xs disabled:cursor-wait disabled:opacity-60" /></div></div>; })}</div></section>

      <section><h2 className="font-semibold flex items-center gap-2 mb-3"><BriefcaseBusiness className="w-4 h-4 text-primary" /> Assigned jobs</h2><div className="space-y-3">{!data?.jobs.length && <div className="bg-card border border-card-border rounded-lg p-5 text-sm text-muted-foreground">No jobs assigned yet.</div>}{data?.jobs.map((job) => { const doneItems = job.items.filter((item) => item.status === "done").length; const hasItems = job.items.length > 0; const today = todayInManila(); const inDateRange = job.startDate <= today && today <= job.endDate; const dailyDone = (job.dailyCompleted && job.completionDate === today) || dailyDoneLocally.has(`${job.id}:${today}`); const isAssignee = !!appUser?.employeeId && job.assigneeId === appUser.employeeId; return <div key={job.id} className="bg-card border border-card-border rounded-lg p-4" data-testid={`assigned-job-${job.id}`}><div className="flex flex-col sm:flex-row sm:items-start gap-2"><div className="min-w-0 flex-1"><div className="text-xs font-mono text-muted-foreground break-words">{job.jobId} · {job.clientName}</div><div className="text-xs text-muted-foreground mt-1">{job.startDate} → {job.endDate}</div>{job.brief && <div className="text-xs bg-muted/40 rounded p-2 mt-3">{job.brief}</div>}</div><div className="flex flex-wrap items-center gap-2 self-start"><span className={`text-xs rounded-full px-2 py-1 whitespace-nowrap font-semibold ${projectStatusClass[job.status]}`}>{projectStatusLabel(job.status, job.endDate)}</span><span className={`text-xs rounded-full px-2 py-1 whitespace-nowrap ${hasItems && doneItems === job.items.length ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{doneItems}/{job.items.length} complete</span>{job.status !== "completed" && <button type="button" disabled={completeJob.isPending} onClick={() => { if (window.confirm(`Finish the entire job "${job.jobId}"? This is separate from marking it done for today.`)) completeJob.mutate({ id: job.id }); }} className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60" aria-label={`Finish entire job ${job.jobId}`} data-testid={`button-finish-job-${job.id}`}><CheckCircle2 className="h-3.5 w-3.5" /> Finish entire job</button>}</div></div>{isAssignee && <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4" data-testid={`daily-job-completion-${job.id}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="text-sm font-semibold text-foreground">{dailyDone ? `Done today · ${job.completionDate === today ? job.completionDate : today}` : "Daily job check-in"}</div><div className="mt-1 text-xs text-muted-foreground">{job.status === "completed" ? "The entire job is finished, so daily check-ins are closed." : !inDateRange ? `Available only from ${job.startDate} through ${job.endDate}.` : `Today is ${today} in Manila. Daily completion resets at midnight (Asia/Manila).`}</div></div><button type="button" disabled={dailyDone || !inDateRange || job.status === "completed" || completeJobToday.isPending} onClick={() => { if (dailyInFlight.current.has(job.id)) return; dailyInFlight.current.add(job.id); completeJobToday.mutate({ id: job.id }); }} className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${dailyDone ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"}`} aria-label={`${dailyDone ? "Done today" : "Done for today"} for ${job.jobId}`} data-testid={`button-done-today-${job.id}`}><CheckCircle2 className="h-4 w-4" />{dailyDone ? "Done today" : "Done for today"}</button></div>{!dailyDone && (inDateRange && job.status !== "completed") && <div className="mt-2 text-xs text-muted-foreground">This records today’s progress only; it does not finish the entire job.</div>}</div>}{job.items.map((item) => <div key={item.id} className="border-t border-border mt-3 pt-3"><div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3"><div className="min-w-0 flex-1"><div className={`font-semibold ${item.status === "done" ? "text-muted-foreground line-through" : ""}`}>{item.title}</div>{item.description && <div className="text-sm text-muted-foreground mt-1">{item.description}</div>}</div><div className="flex w-full sm:w-auto items-center gap-2"><select disabled={updateItem.isPending} value={item.status} onChange={(e) => updateItem.mutate({ id: item.id, data: { status: e.target.value as WorkItemStatus } })} className={`input min-w-0 flex-1 sm:w-32 text-xs font-medium ${statusClass[item.status]} disabled:cursor-wait disabled:opacity-60`} aria-label={`Status for ${item.title}`}>{statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>{item.status === "done" ? <span className="inline-flex h-9 items-center gap-1 rounded-md bg-emerald-50 px-3 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Done</span> : <button type="button" disabled={updateItem.isPending} onClick={() => markComplete(item.id)} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60" aria-label={`Mark ${item.title} complete`}><CheckCircle2 className="h-4 w-4" /> Mark complete</button>}</div></div><div className="flex items-start gap-2 mt-3"><AlertTriangle className="mt-2 w-3.5 h-3.5 flex-shrink-0 text-orange-500" /><input disabled={updateItem.isPending} placeholder="Report a difficulty, missing material, or requirement..." value={notes[item.id] ?? item.employeeNote ?? ""} onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })} onBlur={(e) => { const note = e.target.value.trim() || null; if (note !== (item.employeeNote ?? null)) updateItem.mutate({ id: item.id, data: { employeeNote: note } }); }} className="input min-w-0 flex-1 text-xs disabled:cursor-wait disabled:opacity-60" /></div></div>)}</div>})}</div></section>
  </div>;
}