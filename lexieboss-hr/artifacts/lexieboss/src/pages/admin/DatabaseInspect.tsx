import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Database, RefreshCw, Sprout, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TableStat {
  name: string;
  count: number;
}

interface EmployeeRow {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  employmentStatus: string;
  dailyRate: string;
  portalUsername: string | null;
  hasCredentials: boolean;
  createdAt: string;
}

interface AppUserRow {
  id: string;
  replitId: string;
  replitUsername: string | null;
  role: string;
  employeeId: string | null;
  createdAt: string;
}

interface DbStats {
  tables: TableStat[];
  employees: EmployeeRow[];
  appUsers: AppUserRow[];
}

interface SeedResult {
  created: string[];
  skipped: number;
  message: string;
}

async function fetchDbStats(): Promise<DbStats> {
  const res = await fetch("/api/admin/db-stats", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch DB stats");
  return res.json();
}

async function runSeed(): Promise<SeedResult> {
  const res = await fetch("/api/admin/seed", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Seed failed");
  return res.json();
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-amber-100 text-amber-700",
  terminated: "bg-red-100 text-red-700",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-primary/10 text-primary",
  employee: "bg-muted text-muted-foreground",
};

export default function DatabaseInspect() {
  const { toast } = useToast();
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<DbStats>({
    queryKey: ["admin-db-stats"],
    queryFn: fetchDbStats,
  });

  const seedMutation = useMutation({
    mutationFn: runSeed,
    onSuccess: (result) => {
      setSeedResult(result);
      toast({ title: result.message });
      refetch();
    },
    onError: () => {
      toast({ title: "Seed failed", variant: "destructive" });
    },
  });
  const tables = Array.isArray(data?.tables) ? data.tables : [];
  const employees = Array.isArray(data?.employees) ? data.employees : [];
  const appUsers = Array.isArray(data?.appUsers) ? data.appUsers : [];

  return (
    <div className="page-container space-y-6">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-5 h-5 text-muted-foreground" />
            Database Inspector
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live view of all tables and records. Admin only.
          </p>
        </div>
        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-input rounded-md text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
          >
            <Sprout className="w-4 h-4 text-emerald-600" />
            {seedMutation.isPending ? "Seeding…" : "Seed Sample Employees"}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-input rounded-md text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {seedResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800">
          {seedResult.message}
          {seedResult.created.length > 0 && (
            <div className="mt-1 text-xs text-emerald-700">
              Default 4-digit PIN for newly seeded employees: <span className="font-mono font-semibold">2024</span>
            </div>
          )}
        </div>
      )}

      {/* Table counts */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Table Row Counts</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {isLoading
            ? [...Array(7)].map((_, i) => (
                <div key={i} className="bg-card border border-card-border rounded-lg p-4 animate-pulse h-16" />
              ))
            : tables.map((t) => (
                <div key={t.name} className="bg-card border border-card-border rounded-lg p-4">
                  <div className="text-2xl font-bold text-foreground tabular-nums">{t.count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">{t.name}</div>
                </div>
              ))}
        </div>
      </div>

      {/* Employees */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Employees ({employees.length})
        </h2>
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
           <div className="table-scroll"><table className="min-w-[620px] w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-muted/30">
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Code</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Daily Rate</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Portal Login</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !employees.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No employees. Click "Seed Sample Employees" to add test data.
                  </td>
                </tr>
              ) : (
                employees.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{e.employeeCode}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {e.firstName} {e.lastName}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[e.employmentStatus] ?? "bg-muted text-muted-foreground"}`}>
                        {e.employmentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      ₱{Number(e.dailyRate).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {e.hasCredentials ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          <span className="font-mono text-xs text-foreground">{e.portalUsername}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="text-xs">Not set</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="font-mono text-xs text-muted-foreground">{e.id.slice(0, 8)}…</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
           </table></div>
        </div>
      </div>

      {/* App Users */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          App Users ({appUsers.length})
        </h2>
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
           <div className="table-scroll"><table className="min-w-[540px] w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-muted/30">
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Username / Portal ID</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Linked Employee</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Replit ID (internal)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                [...Array(2)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(4)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !appUsers.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No app users yet.
                  </td>
                </tr>
              ) : (
                appUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {u.replitUsername ?? <span className="text-muted-foreground italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell font-mono">
                      {u.employeeId ? u.employeeId.slice(0, 8) + "…" : <span className="italic">none</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell font-mono">
                      {u.replitId.slice(0, 12)}…
                    </td>
                  </tr>
                ))
              )}
            </tbody>
           </table></div>
        </div>
      </div>
    </div>
  );
}
