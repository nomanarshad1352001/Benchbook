"use client";

import SettingsView from "@/components/settings-view";
import { auth, useData, useReady } from "@/lib/store";
import { BootScreen } from "@/app/(app)/layout";

export default function SettingsPage() {
  const ready = useReady();
  const d = useData();
  if (!ready) return <BootScreen />;

  const me = d.users.find((u) => u.id === auth.uid) ?? d.users[0];
  const hookMap = new Map(d.webhooks.map((h) => [h.id, h.url]));

  return (
    <SettingsView
      me={{ id: me.id, name: me.name, email: me.email, role: me.role, color: me.color, avatarUrl: me.avatarUrl }}
      team={d.users.map((u) => ({
        id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
        color: u.color, avatarUrl: u.avatarUrl, createdAt: "2024-01-15T10:00:00.000Z",
      }))}
      apiKeys={d.apiKeys.map((k) => ({
        id: k.id, name: k.name, prefix: k.prefix, createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt, revoked: k.revoked,
      }))}
      webhooks={d.webhooks.map((h) => ({ id: h.id, url: h.url, events: h.events, active: h.active, createdAt: h.createdAt }))}
      deliveries={[...d.deliveries]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 12)
        .map((dl) => ({ id: dl.id, event: dl.event, status: dl.status, responseCode: dl.responseCode, at: dl.createdAt, url: hookMap.get(dl.endpointId) ?? "—" }))}
    />
  );
}
