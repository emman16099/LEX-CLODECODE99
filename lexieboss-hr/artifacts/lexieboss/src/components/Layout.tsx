import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useAppUser } from "@/hooks/useAppUser";
import {
  LayoutDashboard,
  Users,
  Clock,
  Settings,
  LogOut,
  ChevronRight,
  CalendarClock,
  History,
  Database,
  Banknote,
  Timer,
  BriefcaseBusiness,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/attendance", label: "Attendance", icon: Clock },
  { href: "/admin/attendance-rules", label: "Shift Rules", icon: Settings },
  { href: "/admin/overtime", label: "Overtime", icon: Timer },
  { href: "/admin/work", label: "Work Coaching", icon: BriefcaseBusiness },
  { href: "/admin/cash-advances", label: "Cash Advances", icon: Banknote },
  { href: "/admin/payroll", label: "Payroll", icon: Banknote },
  { href: "/admin/database", label: "Database", icon: Database },
];

const employeeNav: NavItem[] = [
  { href: "/employee/dashboard", label: "Clock In / Out", icon: CalendarClock },
  { href: "/employee/attendance", label: "My History", icon: History },
  { href: "/employee/payroll", label: "My Payroll", icon: Banknote },
  { href: "/employee/work", label: "My Work Today", icon: BriefcaseBusiness },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user, logout } = useAuth();
  const { appUser, isAdmin } = useAppUser();
  const nav = isAdmin ? adminNav : employeeNav;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  const navigation = (
    <nav className="min-h-0 flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {nav.map((item) => {
        const active = location.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors group",
              active
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white",
            )}
          >
            <item.icon className={cn("w-4 h-4", active ? "text-secondary" : "text-sidebar-foreground/50 group-hover:text-secondary/80")} />
            {item.label}
            {active && <ChevronRight className="w-3 h-3 ml-auto text-secondary/70" />}
          </Link>
        );
      })}
    </nav>
  );

  const userFooter = (
    <div className="px-3 py-3 border-t border-sidebar-border">
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-md">
        {user?.profileImageUrl ? (
          <img src={user.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-white">
              {user?.firstName?.[0] ?? user?.email?.[0] ?? "?"}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-white truncate">
            {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.email ?? "User"}
          </div>
          <div className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
            {appUser?.role ?? "—"}
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="flex min-h-10 min-w-10 items-center justify-center text-sidebar-foreground/40 hover:text-destructive transition-colors ml-1"
          title="Log out"
          aria-label="Log out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-sidebar flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-sm bg-secondary flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-black text-secondary-foreground">LB</span>
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-wide">LEXIEBOSS</div>
              <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">Lexiewood</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        {navigation}

        {/* User footer */}
        {userFooter}
      </aside>

      {/* Mobile navigation */}
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Dismiss navigation overlay"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside
        aria-label="Mobile navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-2xl transition-transform duration-200 lg:hidden",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-sm bg-secondary">
              <span className="text-xs font-black text-secondary-foreground">LB</span>
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide text-white">LEXIEBOSS</div>
              <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Lexiewood</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="flex min-h-10 min-w-10 items-center justify-center text-sidebar-foreground/70 hover:text-white"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {navigation}
        {userFooter}
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-foreground hover:bg-muted"
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary">
              <span className="text-xs font-black text-primary-foreground">LB</span>
            </div>
            <span className="text-sm font-bold tracking-wide text-foreground">LEXIEBOSS</span>
          </div>
          <div className="w-11" aria-hidden="true" />
        </header>
        {children}
      </main>
    </div>
  );
}
