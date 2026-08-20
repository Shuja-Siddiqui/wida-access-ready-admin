import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { apiRequest, ApiError } from "@/lib/api";
import { Shield, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";

interface LoginResponse {
  token: string;
  userType: string;
}

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiRequest<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, role: "administrator" }),
      });
      const { token, userType } = res;
      if (userType !== "super_admin") {
        setError("This portal is restricted to super admins only.");
        return;
      }
      localStorage.setItem("authToken", token);
      localStorage.setItem("userType", userType);
      setLocation("/");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError("Incorrect email or password.");
        else if (err.status === 403) setError("Please verify your email before signing in.");
        else setError(err.message || "Sign in failed. Please try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — dark brand panel */}
      <div
        className="hidden lg:flex w-[400px] shrink-0 flex-col justify-between p-10"
        style={{ background: "hsl(222,47%,11%)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "hsl(243,75%,59%)" }}>
            <Shield className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none">ACCESS Ready</p>
            <p className="text-white/40 text-xs mt-0.5">Super Admin Portal</p>
          </div>
        </div>

        <div>
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-6"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-white/50 text-xs font-medium">Secure admin access</span>
          </div>
          <h2 className="text-3xl font-semibold text-white leading-snug mb-3">
            Platform<br />Control Center
          </h2>
          <p className="text-white/40 text-sm leading-relaxed">
            Manage districts, users, subscriptions, and pricing across the entire ACCESS Ready platform.
          </p>
        </div>

        <div className="space-y-3">
          {[
            { label: "Multi-district management" },
            { label: "Real-time subscription tracking" },
            { label: "Dynamic pricing controls" },
            { label: "Full user administration" },
          ].map(({ label }) => (
            <div key={label} className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(99,102,241,0.2)" }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(243,75%,70%)" }} />
              </div>
              <span className="text-white/40 text-sm">{label}</span>
            </div>
          ))}
          <p className="pt-4 text-white/20 text-xs">
            ACCESS Ready · Fugees Family Inc. · {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* Right — sign-in form */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[360px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "hsl(243,75%,59%)" }}>
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="text-foreground text-sm font-semibold">ACCESS Ready</p>
              <p className="text-muted-foreground text-xs">Super Admin Portal</p>
            </div>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-semibold text-foreground">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your admin credentials to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full rounded-md border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full rounded-md border border-border bg-card px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/8 border border-destructive/20 px-3.5 py-2.5">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-60 hover:opacity-90"
              style={{ background: "hsl(243,75%,59%)" }}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                : <>Sign in <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
