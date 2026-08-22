import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarClock,
  History,
  LayoutDashboard,
  LogOut,
  Plus,
  ScanFace,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { AndroidBackHandler } from "@/components/mobile/AndroidBackHandler";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

interface NavItem {
  label: string;
  mobileLabel?: string;
  to: string;
  icon: LucideIcon;
  isHero?: boolean;
}

const STUDENT_NAV: NavItem[] = [
  { label: "Dashboard", to: "/student/dashboard", icon: LayoutDashboard },
  { label: "History", to: "/student/history", icon: History },
  { label: "Check-in", to: "/student/dashboard", icon: Plus, isHero: true },
  { label: "Courses", to: "/student/courses", icon: BookOpen },
  { label: "Profile", to: "/student/profile", icon: User },
];

const LECTURER_NAV: NavItem[] = [
  { label: "Dashboard", to: "/lecturer/dashboard", icon: LayoutDashboard },
  { label: "Sessions", to: "/lecturer/sessions", icon: History },
  {
    label: "New Session",
    mobileLabel: "Create",
    to: "/lecturer/create-session",
    icon: Plus,
    isHero: true,
  },
  { label: "Courses", to: "/lecturer/courses", icon: BookOpen },
  { label: "Profile", to: "/lecturer/profile", icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Overview", to: "/overview", icon: CalendarClock },
];

interface AppShellProps {
  children: ReactNode;
  role: Role;
  title: string;
}

export function AppShell({ children, role, title }: AppShellProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  const nav = role === "admin" ? ADMIN_NAV : role === "student" ? STUDENT_NAV : LECTURER_NAV;

  const confirmSignOut = async () => {
    setShowSignOutDialog(false);
    await signOut();
    toast.success("Signed out successfully");
    navigate({ to: "/login", replace: true });
  };

  return (
    <>
      <AndroidBackHandler />
      <div className="flex min-h-screen w-full bg-background">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
          <div className="flex items-center gap-2 px-5 py-5">
            <span className="rounded-lg bg-sidebar-accent p-2 text-sidebar-primary">
              <ScanFace className="h-5 w-5" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">
                Smart Attendance
              </p>
              <p className="text-[11px] text-sidebar-foreground/70 font-medium">
                Presence & Ledger
              </p>
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
              onClick={() => setShowSignOutDialog(true)}
              className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground cursor-pointer"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:px-8">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground md:text-base">{title}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.name}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <NotificationCenter />
              <StatusBadge tone="info" className="hidden capitalize sm:flex">
                {role}
              </StatusBadge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSignOutDialog(true)}
                className="hidden sm:flex rounded-xl text-xs"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSignOutDialog(true)}
                className="sm:hidden"
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
          </header>

          <main className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10">
            <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
          </main>

          {/* Compact FinTech Frosted Bottom Bar with Center Hero (+) Button */}
          <nav
            className="fixed bottom-0 left-0 right-0 z-40 rounded-t-[30px] rounded-b-none border-t border-x border-border/80 bg-slate-100/95 dark:bg-zinc-900/95 px-2 pt-1 pb-[max(0.55rem,env(safe-area-inset-bottom))] shadow-[0_-10px_35px_rgba(0,0,0,0.08)] dark:shadow-[0_-10px_35px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:hidden"
            aria-label="Mobile navigation"
          >
            <div className="mx-auto flex max-w-sm items-center justify-between">
              {nav.map((item) => {
                const active = pathname.startsWith(item.to);

                if (item.isHero) {
                  return (
                    <div
                      key={item.to}
                      className="relative -top-3.5 flex flex-col items-center justify-center shrink-0 px-1"
                    >
                      <Link
                        to={item.to}
                        className="group flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/35 ring-[3.5px] ring-slate-100 dark:ring-zinc-900 transition-all duration-200 active:scale-90 hover:scale-105"
                        aria-label={item.label}
                      >
                        <item.icon className="h-5 w-5 stroke-[2.5] transition-transform duration-300 group-hover:rotate-90" />
                      </Link>
                      <span className="mt-0.5 text-[9.5px] font-bold text-foreground leading-none">
                        {item.mobileLabel ?? item.label}
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "group relative flex flex-1 flex-col items-center justify-center py-0.5 transition-all duration-200 active:scale-90",
                      active
                        ? "text-primary font-bold"
                        : "text-muted-foreground/80 hover:text-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "relative flex h-6 w-9 items-center justify-center rounded-xl transition-all duration-200",
                        active
                          ? "bg-primary/15 dark:bg-primary/25 text-primary shadow-xs"
                          : "group-hover:bg-muted/50",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 transition-all duration-200",
                          active
                            ? "stroke-[2.25] scale-105 text-primary"
                            : "stroke-[1.75] opacity-80",
                        )}
                        aria-hidden
                      />
                    </div>

                    <span
                      className={cn(
                        "mt-0.5 text-[9.5px] tracking-tight leading-none transition-all duration-200",
                        active ? "font-bold text-primary" : "font-medium text-muted-foreground/80",
                      )}
                    >
                      {item.mobileLabel ?? item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* Explicit Sign Out Confirmation Modal */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground">
              Sign out of Smart Attendance?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              You will be signed out of this device. You can sign back in at any time with your
              credentials.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row items-center justify-end gap-2 pt-2">
            <AlertDialogCancel className="rounded-xl text-xs mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSignOut}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold"
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
