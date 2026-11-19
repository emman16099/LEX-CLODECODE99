import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@workspace/replit-auth-web";
import { useAppUser } from "@/hooks/useAppUser";
import { Layout } from "@/components/Layout";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/Login";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminEmployees from "@/pages/admin/Employees";
import AdminEmployeeForm from "@/pages/admin/EmployeeForm";
import AdminAttendanceRules from "@/pages/admin/AttendanceRules";
import AdminAttendanceLogs from "@/pages/admin/AttendanceLogs";
import AdminDatabaseInspect from "@/pages/admin/DatabaseInspect";
import AdminPayroll from "@/pages/admin/Payroll";
import AdminPayrollDetail from "@/pages/admin/PayrollDetail";
import AdminOvertime from "@/pages/admin/Overtime";
import EmployeeDashboard from "@/pages/employee/Dashboard";
import EmployeeHistory from "@/pages/employee/AttendanceHistory";
import EmployeePayrollHistory from "@/pages/employee/PayrollHistory";
import AdminWork from "@/pages/admin/Work";
import AdminCashAdvances from "@/pages/admin/CashAdvances";
import EmployeeWork from "@/pages/employee/Work";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedRoute({
  children,
  requireRole,
}: {
  children: React.ReactNode;
  requireRole?: "admin" | "employee";
}) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { appUser, isLoading: profileLoading } = useAppUser(isAuthenticated);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (requireRole && appUser?.role !== requireRole) {
    if (appUser?.role === "admin") return <Redirect to="/admin/dashboard" />;
    return <Redirect to="/employee/dashboard" />;
  }

  return <Layout>{children}</Layout>;
}

function RootRedirect() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { appUser, isLoading: profileLoading } = useAppUser(isAuthenticated);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm animate-pulse">Loading LEXIEBOSS...</div>
      </div>
    );
  }

  if (!isAuthenticated) return <Redirect to="/login" />;
  if (appUser?.role === "admin") return <Redirect to="/admin/dashboard" />;
  return <Redirect to="/employee/dashboard" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={LoginPage} />

      <Route path="/admin/dashboard">
        <ProtectedRoute requireRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/employees/new">
        <ProtectedRoute requireRole="admin">
          <AdminEmployeeForm />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/employees/:id">
        {(params) => (
          <ProtectedRoute requireRole="admin">
            <AdminEmployeeForm employeeId={params.id} />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/employees">
        <ProtectedRoute requireRole="admin">
          <AdminEmployees />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/attendance-rules">
        <ProtectedRoute requireRole="admin">
          <AdminAttendanceRules />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/attendance">
        <ProtectedRoute requireRole="admin">
          <AdminAttendanceLogs />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/database">
        <ProtectedRoute requireRole="admin">
          <AdminDatabaseInspect />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payroll/:id">
        {(params) => (
          <ProtectedRoute requireRole="admin">
            <AdminPayrollDetail key={params.id} />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/payroll">
        <ProtectedRoute requireRole="admin">
          <AdminPayroll />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/overtime">
        <ProtectedRoute requireRole="admin">
          <AdminOvertime />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/cash-advances">
        <ProtectedRoute requireRole="admin">
          <AdminCashAdvances />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/work">
        <ProtectedRoute requireRole="admin"><AdminWork /></ProtectedRoute>
      </Route>

      <Route path="/employee/dashboard">
        <ProtectedRoute requireRole="employee">
          <EmployeeDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/employee/attendance">
        <ProtectedRoute requireRole="employee">
          <EmployeeHistory />
        </ProtectedRoute>
      </Route>
      <Route path="/employee/payroll">
        <ProtectedRoute requireRole="employee">
          <EmployeePayrollHistory />
        </ProtectedRoute>
      </Route>
      <Route path="/employee/work">
        <ProtectedRoute requireRole="employee"><EmployeeWork /></ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
