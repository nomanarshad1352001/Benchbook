import { redirect } from "next/navigation";
import { db } from "@/db";
import { apiKeys, users, webhookDeliveries, webhookEndpoints } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import SettingsView from "@/components/settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await getSessionUser();
  if (!me || (me.role !== "admin" && me.role !== "office")) redirect("/dashboard");

  const [team, keys, hooks, deliveries] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, color: users.color, avatarUrl: users.avatarUrl, createdAt: users.createdAt }).from(users),
    db.select().from(apiKeys),
    db.select().from(webhookEndpoints),
    db.select().from(webhookDeliveries),
  ]);

  const hookMap = new Map(hooks.map((h) => [h.id, h.url]));

  return (
    <SettingsView
      me={me}
      team={team.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
      apiKeys={keys.map((k) => ({
        id: k.id, name: k.name, prefix: k.prefix, createdAt: k.createdAt.toISOString(),
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revoked: !!k.revokedAt,
      }))}
      webhooks={hooks.map((h) => ({
        id: h.id, url: h.url, events: h.events, active: h.active, createdAt: h.createdAt.toISOString(),
      }))}
      deliveries={deliveries
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 12)
        .map((d) => ({
          id: d.id, event: d.event, status: d.status, responseCode: d.responseCode,
          at: d.createdAt.toISOString(), url: hookMap.get(d.endpointId) ?? "—",
        }))}
    />
  );
}
