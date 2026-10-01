import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, Building2, Users, CreditCard,
  DollarSign, LogOut, ChevronRight,   Shield, Images, Layers, Gauge, Factory,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { readLocalAuth, logout } from "@/lib/api";

const NAV_ITEMS = [
  { label: "Overview",      path: "/",             icon: LayoutDashboard, exact: true },
  { label: "Districts",     path: "/districts",    icon: Building2 },
  { label: "Users",         path: "/users",        icon: Users },
  { label: "Subscriptions", path: "/subscriptions",icon: CreditCard },
  { label: "Pricing",       path: "/pricing",      icon: DollarSign },
  { label: "API limits",    path: "/rate-limit",   icon: Gauge },
  { label: "Image Library", path: "/library",      icon: Images },
  { label: "Library Catalog", path: "/library/catalog", icon: Layers },
  { label: "Image Factory", path: "/images/factory", icon: Factory },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const [location] = useLocation();
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const { userType, token } = readLocalAuth();
    if (!token || userType !== "super_admin") {
      window.location.href = "/login";
    } else {
      setAuthorized(true);
    }
    setReady(true);
  }, []);

  if (!ready || !authorized) return null;

  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar — deep dark navy */}
      <aside
        className="w-60 shrink-0 flex flex-col"
        style={{ background: "hsl(222,47%,11%)" }}
      >
        {/* Brand */}
        <div className="px-5 py-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "hsl(243,75%,59%)" }}>
            <Shield className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none">ACCESS Ready</p>
            <p className="text-white/40 text-[11px] mt-0.5 leading-none">Super Admin</p>
          </div>
        </div>

        <div className="mx-4 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.25)" }}>
            Management
          </p>
          {NAV_ITEMS.map(({ label, path, icon: Icon, exact }) => {
            const isActive = exact ? location === path : location.startsWith(path);
            return (
              <Link key={path} href={path}>
                <a className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-100 group",
                  isActive
                    ? "text-white"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5",
                )}
                  style={isActive ? { background: "rgba(255,255,255,0.10)" } : undefined}
                >
                  <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-white/40 group-hover:text-white/60")} />
                  {label}
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "hsl(243,75%,70%)" }} />
                  )}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-5">
          <div className="h-px mb-4 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.75)";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.4)";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-card border-b border-border px-8 py-4 flex items-center">
          <div>
            <h2 className="text-lg font-semibold text-foreground leading-none">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
        </header>

        <main className="flex-1 overflow-auto px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
