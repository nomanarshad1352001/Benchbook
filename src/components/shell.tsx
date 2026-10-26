"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  FileSignature,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings2,
  Users,
  Wrench,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ops } from "@/lib/store";

export type ShellUser = {
  id: number; name: string; email: string; role: "admin" | "office" | "field";
  color: string; avatarUrl: string | null; phone: string | null;
};
type TeamMember = { id: number; name: string; role: string; color: string; avatarUrl: string | null };

const NAV: { href: string; label: string; icon: LucideIcon; roles: string[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "office", "field"] },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare, roles: ["admin", "office", "field"] },
  { href: "/clients", label: "Clients", icon: Users, roles: ["admin", "office", "field"] },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["admin", "office", "field"] },
  { href: "/forms", label: "Forms & signatures", icon: FileSignature, roles: ["admin", "office", "field"] },
  { href: "/docs", label: "API reference", icon: BookOpen, roles: ["admin", "office"] },
  { href: "/settings", label: "Settings", icon: Settings2, roles: ["admin", "office"] },
];

const TITLES: [string, string][] = [
  ["/dashboard", "Dashboard"],
  ["/pipeline", "Job pipeline"],
  ["/clients", "Clients"],
  ["/calendar", "Team calendar"],
  ["/forms", "Forms & signatures"],
  ["/settings", "Settings"],
  ["/docs", "API reference"],
  ["/jobs", "Job card"],
];

function titleFor(path: string): string {
  const hit = TITLES.find(([p]) => path === p || path.startsWith(p + "/"));
  if (hit) return hit[1];
  if (path.startsWith("/clients/")) return "Client profile";
  return "Benchbook";
}

export default function Shell({
  user,
  team,
  children,
}: {
  user: ShellUser;
  team: TeamMember[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [q, setQ] = useState("");
  const newRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (newRef.current && !newRef.current.contains(e.target as Node)) setNewOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function signOut() {
    ops.logout();
    router.push("/login");
  }

  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[228px] flex-col bg-ink text-white md:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 pb-6 pt-5">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-ink">
            <Wrench className="size-4.5" strokeWidth={2.4} />
          </span>
          <span>
            <span className="block font-display text-[15px] font-bold leading-none">Benchbook</span>
            <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">
              Fixwell Handyman
            </span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1 px-3">
          {items.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition",
                  active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white"
                )}
              >
                {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent" />}
                <n.icon className={cn("size-[17px]", active ? "text-accent" : "text-white/45 group-hover:text-white/80")} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 px-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Crew on duty</p>
            <div className="mt-2 flex -space-x-2">
              {team.map((t) => (
                <span
                  key={t.id}
                  title={`${t.name} · ${t.role}`}
                  className="grid size-7 place-items-center overflow-hidden rounded-full border-2 border-ink text-[10px] font-bold text-white"
                  style={{ background: t.color }}
                >
                  {t.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.avatarUrl} alt={t.name} className="size-full object-cover" />
                  ) : (
                    t.name.slice(0, 2).toUpperCase()
                  )}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-white/50 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-[17px]" /> Sign out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md md:pl-[228px]">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <Link href="/dashboard" className="grid size-9 place-items-center rounded-xl bg-ink text-accent md:hidden">
            <Wrench className="size-4.5" strokeWidth={2.4} />
          </Link>
          <h1 className="font-display text-lg font-bold tracking-tight sm:text-xl">{titleFor(pathname)}</h1>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && q.trim()) router.push(`/clients?q=${encodeURIComponent(q.trim())}`);
                }}
                placeholder="Search clients…"
                className="w-52 rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm transition focus:w-64 focus:border-ink"
              />
            </div>

            <div className="relative" ref={newRef}>
              <button
                onClick={() => setNewOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-black"
              >
                <Plus className="size-4" /> <span className="hidden sm:inline">New</span>
                <ChevronDown className={cn("size-3.5 transition-transform", newOpen && "rotate-180")} />
              </button>
              {newOpen && (
                <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-lift animate-pop">
                  {[
                    { href: "/clients?new=1", label: "Client", icon: Users },
                    { href: "/pipeline?new=1", label: "Job / deal", icon: KanbanSquare },
                    { href: "/calendar?new=1", label: "Appointment", icon: CalendarDays },
                    { href: "/forms?send=1", label: "Form to sign", icon: FileSignature },
                  ].map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={() => setNewOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-ink transition hover:bg-canvas"
                    >
                      <i.icon className="size-4 text-ink-soft" /> {i.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={userRef}>
              <button onClick={() => setUserOpen((v) => !v)} className="flex items-center gap-2 rounded-xl p-1 transition hover:bg-black/5">
                <span className="grid size-8.5 place-items-center overflow-hidden rounded-full text-[11px] font-bold text-white" style={{ background: user.color }}>
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt={user.name} className="size-full object-cover" />
                  ) : (
                    user.name.slice(0, 2).toUpperCase()
                  )}
                </span>
                <ChevronDown className={cn("hidden size-3.5 text-ink-soft transition-transform sm:block", userOpen && "rotate-180")} />
              </button>
              {userOpen && (
                <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-white shadow-lift animate-pop">
                  <div className="border-b border-line px-4 py-3.5">
                    <p className="text-sm font-bold">{user.name}</p>
                    <p className="text-xs text-ink-soft">{user.email}</p>
                    <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 capitalize">
                      {user.role === "field" ? "Field crew" : user.role}
                    </span>
                  </div>
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="size-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 md:max-w-none md:pb-12 md:pl-[252px] md:pr-6 md:pt-8">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink md:hidden">
        <div className="grid grid-cols-5">
          {items.slice(0, 5).map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition",
                  active ? "text-accent" : "text-white/50"
                )}
              >
                <n.icon className="size-5" />
                {n.label.split(" ")[0]}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
