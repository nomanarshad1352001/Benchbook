/* =========================================================================
   legacy compatibility ops — the active app performs these operations
   synchronously in src/lib/store.ts (localStorage). These remain so stale
   DB-era route files in out-of-sync checkouts keep compiling. If
   DATABASE_URL is configured they function exactly as before.
   ========================================================================= */

import { db } from "@/db";
import {
  activities,
  jobs,
  webhookDeliveries,
  webhookEndpoints,
  type LineItem,
} from "@/db/schema";
import { COMPANY, STAGES, TAX_RATE, stageLabel } from "@/lib/constants";
import { eq } from "drizzle-orm";

/* ---------- Estimate math ---------- */

export function computeTotals(items: LineItem[]): {
  subtotal: number;
  hst: number;
  total: number;
} {
  const subtotal = items.reduce((s, it) => s + it.qty * it.rate, 0);
  const hst = Math.round(subtotal * TAX_RATE * 100) / 100;
  return { subtotal, hst, total: subtotal + hst };
}

export function itemsSummary(items: LineItem[]): string {
  if (!items.length) return "  (no line items yet)";
  return items
    .map(
      (it, i) =>
        `  ${i + 1}. ${it.description} — ${it.qty} ${it.unit} × $${it.rate.toFixed(2)} = $${(it.qty * it.rate).toFixed(2)}`
    )
    .join("\n");
}

/* ---------- Template tokens ---------- */

export function resolveTemplate(
  body: string,
  ctx: {
    client: { name: string; email?: string | null; phone?: string | null };
    clientAddress: string;
    job: {
      title: string;
      serviceType: string;
      address?: string | null;
      lineItems: LineItem[];
      description?: string | null;
    };
  }
): string {
  const { subtotal, hst, total } = computeTotals(ctx.job.lineItems);
  const map: Record<string, string> = {
    "client.name": ctx.client.name,
    "client.email": ctx.client.email ?? "",
    "client.phone": ctx.client.phone ?? "",
    "client.address": ctx.clientAddress,
    "job.title": ctx.job.title,
    "job.service": ctx.job.serviceType,
    "job.address": ctx.job.address ?? ctx.clientAddress,
    "job.description": ctx.job.description ?? "",
    "job.items": itemsSummary(ctx.job.lineItems),
    "job.subtotal": `$${subtotal.toFixed(2)}`,
    "job.hst": `$${hst.toFixed(2)}`,
    "job.total": `$${total.toFixed(2)}`,
    "company.name": COMPANY.name,
    "company.phone": COMPANY.phone,
    "company.email": COMPANY.email,
    "company.hst": COMPANY.hstNumber,
    "date.today": new Date().toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
  let out = body;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

/* ---------- Activity log ---------- */

export async function recordActivity(input: {
  clientId?: number | null;
  jobId?: number | null;
  userId?: number | null;
  kind?: string;
  message: string;
}) {
  await db.insert(activities).values({
    clientId: input.clientId ?? null,
    jobId: input.jobId ?? null,
    userId: input.userId ?? null,
    kind: input.kind ?? "event",
    message: input.message,
  });
}

/* ---------- Webhooks ---------- */

export async function fireWebhooks(event: string, data: Record<string, unknown>) {
  try {
    const endpoints = await db.select().from(webhookEndpoints);
    const targets = endpoints.filter(
      (e) => e.active && e.events.includes(event)
    );
    const payload = {
      id: `evt_${Math.random().toString(36).slice(2, 12)}`,
      event,
      createdAt: new Date().toISOString(),
      data,
    };
    for (const ep of targets) {
      const [delivery] = await db
        .insert(webhookDeliveries)
        .values({ endpointId: ep.id, event, payload, status: "pending" })
        .returning();
      try {
        const res = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Event": event,
            "X-Webhook-Secret": ep.secret,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(4000),
        });
        await db
          .update(webhookDeliveries)
          .set({
            status: res.ok ? "delivered" : "failed",
            responseCode: res.status,
          })
          .where(eq(webhookDeliveries.id, delivery.id));
      } catch {
        await db
          .update(webhookDeliveries)
          .set({ status: "failed", responseCode: null })
          .where(eq(webhookDeliveries.id, delivery.id));
      }
    }
  } catch (e) {
    console.error("webhook dispatch failed", e);
  }
}

/* ---------- Stage moves ---------- */

export async function moveJobStage(input: {
  jobId: number;
  stage: string;
  userId?: number | null;
  lostReason?: string | null;
}) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, input.jobId));
  if (!job) return null;
  const from = job.stage;
  await db
    .update(jobs)
    .set({
      stage: input.stage,
      lostReason: input.lostReason ?? job.lostReason,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, input.jobId));
  await recordActivity({
    clientId: job.clientId,
    jobId: job.id,
    userId: input.userId,
    kind: "stage",
    message: `Job moved from ${stageLabel(from)} to ${stageLabel(input.stage)}`,
  });
  await fireWebhooks("job.stage_changed", {
    jobId: job.id,
    clientId: job.clientId,
    from,
    to: input.stage,
    title: job.title,
  });
  return { ...job, stage: input.stage };
}

export const STAGE_ORDER = STAGES.map((s) => s.key);
