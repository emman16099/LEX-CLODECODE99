import { useState } from "react";
import { Link } from "wouter";
import {
  useListEmployees,
  useDeleteEmployee,
  useSetEmployeeCredentials,
  getListEmployeesQueryKey,
  getGetEmployeeQueryKey,
  useGetGateQr,
  type ListEmployeesStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, ChevronRight, KeyRound, QrCode, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-muted text-muted-foreground",
  terminated: "bg-red-100 text-red-700",
};

interface CredDialog {
  employeeId: string;
  employeeName: string;
  currentUsername: string | null | undefined;
}

export default function AdminEmployees() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [credDialog, setCredDialog] = useState<CredDialog | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [credUsername, setCredUsername] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [credConfirm, setCredConfirm] = useState("");
  const [credError, setCredError] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees, isLoading } = useListEmployees(
    { search: search || undefined, status: (status || undefined) as ListEmployeesStatus | undefined },
  );
  const { data: gateQr } = useGetGateQr();

  const deleteMutation = useDeleteEmployee({
    mutation: {
      onSuccess: () => {
        setStatus("active");
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        toast({
          title: "Employee archived",
          description: "The employee was removed from the current list. Historical payroll and work records were preserved.",
        });
      },
      onError: (error) => {
        const requestError = error as { data?: { error?: string }; message?: string };
        toast({
          title: "Unable to archive employee",
          description: requestError.data?.error ?? requestError.message ?? "Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  const credentialsMutation = useSetEmployeeCredentials({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        if (credDialog) {
          queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(credDialog.employeeId) });
        }
        toast({ title: `Credentials saved — username: ${data.username}` });
        closeCredDialog();
      },
      onError: () => {
        setCredError("Failed to save credentials. Username may already be taken.");
      },
    },
  });

  const openCredDialog = (emp: CredDialog) => {
    setCredDialog(emp);
    setCredUsername(emp.currentUsername ?? "");
    setCredPassword("");
    setCredConfirm("");
    setCredError("");
  };

  const closeCredDialog = () => {
    setCredDialog(null);
    setCredUsername("");
    setCredPassword("");
    setCredConfirm("");
    setCredError("");
  };

  const handleCredSave = () => {
    if (!credDialog) return;
    setCredError("");
    if (!credUsername.trim() || credUsername.trim().length < 3) {
      setCredError("Username must be at least 3 characters.");
      return;
    }
    if (!/^\d{4}$/.test(credPassword)) {
      setCredError("PIN must be exactly 4 digits.");
      return;
    }
    if (credPassword !== credConfirm) {
      setCredError("PINs do not match.");
      return;
    }
    credentialsMutation.mutate({
      id: credDialog.employeeId,
      data: { username: credUsername.trim(), password: credPassword },
    });
  };

  const gateQrUrl = gateQr?.token
    ? new URL(
        `${import.meta.env.BASE_URL.replace(/\/$/, "")}/login?gate=${encodeURIComponent(gateQr.token)}`,
        window.location.origin,
      ).toString()
    : "";

  return (
    <div className="page-container">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {employees?.length ?? 0} record{employees?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => setQrDialogOpen(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 sm:px-4"
          >
            <QrCode className="w-4 h-4" />
            Gate QR
          </button>
          <Link
            href="/admin/employees/new"
            className="flex shrink-0 items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full sm:w-auto text-sm border border-input rounded-md bg-background text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="active">Current employees</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
          <option value="">All statuses</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="table-scroll">
        <table className="min-w-[700px] w-full text-sm">
          <thead>
            <tr className="border-b border-card-border bg-muted/30">
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Code</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Name</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Mobile</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Portal Login</th>
              <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !employees?.length ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground text-sm">
                  No employees found.{" "}
                  <Link href="/admin/employees/new" className="text-primary underline underline-offset-2">
                    Add the first one.
                  </Link>
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{emp.employeeCode}</td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/employees/${emp.id}`} className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1 group/link">
                      {emp.firstName} {emp.lastName}
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{emp.mobileNumber}</td>

                  {/* Portal Login column */}
                  <td className="px-5 py-3 hidden lg:table-cell">
                    {emp.portalUsername ? (
                      <span className="font-mono text-xs text-foreground bg-muted/60 border border-border px-2 py-0.5 rounded">
                        {emp.portalUsername}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No login set</span>
                    )}
                  </td>

                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[emp.employmentStatus] ?? ""}`}>
                      {emp.employmentStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Set / reset PIN */}
                      <button
                        onClick={() => openCredDialog({
                          employeeId: emp.id,
                          employeeName: `${emp.firstName} ${emp.lastName}`,
                          currentUsername: emp.portalUsername,
                        })}
                        title={emp.portalUsername ? "Reset PIN" : "Set login PIN"}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <Link
                        href={`/admin/employees/${emp.id}`}
                        aria-label={`Edit ${emp.firstName} ${emp.lastName}`}
                        title="Edit employee"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Link>
                      {emp.employmentStatus !== "terminated" && (
                        <button
                          type="button"
                          aria-label={`Archive ${emp.firstName} ${emp.lastName}`}
                          title="Archive employee"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (confirm(`Archive ${emp.firstName} ${emp.lastName}? Their payroll and work history will be preserved.`)) {
                              deleteMutation.mutate({ id: emp.id });
                            }
                          }}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:cursor-wait disabled:opacity-60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Credentials dialog */}
      {credDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeCredDialog} />
          <div className="relative bg-card border border-card-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  {credDialog.currentUsername ? "Reset PIN" : "Set Login PIN"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{credDialog.employeeName}</p>
              </div>
              <button
                type="button"
                onClick={closeCredDialog}
                aria-label="Close credentials dialog"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Username <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={credUsername}
                  onChange={(e) => setCredUsername(e.target.value)}
                  placeholder="e.g. maria.santos"
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

                  {/* New PIN */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      4-Digit PIN <span className="text-destructive">*</span>
                </label>
                <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      maxLength={4}
                  autoComplete="new-password"
                  value={credPassword}
                      onChange={(e) => setCredPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="Enter 4 digits"
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                      Use exactly 4 numbers. Share the PIN with the employee through a secure channel.
                </p>
              </div>

                  {/* Confirm PIN */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Confirm PIN <span className="text-destructive">*</span>
                </label>
                <input
                  type="password"
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      maxLength={4}
                  autoComplete="new-password"
                  value={credConfirm}
                      onChange={(e) => setCredConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="Repeat 4-digit PIN"
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {credError && (
                <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{credError}</p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCredSave}
                disabled={credentialsMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                <KeyRound className="w-3.5 h-3.5" />
                {credentialsMutation.isPending ? "Saving…" : "Save Credentials"}
              </button>
              <button
                onClick={closeCredDialog}
                className="px-4 py-2 text-sm border border-input rounded-md text-foreground hover:bg-muted/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {qrDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setQrDialogOpen(false)} />
          <div className="gate-qr-print relative w-full max-w-sm rounded-xl border border-card-border bg-card p-6 text-center shadow-2xl">
            <button
              onClick={() => setQrDialogOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Close gate QR"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <QrCode className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold text-foreground">Office Gate QR</h2>
            <p className="mt-1 text-xs text-muted-foreground">Print and post this single QR code at the office gate.</p>
            <div className="mx-auto my-5 w-fit rounded-xl border border-border bg-white p-4">
              {gateQrUrl ? (
                <QRCodeSVG
                  value={gateQrUrl}
                  size={220}
                  level="M"
                  marginSize={1}
                  title="LEXIEBOSS office gate QR"
                />
              ) : (
                <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-muted-foreground">
                  Loading gate QR…
                </div>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Employees scan this same code before signing in and before every clock-in or clock-out. Their username and 4-digit PIN still identify them.
            </p>
            <button
              onClick={() => window.print()}
              className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 print:hidden"
            >
              Print Gate QR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
