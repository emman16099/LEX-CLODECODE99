import { useMemo, useState } from "react";
import {
  useListJobs, useCreateJob, useUpdateJob, useDeleteJob, useCreateWorkItem, useUpdateWorkItem,
  useListDailyTasks, useCreateDailyTask, useUpdateDailyTask, useDeleteDailyTask, useListEmployees,
  useGetDailyTaskHistory, useGetJobDailyHistory, getGetJobDailyHistoryQueryKey,
  getGetDailyTaskHistoryQueryKey, getListJobsQueryKey, getListDailyTasksQueryKey,
  type WorkItemStatus,
  type WorkJobStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, Plus, ChevronDown, CircleAlert, CheckCircle2, Pencil, Trash2, X, Save, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WorkActivityReview from "./WorkActivityReview";

const statuses: { value: WorkItemStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];
const jobStatuses: { value: WorkJobStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "ongoing", label: "Ongoing" },
  { value: "late", label: "Late" },
  { value: "completed", label: "Completed" },
];
const jobStatusClass: Record<WorkJobStatus, string> = {
  planned: "border-blue-200 bg-blue-50 text-blue-700",
  ongoing: "border-green-200 bg-green-50 text-green-700",
  late: "border-red-200 bg-red-50 text-red-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
};
const workItemStatusClass: Record<WorkItemStatus, string> = {
  not_started: "border-blue-200 bg-blue-50 text-blue-700",
  in_progress: "border-green-200 bg-green-50 text-green-700",
  blocked: "border-red-200 bg-red-50 text-red-700",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
};
type JobPriority = "low" | "normal" | "high" | "urgent";
const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const overdueLabel = (status: WorkJobStatus, endDate: string) => {
  if (status !== "late") return jobStatuses.find((item) => item.value === status)?.label ?? status;
  const days = Math.max(0, Math.floor((Date.parse(`${today()}T00:00:00Z`) - Date.parse(`${endDate}T00:00:00Z`)) / 86_400_000));
  return days > 0 ? `Late · ${days} day${days === 1 ? "" : "s"} overdue` : "Late";
};

function RecurringTaskHistory({ taskId }: { taskId: string }) {
  const { data: history, isLoading, isError } = useGetDailyTaskHistory(taskId);

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
      <div className="mb-2 text-xs font-semibold text-foreground">Completion history</div>
      {isLoading && <div className="text-xs text-muted-foreground">Loading history…</div>}
      {isError && <div className="text-xs text-destructive">Could not load completion history.</div>}
      {!isLoading && !isError && history?.length === 0 && <div className="text-xs text-muted-foreground">No calendar days yet.</div>}
      {!isLoading && !isError && history && history.length > 0 && (
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {history.map((entry) => (
            <div key={entry.date} className="flex items-center justify-between rounded px-2 py-1.5 text-xs">
              <span className="font-mono text-muted-foreground">{entry.date}</span>
              <span className={`inline-flex items-center gap-1 font-medium ${entry.completed ? "text-emerald-600" : "text-muted-foreground"}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {entry.completed ? "Completed" : "Not completed"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JobDailyHistory({ jobId }: { jobId: string }) {
  const { data: history, isLoading, isError } = useGetJobDailyHistory(jobId, {
    query: {
      queryKey: getGetJobDailyHistoryQueryKey(jobId),
      refetchInterval: 45_000,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const newestFirst = [...(history ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/20 p-3" data-testid={`job-daily-history-${jobId}`}>
      <div className="mb-2 text-xs font-semibold text-foreground">Daily completion history</div>
      {isLoading && <div className="text-xs text-muted-foreground">Loading daily history…</div>}
      {isError && <div className="text-xs text-destructive">Could not load daily job history.</div>}
      {!isLoading && !isError && newestFirst.length === 0 && <div className="text-xs text-muted-foreground">No daily completion history yet.</div>}
      {!isLoading && !isError && newestFirst.length > 0 && (
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {newestFirst.map((entry) => (
            <div key={entry.date} className="flex items-center justify-between rounded px-2 py-1.5 text-xs" data-testid={`job-history-entry-${jobId}-${entry.date}`}>
              <time dateTime={entry.date} className="font-mono text-muted-foreground">{entry.date}</time>
              <span className={`inline-flex items-center gap-1 font-medium ${entry.completed ? "text-emerald-600" : "text-orange-700"}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {entry.completed ? "Done" : "Missed"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminWork() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: jobs, isLoading } = useListJobs({
    query: {
      queryKey: getListJobsQueryKey(),
      refetchInterval: 45_000,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const { data: allEmployees, isLoading: employeesLoading, isError: employeesError, refetch: refetchEmployees } = useListEmployees();
  const employees = allEmployees?.filter((employee) => employee.employmentStatus === "active");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const { data: tasks, isLoading: tasksLoading, isError: tasksError } = useListDailyTasks();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState<{ jobId: string; clientName: string; assigneeId: string; brief: string; priority: JobPriority; status: WorkJobStatus; startDate: string; endDate: string }>({ jobId: "", clientName: "", assigneeId: "", brief: "", priority: "normal", status: "planned", startDate: today(), endDate: today() });
  const [jobDateError, setJobDateError] = useState("");
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editJobForm, setEditJobForm] = useState<{ jobId: string; clientName: string; assigneeId: string; brief: string; priority: JobPriority; status: WorkJobStatus; startDate: string; endDate: string }>({ jobId: "", clientName: "", assigneeId: "", brief: "", priority: "normal", status: "planned", startDate: today(), endDate: today() });
  const [editJobDateError, setEditJobDateError] = useState("");
  const [itemForm, setItemForm] = useState({ title: "", description: "", assigneeId: "", dueDate: "" });
  const [taskForm, setTaskForm] = useState({ employeeId: "", taskDate: today(), repeatDaily: false, title: "", description: "" });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [historyJobId, setHistoryJobId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({ employeeId: "", taskDate: today(), repeatDaily: false, title: "", description: "", completed: false });

  const refreshJobs = () => qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
  const createJob = useCreateJob({ mutation: { onSuccess: () => { refreshJobs(); setJobForm({ jobId: "", clientName: "", assigneeId: "", brief: "", priority: "normal", status: "planned", startDate: today(), endDate: today() }); setJobDateError(""); toast({ title: "Job created" }); }, onError: (e) => toast({ title: "Could not create job", description: (e as any)?.data?.error, variant: "destructive" }) } });
  const updateJob = useUpdateJob({ mutation: { onSuccess: () => { refreshJobs(); setEditingJobId(null); setEditJobDateError(""); toast({ title: "Job updated" }); }, onError: (e) => toast({ title: "Could not update job", description: (e as any)?.data?.error, variant: "destructive" }) } });
  const deleteJob = useDeleteJob({ mutation: { onSuccess: () => { refreshJobs(); setSelectedJob(null); setEditingJobId(null); toast({ title: "Job deleted" }); }, onError: (e) => toast({ title: "Could not delete job", description: (e as any)?.data?.error, variant: "destructive" }) } });
  const createItem = useCreateWorkItem({ mutation: { onSuccess: () => { refreshJobs(); setItemForm({ title: "", description: "", assigneeId: "", dueDate: "" }); toast({ title: "Work item assigned" }); }, onError: (e) => toast({ title: "Could not add work item", description: (e as any)?.data?.error, variant: "destructive" }) } });
  const updateItem = useUpdateWorkItem({ mutation: { onSuccess: refreshJobs } });
  const createTask = useCreateDailyTask({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListDailyTasksQueryKey() }); setTaskForm({ employeeId: "", taskDate: today(), repeatDaily: false, title: "", description: "" }); toast({ title: "Daily task created" }); }, onError: () => toast({ title: "Could not create daily task", variant: "destructive" }) } });
  const updateTask = useUpdateDailyTask({ mutation: { onSuccess: (_data, variables) => { qc.invalidateQueries({ queryKey: getListDailyTasksQueryKey() }); qc.invalidateQueries({ queryKey: getGetDailyTaskHistoryQueryKey(variables.id) }); setEditingTaskId(null); toast({ title: "Daily task updated" }); }, onError: (e) => toast({ title: "Could not update daily task", description: (e as any)?.data?.error, variant: "destructive" }) } });
  const deleteTask = useDeleteDailyTask({ mutation: { onSuccess: (_data, variables) => { qc.invalidateQueries({ queryKey: getListDailyTasksQueryKey() }); qc.removeQueries({ queryKey: getGetDailyTaskHistoryQueryKey(variables.id) }); setHistoryTaskId((currentId) => currentId === variables.id ? null : currentId); toast({ title: "Daily task deleted" }); }, onError: (e) => toast({ title: "Could not delete daily task", description: (e as any)?.data?.error, variant: "destructive" }) } });

  const current = jobs?.find((job) => job.id === selectedJob);
  const filteredEmployee = allEmployees?.find((employee) => employee.id === employeeFilter);
  const filteredEmployeeName = filteredEmployee ? `${filteredEmployee.firstName} ${filteredEmployee.lastName}` : "";
  const visibleJobs = jobs?.filter((job) => !employeeFilter || job.assigneeId === employeeFilter || job.items.some((item) => item.assigneeId === employeeFilter))
    .map((job) => employeeFilter ? { ...job, items: job.items.filter((item) => item.assigneeId === employeeFilter) } : job);
  const visibleTasks = tasks?.filter((task) => !employeeFilter || task.employeeId === employeeFilter);
  const openCount = visibleJobs?.flatMap((job) => job.items).filter((i) => i.status !== "done").length ?? 0;
  const blockedCount = visibleJobs?.flatMap((job) => job.items).filter((i) => i.status === "blocked").length ?? 0;
  const tasksByDay = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof tasks>>();
    for (const task of tasks ?? []) {
      if (employeeFilter && task.employeeId !== employeeFilter) continue;
      const day = groups.get(task.taskDate) ?? [];
      day.push(task);
      groups.set(task.taskDate, day);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [tasks, employeeFilter]);

  return (
    <div className="page-container max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
         <div><h1 className="text-xl font-bold">Work Coaching</h1><p className="text-sm text-muted-foreground mt-1">Manage jobs, assignments, and daily employee guidance.</p></div>
        <div className="flex flex-wrap gap-2 text-xs"><span className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700">{openCount} open items</span><span className="px-3 py-1.5 rounded-full bg-orange-50 text-orange-700">{blockedCount} blocked</span></div>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-card-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Work Coaching filters">
        <label htmlFor="work-employee-filter" className="flex flex-col gap-1.5 text-sm font-semibold sm:min-w-72">
          Filter by employee
          <select id="work-employee-filter" data-testid="work-employee-filter" className="input w-full font-normal" value={employeeFilter} disabled={employeesLoading} onChange={(event) => { setEmployeeFilter(event.target.value); setSelectedJob(null); setEditingJobId(null); setEditingTaskId(null); setHistoryJobId(null); setHistoryTaskId(null); }}>
            <option value="">All employees</option>
            {allEmployees?.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} · {employee.employeeCode}{employee.employmentStatus !== "active" ? ` (${employee.employmentStatus})` : ""}</option>)}
          </select>
        </label>
        <div className="text-xs text-muted-foreground">
          <p aria-live="polite">{employeeFilter ? `Showing work for ${filteredEmployeeName || "the selected employee"}.` : "Showing work for all employees."}</p>
          <p className="mt-1">Applies to reports, jobs, work items, and daily tasks.</p>
          {employeeFilter && <button type="button" onClick={() => { setEmployeeFilter(""); setSelectedJob(null); setEditingJobId(null); setEditingTaskId(null); setHistoryJobId(null); setHistoryTaskId(null); }} className="mt-2 font-semibold text-primary underline underline-offset-2">Clear employee filter</button>}
          {employeesError && <p role="alert" className="mt-2 text-destructive">Could not load employees. <button type="button" onClick={() => void refetchEmployees()} className="underline">Try again</button></p>}
        </div>
      </section>

      <WorkActivityReview employeeId={employeeFilter} employeeName={filteredEmployeeName} />

      <section className="bg-card border border-card-border rounded-lg p-5">
         <h2 className="font-semibold flex items-center gap-2 mb-4"><Plus className="w-4 h-4 text-primary" /> Create job</h2>
         <form className="grid grid-cols-1 md:grid-cols-8 gap-3" onSubmit={(e) => { e.preventDefault(); if (jobForm.startDate > jobForm.endDate) { setJobDateError("Start date cannot be after the end date."); return; } setJobDateError(""); createJob.mutate({ data: jobForm }); }}>
           <input required placeholder="Job ID (e.g. GUARIN0826)" value={jobForm.jobId} onChange={(e) => setJobForm({ ...jobForm, jobId: e.target.value })} className="input" />
           <input required placeholder="Client / project name" value={jobForm.clientName} onChange={(e) => setJobForm({ ...jobForm, clientName: e.target.value })} className="input" />
           <select required value={jobForm.assigneeId} onChange={(e) => setJobForm({ ...jobForm, assigneeId: e.target.value })} className="input"><option value="">Assign job to employee...</option>{employees?.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select>
           <input required type="date" aria-label="Job start date" value={jobForm.startDate} onChange={(e) => setJobForm({ ...jobForm, startDate: e.target.value })} className="input" />
           <input required type="date" aria-label="Job end date" value={jobForm.endDate} onChange={(e) => setJobForm({ ...jobForm, endDate: e.target.value })} className="input" />
           <select value={jobForm.priority} onChange={(e) => setJobForm({ ...jobForm, priority: e.target.value as any })} className="input"><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="urgent">Urgent</option></select>
            <select aria-label="Project status" value={jobForm.status} onChange={(e) => setJobForm({ ...jobForm, status: e.target.value as WorkJobStatus })} className="input">{jobStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
           <input placeholder="Brief or project instruction" value={jobForm.brief} onChange={(e) => setJobForm({ ...jobForm, brief: e.target.value })} className="input" />
            {jobDateError && <div className="text-xs text-destructive md:col-span-8">{jobDateError}</div>}
            <button disabled={createJob.isPending} className="btn-primary md:col-span-8 md:w-fit">Create job</button>
        </form>
      </section>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        <section className="space-y-3">
          <h2 className="font-semibold">Jobs and work items</h2>
          {isLoading && <div className="p-8 text-center text-muted-foreground">Loading work...</div>}
          {!isLoading && !visibleJobs?.length && <div className="bg-card border border-card-border rounded-lg p-8 text-center text-muted-foreground text-sm">{employeeFilter ? "No jobs or work items assigned to this employee." : "No jobs yet. Create the first job above."}</div>}
           {visibleJobs?.map((job) => (
              <div key={job.id} className={`bg-card border rounded-lg overflow-hidden ${selectedJob === job.id ? "border-primary/50" : "border-card-border"}`}>
                <div className="p-4 flex items-start sm:items-center gap-3">
                 <button type="button" onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)} className="min-w-0 flex-1 text-left flex items-start sm:items-center gap-3 hover:bg-muted/20">
                   <BriefcaseBusiness className="w-4 h-4 text-primary flex-shrink-0" /><div className="min-w-0 flex-1"><div className="font-semibold truncate">{job.jobId} <span className="font-normal text-muted-foreground">· {job.clientName}</span></div><div className="text-xs text-muted-foreground mt-1">{job.startDate} → {job.endDate} · {job.items.length} work item{job.items.length !== 1 ? "s" : ""} · {job.brief || "No brief"}</div></div><span className={`text-xs px-2 py-1 rounded-full capitalize ${job.priority === "urgent" ? "bg-red-100 text-red-700" : job.priority === "high" ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"}`}>{job.priority}</span><ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${selectedJob === job.id ? "rotate-180" : ""}`} />
                 </button>
                   <select aria-label={`Status for ${job.jobId}`} disabled={updateJob.isPending} value={job.status} onChange={(e) => updateJob.mutate({ id: job.id, data: { status: e.target.value as WorkJobStatus } })} className={`input w-auto max-w-48 text-xs font-semibold disabled:cursor-wait disabled:opacity-60 ${jobStatusClass[job.status]}`}>{jobStatuses.map((status) => <option key={status.value} value={status.value}>{status.value === job.status ? overdueLabel(job.status, job.endDate) : status.label}</option>)}</select>
                  <div className="flex gap-1 flex-shrink-0"><button type="button" aria-label={`Edit ${job.jobId}`} onClick={() => { setSelectedJob(job.id); setEditingJobId(job.id); setEditJobDateError(""); setEditJobForm({ jobId: job.jobId, clientName: job.clientName, assigneeId: job.assigneeId ?? "", brief: job.brief, priority: job.priority, status: job.status, startDate: job.startDate, endDate: job.endDate }); }} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button><button type="button" aria-label={`Delete ${job.jobId}`} disabled={deleteJob.isPending} onClick={() => { if (window.confirm(`Delete job "${job.jobId}"? Its work items will also be deleted.`)) deleteJob.mutate({ id: job.id }); }} className="p-1.5 text-muted-foreground hover:text-destructive disabled:cursor-wait disabled:opacity-60"><Trash2 className="w-4 h-4" /></button></div>
                </div>
                  <div className="px-4 pb-3 flex flex-wrap items-center justify-between gap-2">
                    {(() => {
                      const currentDay = today();
                      const inRange = job.startDate <= currentDay && currentDay <= job.endDate;
                      const doneToday = job.dailyCompleted && job.completionDate === currentDay;
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${!inRange ? "bg-muted text-muted-foreground" : doneToday ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}`}
                          data-testid={`job-daily-status-${job.id}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {!inRange ? "Outside job date range" : doneToday ? `Done today · ${job.completionDate}` : "Pending today"}
                        </span>
                      );
                    })()}
                    <button
                      type="button"
                      aria-expanded={historyJobId === job.id}
                      aria-label={`${historyJobId === job.id ? "Hide" : "View"} daily history for ${job.jobId}`}
                      data-testid={`button-job-history-${job.id}`}
                      onClick={() => setHistoryJobId(historyJobId === job.id ? null : job.id)}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <History className="h-3.5 w-3.5" />
                      {historyJobId === job.id ? "Hide history" : "Daily history"}
                    </button>
                  </div>
                  {historyJobId === job.id && <div className="px-4 pb-4"><JobDailyHistory jobId={job.id} /></div>}
                 {selectedJob === job.id && <div className="border-t border-border p-4 space-y-3">
                  {editingJobId === job.id && <form className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border border-primary/30 p-3" onSubmit={(e) => { e.preventDefault(); if (editJobForm.startDate > editJobForm.endDate) { setEditJobDateError("Start date cannot be after the end date."); return; } setEditJobDateError(""); updateJob.mutate({ id: job.id, data: editJobForm }); }}>
                    <input required placeholder="Job ID" value={editJobForm.jobId} onChange={(e) => setEditJobForm({ ...editJobForm, jobId: e.target.value })} className="input text-xs" />
                    <input required placeholder="Client / project name" value={editJobForm.clientName} onChange={(e) => setEditJobForm({ ...editJobForm, clientName: e.target.value })} className="input text-xs" />
                    <select required value={editJobForm.assigneeId} onChange={(e) => setEditJobForm({ ...editJobForm, assigneeId: e.target.value })} className="input text-xs"><option value="">Assign job to employee...</option>{employees?.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select>
                    <select value={editJobForm.priority} onChange={(e) => setEditJobForm({ ...editJobForm, priority: e.target.value as any })} className="input text-xs"><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="urgent">Urgent</option></select>
                     <select aria-label="Edit project status" value={editJobForm.status} onChange={(e) => setEditJobForm({ ...editJobForm, status: e.target.value as WorkJobStatus })} className="input text-xs">{jobStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
                    <input required type="date" aria-label="Job start date" value={editJobForm.startDate} onChange={(e) => setEditJobForm({ ...editJobForm, startDate: e.target.value })} className="input text-xs" />
                    <input required type="date" aria-label="Job end date" value={editJobForm.endDate} onChange={(e) => setEditJobForm({ ...editJobForm, endDate: e.target.value })} className="input text-xs" />
                    <input placeholder="Brief or project instruction" value={editJobForm.brief} onChange={(e) => setEditJobForm({ ...editJobForm, brief: e.target.value })} className="input text-xs sm:col-span-2" />
                    {editJobDateError && <div className="text-xs text-destructive sm:col-span-2">{editJobDateError}</div>}
                    <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={updateJob.isPending} className="btn-primary text-xs inline-flex items-center gap-1 disabled:cursor-wait disabled:opacity-60"><Save className="w-3.5 h-3.5" /> Save changes</button><button type="button" onClick={() => { setEditingJobId(null); setEditJobDateError(""); }} className="btn-secondary text-xs inline-flex items-center gap-1"><X className="w-3.5 h-3.5" /> Cancel</button></div>
                  </form>}
                  {editingJobId !== job.id && <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-muted-foreground"><span>Assigned to</span><select disabled={updateJob.isPending} value={job.assigneeId ?? ""} onChange={(e) => updateJob.mutate({ id: job.id, data: { assigneeId: e.target.value || null } })} className="input sm:w-64 text-xs disabled:cursor-wait disabled:opacity-60"><option value="">Unassigned</option>{employees?.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select></div>}
                 {job.items.map((item) => <div key={item.id} className="border border-border rounded-md p-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2"><div className="min-w-0 flex-1"><div className="font-medium text-sm">{item.title}</div><div className="text-xs text-muted-foreground mt-1">{item.description || "No instructions"}</div><div className="text-xs mt-2 text-muted-foreground">Assigned to <span className="font-medium text-foreground">{item.assignee ? `${item.assignee.firstName} ${item.assignee.lastName}` : "—"}</span></div>{item.employeeNote && <div className="mt-2 text-xs bg-red-50 text-red-800 p-2 rounded"><CircleAlert className="inline w-3 h-3 mr-1" />{item.employeeNote}</div>}</div><select disabled={updateItem.isPending} value={item.status} onChange={(e) => updateItem.mutate({ id: item.id, data: { status: e.target.value as WorkItemStatus } })} className={`input w-full sm:w-32 text-xs font-semibold disabled:cursor-wait disabled:opacity-60 ${workItemStatusClass[item.status]}`}>{statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                </div>)}
                <form className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border" onSubmit={(e) => { e.preventDefault(); if (current) createItem.mutate({ id: current.id, data: { ...itemForm, dueDate: itemForm.dueDate || null } }); }}>
                  <input required placeholder="Work item (e.g. CNC cutting)" value={itemForm.title} onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} className="input" /><select required value={itemForm.assigneeId} onChange={(e) => setItemForm({ ...itemForm, assigneeId: e.target.value })} className="input"><option value="">Assign employee...</option>{employees?.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select><input placeholder="Instructions" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} className="input" /><input type="date" value={itemForm.dueDate} onChange={(e) => setItemForm({ ...itemForm, dueDate: e.target.value })} className="input" /><button disabled={createItem.isPending} className="btn-secondary sm:col-span-2">Add work item</button>
                </form>
               </div>}
            </div>
          ))}
        </section>

        <section className="space-y-5">
          <div className="bg-card border border-card-border rounded-lg p-5">
            <h2 className="font-semibold flex items-center gap-2 mb-4"><Plus className="w-4 h-4 text-primary" /> Assign daily task</h2>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); createTask.mutate({ data: taskForm }); }}>
              <select required value={taskForm.employeeId} onChange={(e) => setTaskForm({ ...taskForm, employeeId: e.target.value })} className="input w-full"><option value="">Assign employee...</option>{employees?.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><input required type="date" aria-label={taskForm.repeatDaily ? "Repeat task start date" : "Task date"} value={taskForm.taskDate} onChange={(e) => setTaskForm({ ...taskForm, taskDate: e.target.value })} className="input" /><input required placeholder="Task title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className="input" /></div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={taskForm.repeatDaily} onChange={(e) => setTaskForm({ ...taskForm, repeatDaily: e.target.checked })} className="mt-0.5" /><span><span className="font-medium">Repeat every day</span><span className="block text-xs text-muted-foreground">This task will appear every day starting on the selected date.</span></span></label>
              <textarea placeholder="Optional guidance or standard" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} className="input min-h-20 w-full" /><button disabled={createTask.isPending} className="btn-primary">Assign task</button>
            </form>
          </div>
           <div className="bg-card border border-card-border rounded-lg p-5">
             <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
               <h2 className="font-semibold">Daily tasks by day</h2>
               {!tasksLoading && !tasksError && <span className="text-xs text-muted-foreground">{visibleTasks?.length ?? 0} task{visibleTasks?.length === 1 ? "" : "s"} total</span>}
             </div>
             {tasksLoading && <p className="text-sm text-muted-foreground">Loading daily tasks…</p>}
             {tasksError && <p className="text-sm text-destructive">Could not load daily tasks. Please refresh the page.</p>}
             {!tasksLoading && !tasksError && tasksByDay.length === 0 && <p className="text-sm text-muted-foreground">{employeeFilter ? "No daily tasks assigned to this employee." : "No daily tasks assigned yet."}</p>}
             {!tasksLoading && !tasksError && (
               <div className="space-y-5">
                 {tasksByDay.map(([day, dayTasks]) => (
                   <section key={day} aria-label={`Tasks for ${day}`}>
                     <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-2">
                       <h3 className="text-sm font-semibold text-foreground">
                         <time dateTime={day}>{new Date(`${day}T00:00:00Z`).toLocaleDateString("en-PH", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" })}</time>
                       </h3>
                       <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{dayTasks.length} task{dayTasks.length === 1 ? "" : "s"}</span>
                     </div>
                     <div className="divide-y divide-border">
                       {dayTasks.map((t) => editingTaskId === t.id ? (
                         <div key={t.id} className="space-y-2 rounded-md border border-primary/30 p-3">
                           <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                             <select required aria-label="Assign employee" value={editTaskForm.employeeId} onChange={(e) => setEditTaskForm({ ...editTaskForm, employeeId: e.target.value })} className="input text-xs">
                               <option value="">Assign employee...</option>
                               {employees?.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
                             </select>
                             <input required type="date" aria-label={editTaskForm.repeatDaily ? "Repeat task start date" : "Task date"} value={editTaskForm.taskDate} onChange={(e) => setEditTaskForm({ ...editTaskForm, taskDate: e.target.value })} className="input text-xs" />
                             <input required placeholder="Task title" aria-label="Task title" value={editTaskForm.title} onChange={(e) => setEditTaskForm({ ...editTaskForm, title: e.target.value })} className="input text-xs sm:col-span-2" />
                           </div>
                           <label className="flex items-start gap-2 text-xs text-muted-foreground">
                             <input type="checkbox" checked={editTaskForm.repeatDaily} onChange={(e) => setEditTaskForm({ ...editTaskForm, repeatDaily: e.target.checked })} className="mt-0.5" />
                             <span><span className="font-medium text-foreground">Repeat every day</span><span className="block">Starts on the selected date.</span></span>
                           </label>
                           <textarea aria-label="Task guidance" placeholder="Optional guidance or standard" value={editTaskForm.description} onChange={(e) => setEditTaskForm({ ...editTaskForm, description: e.target.value })} className="input min-h-16 w-full text-xs" />
                           <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={editTaskForm.completed} onChange={(e) => setEditTaskForm({ ...editTaskForm, completed: e.target.checked })} /> Mark task completed today</label>
                           <div className="flex gap-2">
                             <button type="button" disabled={updateTask.isPending} onClick={() => updateTask.mutate({ id: t.id, data: editTaskForm })} className="btn-primary inline-flex items-center gap-1 text-xs"><Save className="h-3.5 w-3.5" /> Save</button>
                             <button type="button" onClick={() => setEditingTaskId(null)} className="btn-secondary inline-flex items-center gap-1 text-xs"><X className="h-3.5 w-3.5" /> Cancel</button>
                           </div>
                         </div>
                       ) : (
                         <div key={t.id} className="flex items-start gap-2 py-3 text-sm">
                           <CheckCircle2 aria-label={t.completed ? "Completed" : "Not completed"} className={`mt-0.5 h-4 w-4 shrink-0 ${t.completed ? "text-emerald-500" : "text-muted-foreground"}`} />
                           <div className="min-w-0 flex-1">
                             <div className={t.completed ? "break-words text-muted-foreground line-through" : "break-words"}>{t.title}</div>
                             <div className="mt-0.5 text-xs text-muted-foreground">
                               {t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : "—"}
                               {t.repeatDaily && " · Repeats daily from this date"}
                               {t.employeeNote && ` · Note: ${t.employeeNote}`}
                             </div>
                             {historyTaskId === t.id && <RecurringTaskHistory taskId={t.id} />}
                           </div>
                           <div className="flex shrink-0 items-start">
                             {t.repeatDaily && <button type="button" aria-label={`${historyTaskId === t.id ? "Hide" : "View"} history for ${t.title}`} onClick={() => setHistoryTaskId(historyTaskId === t.id ? null : t.id)} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><History className="h-4 w-4" /></button>}
                             <button type="button" aria-label={`Edit ${t.title}`} onClick={() => { setEditingTaskId(t.id); setEditTaskForm({ employeeId: t.employee?.id ?? "", taskDate: t.taskDate, repeatDaily: t.repeatDaily, title: t.title, description: t.description, completed: t.completed }); }} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                             <button type="button" aria-label={`Delete ${t.title}`} disabled={deleteTask.isPending} onClick={() => { if (window.confirm(`Delete the task "${t.title}"?`)) deleteTask.mutate({ id: t.id }); }} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-60"><Trash2 className="h-4 w-4" /></button>
                           </div>
                         </div>
                       ))}
                     </div>
                   </section>
                 ))}
               </div>
             )}
           </div>
        </section>
      </div>
    </div>
  );
}