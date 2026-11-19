import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { Redirect, useLocation } from "wouter";
import { CheckCircle2, QrCode } from "lucide-react";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"admin" | "employee">("employee");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const endpoint = tab === "admin" ? "/api/auth/admin-login" : "/api/auth/employee-login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Login failed");
        return;
      }
      navigate("/");
      window.location.reload();
    } catch {
      setError("Network error, please try again");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoading && isAuthenticated) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-sidebar flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm bg-secondary flex items-center justify-center">
            <span className="text-sm font-black text-secondary-foreground">LB</span>
          </div>
          <div>
            <div className="text-lg font-bold text-white tracking-wide">LEXIEBOSS</div>
            <div className="text-[11px] text-white/50 uppercase tracking-widest">Lexiewood</div>
          </div>
        </div>

        <div>
          <blockquote className="text-white/80 text-xl font-light leading-relaxed mb-8">
            "Workforce operations, managed with clarity."
          </blockquote>
          <div className="space-y-3">
            {[
              "Real-time clock in / clock out",
              "Gate QR-verified attendance records",
              "Admin dashboard with daily summaries",
              "Employee records &amp; shift management",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-white/60 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary flex-shrink-0" />
                <span dangerouslySetInnerHTML={{ __html: item }} />
              </div>
            ))}
          </div>
        </div>

        <div className="text-white/30 text-xs">
          &copy; {new Date().getFullYear()} Lexiewood. Internal use only.
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-sm bg-primary flex items-center justify-center">
              <span className="text-xs font-black text-primary-foreground">LB</span>
            </div>
            <div>
              <div className="text-base font-bold text-foreground tracking-wide">LEXIEBOSS</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Lexiewood</div>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Sign in to access the Lexiewood HR portal.
          </p>

          {/* Tabs */}
          <div className="flex rounded-md border border-input mb-6 overflow-hidden">
            <button
              onClick={() => { setTab("employee"); setError(""); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === "employee"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              Employee
            </button>
            <button
              onClick={() => { setTab("admin"); setError(""); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === "admin"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              Admin
            </button>
          </div>

          {tab === "employee" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-1 text-xs font-semibold">
                <div className="flex items-center justify-center gap-1.5 rounded bg-background px-3 py-2 text-foreground shadow-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  1. Login
                </div>
                <div className="flex items-center justify-center gap-1.5 rounded px-3 py-2 text-muted-foreground">
                  <QrCode className="h-3.5 w-3.5" />
                  2. Time In / Out QR
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <strong>Employee login.</strong> Enter your username and 4-digit PIN. After signing in, scan the office QR to clock in or out.
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Enter your username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    4-Digit PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    required
                    className="w-full px-3 py-2.5 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Enter your 4-digit PIN"
                  />
                </div>
                {error && (
                  <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting || isLoading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-md transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? "Signing in…" : "Sign In"}
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter admin username"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  4-Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  required
                  className="w-full px-3 py-2.5 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your 4-digit PIN"
                />
              </div>
              {error && (
                <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || isLoading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-6 rounded-md transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Signing in…" : "Sign In"}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-muted-foreground mt-6">
            Access is restricted to authorized Lexiewood personnel only.
          </p>
        </div>
      </div>
    </div>
  );
}
