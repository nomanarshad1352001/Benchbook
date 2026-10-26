"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import Shell from "@/components/shell";
import { auth, useData, useReady } from "@/lib/store";

export function BootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-4 animate-fade">
        <span className="grid size-14 place-items-center rounded-3xl bg-ink text-accent shadow-lift">
          <Wrench className="size-6 animate-pulse" strokeWidth={2.2} />
        </span>
        <p className="font-display text-sm font-bold text-ink-soft">Loading Benchbook…</p>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const ready = useReady();
  const d = useData();
  const router = useRouter();
  const pathname = usePathname();
  const me = ready ? d.users.find((u) => u.id === auth.uid) ?? null : null;

  useEffect(() => {
    if (ready && !me) router.replace("/login");
    if (
      ready &&
      me &&
      me.role === "field" &&
      (pathname.startsWith("/settings") || pathname.startsWith("/docs"))
    ) {
      router.replace("/dashboard");
    }
  }, [ready, me, pathname, router]);

  if (!ready || !me) return <BootScreen />;

  return (
    <Shell
      user={{ id: me.id, name: me.name, email: me.email, role: me.role, color: me.color, avatarUrl: me.avatarUrl, phone: me.phone }}
      team={d.users.map((u) => ({ id: u.id, name: u.name, role: u.role, color: u.color, avatarUrl: u.avatarUrl }))}
    >
      {children}
    </Shell>
  );
}
