import Shell from "@/components/shell";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ensureSeeded();
  const user = await requireUser();
  const team = await db
    .select({ id: users.id, name: users.name, role: users.role, color: users.color, avatarUrl: users.avatarUrl })
    .from(users);

  return <Shell user={user} team={team}>{children}</Shell>;
}
