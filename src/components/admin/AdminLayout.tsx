import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  BarChart3,
  Bell,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import logoUrl from "@/assets/hayatbridge-logo.jpeg";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminOverview } from "@/lib/admin.functions";
import { useIdleLogout } from "@/components/admin/useIdleLogout";

const menu = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/patients", label: "Patients", icon: Users },
  { to: "/admin/clinicians", label: "Clinicians", icon: ShieldCheck },
  { to: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/activity-logs", label: "Activity Logs", icon: Activity },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 p-3">
      {menu.map((item) => {
        const exact = "exact" in item && item.exact;
        const active = exact ? path === item.to : path.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-primary-soft hover:text-primary"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState("");

  const overviewFn = useServerFn(adminOverview);
  const { data: overview } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => overviewFn(),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin-login", replace: true });
  };

  useIdleLogout(signOut, 15 * 60 * 1000);

  const openFeedback = overview?.openFeedback ?? 0;

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex items-center gap-2 border-b border-border p-4">
                <img src={logoUrl} alt="HayatBridge logo" className="h-8 w-8 object-contain" />
                <span className="text-sm font-semibold">HayatBridge Admin</span>
              </div>
              <NavList onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link to="/admin" className="flex items-center gap-2">
            <img src={logoUrl} alt="HayatBridge logo" width={36} height={36} className="h-9 w-9 object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">HayatBridge</div>
              <div className="text-[11px] font-medium text-muted-foreground">Administration console</div>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link to="/admin/feedback" className="relative rounded-lg p-2 hover:bg-muted" aria-label="Notifications">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {openFeedback > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                  {openFeedback}
                </span>
              )}
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {(email || "A").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden text-left text-xs sm:block">
                    <span className="block font-semibold">Administrator</span>
                    <span className="block text-muted-foreground">{email}</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{email || "Administrator"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin/settings">Account settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={signOut}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={signOut} className="hidden sm:inline-flex">
              <LogOut className="mr-1.5 h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-border bg-card lg:block">
          <NavList />
          <div className="mx-3 mt-4 rounded-lg bg-success/10 p-3 text-xs text-foreground">
            <p className="font-semibold text-success">Secure session</p>
            <p className="mt-1 text-muted-foreground">You are signed out automatically after 15 minutes of inactivity.</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
