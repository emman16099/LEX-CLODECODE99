import { useListPayrollIncentiveChanges, getListPayrollIncentiveChangesQueryKey } from "@workspace/api-client-react";

const money = (amount: string) => `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function IncentiveHistory({ periodId, employeeId }: { periodId: string; employeeId: string }) {
  const history = useListPayrollIncentiveChanges(periodId, employeeId, {
    query: { queryKey: getListPayrollIncentiveChangesQueryKey(periodId, employeeId), staleTime: 0, refetchOnMount: "always", refetchInterval: 30_000 },
  });
  return (
    <section aria-label="Incentive change history" className="space-y-3 border-t pt-4 text-sm">
      <h3 className="font-semibold">Change history</h3>
      <p className="text-xs text-muted-foreground">For this employee and payroll period. Changes made before history was introduced are not available.</p>
      {history.isLoading ? <p role="status">Loading history…</p>
        : history.isError ? <div role="alert"><p>Unable to load incentive history.</p><button type="button" className="min-h-11 underline" onClick={() => void history.refetch()}>Retry history</button></div>
        : history.data?.length === 0 ? <p className="text-muted-foreground">No incentive changes recorded.</p>
        : <ol className="space-y-3">{history.data?.map((change) => (
          <li key={change.id} className="space-y-2 rounded-md border p-3">
            <p className="break-words font-semibold">{change.editedByName}</p>
            <p className="break-all text-xs text-muted-foreground">Editor ID: {change.editedBy}</p>
            <time className="block text-xs text-muted-foreground" dateTime={new Date(change.createdAt).toISOString()}>
              {new Date(change.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "medium" })} PHT
            </time>
            <dl className="space-y-2">
              <div><dt className="font-medium">Before</dt><dd>{change.previousWeeklyAmount === null ? "No incentive recorded" : `${money(change.previousWeeklyAmount)} per week × ${change.previousWeeks} week(s)`}</dd>
                {change.previousWeeklyAmount !== null && <dd className="whitespace-pre-wrap break-words text-muted-foreground">Note: {change.previousNote || "None"}</dd>}</div>
              <div><dt className="font-medium">After</dt><dd>{money(change.newWeeklyAmount)} per week × {change.newWeeks} week(s)</dd>
                <dd className="whitespace-pre-wrap break-words text-muted-foreground">Note: {change.newNote || "None"}</dd></div>
            </dl>
          </li>
        ))}</ol>}
    </section>
  );
}
