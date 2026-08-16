import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarClock,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  ScanFace,
  User,
  ShieldAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { AndroidBackHandler } from "@/components/mobile/AndroidBackHandler";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

const STUDENT_NAV: NavItem[] = [
  { label: "Dashboard", to: "/student/dashboard", icon: LayoutDashboard },
  { label: "History", to: "/student/history", icon: History },
  { label: "Courses", to: "/student/courses", icon: BookOpen },
  { label: "Profile", to: "/student/profile", icon: User },
];

const LECTURER_NAV: NavItem[] = [
  { label: "Dashboard", to: "/lecturer/dashboard", icon: LayoutDashboard },
  { label: "Create Session", to: "/lecturer/create-session", icon: PlusCircle },
  { label: "Sessions", to: "/lecturer/sessions", icon: ClipboardList },
  { label: "Courses", to: "/lecturer/courses", icon: BookOpen },
  { label: "Profile", to: "/lecturer/profile", icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", to: "/admin/dashboard", icon: ShieldAlert },
];

export function AppShell({
  role,
  title,
  children,
}: {
  role: Role;
  title: string;
  children: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = role === "admin" ? ADMIN_NAV : role === "student" ? STUDENT_NAV : LECTURER_NAV;

  const handleSignOut = () => {
    signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <>
      <AndroidBackHandler />
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="rounded-lg bg-sidebar-accent p-2 text-sidebar-primary">
            <ScanFace className="h-5 w-5" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-sidebar-accent-foreground">
              Smart Campus
            </p>
            <p className="text-xs text-sidebar-foreground/70">Presence</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main navigation">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border px-3 py-4">
          <Link
            to="/overview"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <CalendarClock className="h-4 w-4" aria-hidden />
            System Overview
          </Link>
          <button
            onClick={handleSignOut}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:px-8">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground md:text-base">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge tone="info" className="hidden capitalize sm:flex">
              {role}
            </StatusBadge>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="hidden sm:flex">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="sm:hidden"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-32 pt-5 md:px-8 md:pb-10">
          <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
        </main>

        <nav
          className="fixed bottom-6 left-4 right-4 z-40 flex items-center justify-around rounded-full bg-foreground/95 p-2 px-4 shadow-2xl backdrop-blur md:hidden"
          aria-label="Mobile navigation"
        >
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-12 flex-col items-center justify-center gap-1 rounded-full px-3 text-[10px] font-medium transition-all active:scale-95",
                  active ? "bg-background text-foreground shadow-sm" : "text-background/70 hover:text-background",
                )}
              >
                <item.icon className="h-5 w-5" aria-hidden />
                <span className={cn(active ? "block" : "hidden sm:block")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      </div>
    </>
  );
}
