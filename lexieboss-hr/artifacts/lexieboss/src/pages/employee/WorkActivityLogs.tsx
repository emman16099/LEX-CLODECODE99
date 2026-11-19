import { useRef, useState } from "react";
import {
  getListMyWorkActivityLogsQueryKey,
  getListWorkActivityLogsQueryKey,
  useCreateMyWorkActivityLog,
  useDeleteMyWorkActivityLog,
  useListMyWorkActivityLogs,
  useUpdateMyWorkActivityLog,
  type WorkActivityLog,
  type WorkActivityLogInputKind,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, CircleAlert, LoaderCircle, Pencil, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const todayInManila = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

type Draft = { activityDate: string; kind: WorkActivityLogInputKind; title: string; details: string };
const blankDraft = (): Draft => ({ activityDate: todayInManila(), kind: "event", title: "", details: "" });
const errorMessage = (error: unknown) =>
  (error as { data?: { error?: string }; message?: string })?.data?.error
  ?? (error as { message?: string })?.message
  ?? "Please try again in a moment.";

function EntryFields({
  draft,
  setDraft,
  idPrefix,
  disabled,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  idPrefix: string;
  disabled: boolean;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="space-y-1.5 text-xs font-semibold text-foreground" htmlFor={`${idPrefix}-date`}>
          Date of activity
          <input
            id={`${idPrefix}-date`}
            data-testid={`${idPrefix}-date`}
            aria-label="Date of activity"
            required
            type="date"
            max={todayInManila()}
            value={draft.activityDate}
            disabled={disabled}
            onChange={(event) => setDraft({ ...draft, activityDate: event.target.value })}
            className="input w-full text-sm"
          />
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-foreground" htmlFor={`${idPrefix}-kind`}>
          Entry type
          <select
            id={`${idPrefix}-kind`}
            data-testid={`${idPrefix}-kind`}
            value={draft.kind}
            disabled={disabled}
            onChange={(event) => setDraft({ ...draft, kind: event.target.value as WorkActivityLogInputKind })}
            className="input w-full text-sm"
          >
            <option value="event">Work event</option>
            <option value="accomplishment">Accomplishment</option>
          </select>
        </label>
      </div>
      <label className="block space-y-1.5 text-xs font-semibold text-foreground" htmlFor={`${idPrefix}-title`}>
        Title <span className="font-normal text-muted-foreground">· required</span>
        <input
          id={`${idPrefix}-title`}
          data-testid={`${idPrefix}-title`}
          required
          maxLength={200}
          value={draft.title}
          disabled={disabled}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          placeholder="A clear summary of what happened"
          className="input w-full text-sm"
        />
        <span className="block text-right font-normal text-muted-foreground">{draft.title.length}/200</span>
      </label>
      <label className="block space-y-1.5 text-xs font-semibold text-foreground" htmlFor={`${idPrefix}-details`}>
        Details <span className="font-normal text-muted-foreground">· optional</span>
        <textarea
          id={`${idPrefix}-details`}
          data-testid={`${idPrefix}-details`}
          maxLength={2000}
          value={draft.details}
          disabled={disabled}
          onChange={(event) => setDraft({ ...draft, details: event.target.value })}
          placeholder="Add context, people involved, or the result."
          rows={3}
          className="input w-full resize-y text-sm"
        />
      </label>
    </>
  );
}

function ActivityEntry({ entry, onEdit, onDelete }: {
  entry: WorkActivityLog;
  onEdit: (entry: WorkActivityLog) => void;
  onDelete: (entry: WorkActivityLog) => void;
}) {
  const isAccomplishment = entry.kind === "accomplishment";
  return (
    <article className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30" data-testid={`activity-entry-${entry.id}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isAccomplishment ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {isAccomplishment ? <Sparkles className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <time dateTime={entry.activityDate} className="font-mono text-xs text-muted-foreground">{entry.activityDate}</time>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isAccomplishment ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
              {isAccomplishment ? "Accomplishment" : "Work event"}
            </span>
          </div>
          <h3 className="break-words text-sm font-semibold text-foreground">{entry.title}</h3>
          {entry.details && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{entry.details}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:opacity-70 sm:transition-opacity sm:group-hover:opacity-100">
          <button type="button" data-testid={`button-edit-activity-${entry.id}`} onClick={() => onEdit(entry)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button type="button" data-testid={`button-delete-activity-${entry.id}`} onClick={() => onDelete(entry)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-700">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export default function WorkActivityLogs() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: entries, isLoading, isError, refetch } = useListMyWorkActivityLogs({
    query: {
      queryKey: getListMyWorkActivityLogsQueryKey(),
      refetchInterval: 45_000,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(blankDraft);
  const [formError, setFormError] = useState("");
  const actionInFlight = useRef(false);
  const refreshLogs = () => {
    void qc.invalidateQueries({ queryKey: getListMyWorkActivityLogsQueryKey() });
    void qc.invalidateQueries({ queryKey: getListWorkActivityLogsQueryKey() });
  };
  const createLog = useCreateMyWorkActivityLog({
    mutation: {
      onSuccess: () => {
        refreshLogs();
        setDraft(blankDraft());
        setFormError("");
        toast({ title: "Work entry recorded", description: "Your event has been added to your recent activity." });
      },
      onError: (error) => setFormError(errorMessage(error)),
      onSettled: () => { actionInFlight.current = false; },
    },
  });
  const updateLog = useUpdateMyWorkActivityLog({
    mutation: {
      onSuccess: () => {
        refreshLogs();
        setEditingId(null);
        setFormError("");
        toast({ title: "Entry updated" });
      },
      onError: (error) => setFormError(errorMessage(error)),
      onSettled: () => { actionInFlight.current = false; },
    },
  });
  const deleteLog = useDeleteMyWorkActivityLog({
    mutation: {
      onSuccess: () => {
        refreshLogs();
        setEditingId(null);
        toast({ title: "Entry deleted" });
      },
      onError: (error) => toast({ title: "Could not delete entry", description: errorMessage(error), variant: "destructive" }),
      onSettled: () => { actionInFlight.current = false; },
    },
  });

  const validate = (value: Draft) => {
    if (!value.activityDate) return "Choose the date this activity happened.";
    if (value.activityDate > todayInManila()) return "Activity date cannot be in the future.";
    if (!value.title.trim()) return "Add a title before saving.";
    return "";
  };
  const submitNew = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingId || actionInFlight.current || createLog.isPending) return;
    const error = validate(draft);
    if (error) { setFormError(error); return; }
    actionInFlight.current = true;
    setFormError("");
    createLog.mutate({ data: { activityDate: draft.activityDate, kind: draft.kind, title: draft.title.trim(), details: draft.details.trim() } });
  };
  const submitEdit = (event: React.FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    if (actionInFlight.current || updateLog.isPending) return;
    const error = validate(editDraft);
    if (error) { setFormError(error); return; }
    actionInFlight.current = true;
    setFormError("");
    updateLog.mutate({ id, data: { activityDate: editDraft.activityDate, kind: editDraft.kind, title: editDraft.title.trim(), details: editDraft.details.trim() } });
  };
  const beginEdit = (entry: WorkActivityLog) => {
    if (actionInFlight.current) return;
    setFormError("");
    setEditingId(entry.id);
    setEditDraft({ activityDate: entry.activityDate, kind: entry.kind, title: entry.title, details: entry.details ?? "" });
  };
  const removeEntry = (entry: WorkActivityLog) => {
    if (actionInFlight.current || deleteLog.isPending) return;
    if (!window.confirm(`Delete “${entry.title}”? This entry will be permanently removed.`)) return;
    actionInFlight.current = true;
    deleteLog.mutate({ id: entry.id });
  };

  return (
    <section className="overflow-hidden rounded-lg border border-card-border bg-card" aria-labelledby="manual-work-heading" data-testid="employee-activity-logs">
      <div className="border-b border-border bg-primary/[0.035] px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="h-4 w-4" /></div>
          <div>
            <h2 id="manual-work-heading" className="text-sm font-bold text-foreground">Log an event or accomplishment</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Keep a record of real work, even when it isn’t tied to an assigned job.</p>
          </div>
        </div>
      </div>
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-7">
        <form onSubmit={submitNew} className="space-y-3" data-testid="form-create-activity">
          <EntryFields draft={draft} setDraft={setDraft} idPrefix="new-activity" disabled={!!editingId || createLog.isPending || updateLog.isPending || deleteLog.isPending} />
          {formError && !editingId && <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{formError}</p>}
          <button type="submit" data-testid="button-submit-activity" disabled={!!editingId || createLog.isPending || updateLog.isPending || deleteLog.isPending} className="btn-primary inline-flex min-h-10 w-full items-center justify-center gap-2 sm:w-auto disabled:cursor-wait disabled:opacity-60">
            {createLog.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {createLog.isPending ? "Saving entry…" : "Add to my activity"}
          </button>
        </form>

        <div className="min-w-0 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h3 className="text-sm font-semibold">Your recent entries</h3><p className="mt-0.5 text-xs text-muted-foreground">Latest 200 · only you can edit or remove these.</p></div>
            {entries && <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground">{entries.length}</span>}
          </div>
          {isLoading && <div className="space-y-2" aria-label="Loading recent entries"><div className="h-20 animate-pulse rounded-lg bg-muted/70" /><div className="h-20 animate-pulse rounded-lg bg-muted/50" /></div>}
          {isError && <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"><p>Could not load your recent entries.</p><button type="button" onClick={() => void refetch()} className="mt-2 text-xs font-semibold underline underline-offset-2">Try again</button></div>}
          {!isLoading && !isError && entries?.length === 0 && <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-7 text-center"><div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Plus className="h-4 w-4" /></div><p className="mt-2 text-sm font-semibold">Your work deserves a record.</p><p className="mt-1 text-xs text-muted-foreground">The entries you add will appear here for review and correction.</p></div>}
          {!isLoading && !isError && !!entries?.length && <div className="max-h-[38rem] space-y-2.5 overflow-y-auto pr-1">
            {entries.map((entry) => editingId === entry.id ? (
              <form key={entry.id} onSubmit={(event) => submitEdit(event, entry.id)} className="space-y-3 rounded-lg border border-primary/30 bg-primary/[0.025] p-3" data-testid={`form-edit-activity-${entry.id}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold">Correct entry</span><button type="button" disabled={updateLog.isPending} aria-label="Cancel editing entry" onClick={() => { if (!actionInFlight.current) { setEditingId(null); setFormError(""); } }} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-60"><X className="h-4 w-4" /></button></div>
                <EntryFields draft={editDraft} setDraft={setEditDraft} idPrefix={`edit-activity-${entry.id}`} disabled={updateLog.isPending} />
                {formError && editingId === entry.id && <p role="alert" className="text-xs text-destructive">{formError}</p>}
                <button type="submit" disabled={updateLog.isPending} className="btn-primary inline-flex min-h-9 items-center gap-1.5 text-xs disabled:opacity-60"><Save className="h-3.5 w-3.5" /> Save correction</button>
              </form>
            ) : <ActivityEntry key={entry.id} entry={entry} onEdit={beginEdit} onDelete={removeEntry} />)}
          </div>}
          {createLog.isSuccess && <p role="status" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"><Check className="h-3.5 w-3.5" />Saved to your recent activity.</p>}
        </div>
      </div>
    </section>
  );
}