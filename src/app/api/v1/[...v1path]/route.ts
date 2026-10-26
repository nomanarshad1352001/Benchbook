/* =========================================================================
   Public v1 REST API — serverless in-memory sandbox (no database required).
   Dataset resets to the demo seed when a cold instance starts; mutations
   persist while the instance is warm. Authenticate with the demo key shown
   in /docs and Settings → API keys.
   ========================================================================= */

import {
  buildSeed, computeTotals, formatAddress, primaryAddress, resolveTemplate, DEMO_API_KEY,
  type Appointment, type Client, type DataSet, type Form, type Job, type LineItem,
} from "@/lib/model";
import { FORM_PHASES } from "@/lib/constants";

export const dynamic = "force-dynamic";

/* warm-instance state */
const g = globalThis as typeof globalThis & { __bbSandbox?: DataSet };
const sand: DataSet = g.__bbSandbox ?? (g.__bbSandbox = buildSeed());

const nextId = (arr: { id: number }[]) => arr.reduce((m, x) => Math.max(m, x.id), 0) + 1;
const nowIso = () => new Date().toISOString();
const tok = (n = 6) => Array.from(crypto.getRandomValues(new Uint8Array(n))).map((b) => b.toString(16).padStart(2, "0")).join("");

/* ---------- auth ---------- */
const VALID_KEYS = new Set([DEMO_API_KEY]);

function unauthorized() {
  return Response.json(
    { error: { message: "Invalid or missing API key. Send it as `x-api-key` or Bearer token.", status: 401 } },
    { status: 401 }
  );
}
function apiError(status: number, message: string) {
  return Response.json({ error: { message, status } }, { status });
}
function authOk(req: Request): boolean {
  const key = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!key || !VALID_KEYS.has(key)) return false;
  const k = sand.apiKeys.find((x) => x.name.includes("demo"));
  if (k) k.lastUsedAt = nowIso();
  return true;
}

/* ---------- webhooks (server-side, real attempts) ---------- */
async function fire(event: string, data: Record<string, unknown>) {
  for (const w of sand.webhooks.filter((x) => x.active && x.events.includes(event))) {
    const payload = { id: `evt_${tok(5)}`, event, createdAt: nowIso(), data };
    const dl = { id: nextId(sand.deliveries), endpointId: w.id, event, payload, status: "pending", responseCode: null as number | null, createdAt: nowIso() };
    sand.deliveries.unshift(dl);
    try {
      const res = await fetch(w.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Webhook-Event": event, "X-Webhook-Secret": w.secret },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(4000),
      });
      dl.status = res.ok ? "delivered" : "failed";
      dl.responseCode = res.status;
    } catch {
      dl.status = "failed";
    }
  }
}

/* ---------- serializers ---------- */
const sClient = (c: Client) => ({
  id: c.id, name: c.name, email: c.email, phone: c.phone, leadSource: c.leadSource,
  tags: c.tags, addresses: c.addresses, notes: c.notes, createdAt: c.createdAt, updatedAt: c.updatedAt,
});
const sJob = (j: Job) => {
  const t = computeTotals(j.lineItems);
  return {
    id: j.id, clientId: j.clientId, title: j.title, serviceType: j.serviceType, stage: j.stage,
    address: j.address, description: j.description, lineItems: j.lineItems,
    totals: { subtotal: t.subtotal, hst: t.hst, total: t.total, currency: "CAD", taxRate: 0.13 },
    scheduledStart: j.scheduledStart, scheduledEnd: j.scheduledEnd, lostReason: j.lostReason,
    createdAt: j.createdAt, updatedAt: j.updatedAt,
  };
};
const sAppt = (a: Appointment) => ({
  id: a.id, clientId: a.clientId, clientName: sand.clients.find((c) => c.id === a.clientId)?.name ?? null,
  jobId: a.jobId, title: a.title, type: a.type, startsAt: a.startsAt, endsAt: a.endsAt,
  assigneeId: a.assigneeId, assigneeName: sand.users.find((u) => u.id === a.assigneeId)?.name ?? null,
  notes: a.notes, status: a.status, createdAt: a.createdAt,
});
const sForm = (f: Form, origin: string) => ({
  id: f.id, templateKey: f.templateKey, jobId: f.jobId, clientId: f.clientId,
  status: f.status, channel: f.channel, recipient: f.recipient,
  signingUrl: `${origin}/sign/${f.token}`,
  signerName: f.signerName, signerIp: f.signerIp, audit: f.events,
  sentAt: f.sentAt, signedAt: f.signedAt,
});

const asItems = (v: unknown): LineItem[] =>
  Array.isArray(v)
    ? (v as Partial<LineItem>[]).filter((i) => i?.description).map((i, n) => ({
        id: n + 1, description: String(i.description), kind: i.kind === "material" ? "material" : "labour",
        qty: Number(i.qty) || 0, unit: i.unit || "hrs", rate: Number(i.rate) || 0,
      }))
    : [];

/* ---------- router ---------- */

type Ctx = { params: Promise<{ v1path: string[] }> };

async function handle(req: Request, ctx: Ctx, method: string): Promise<Response> {
  if (!authOk(req)) return unauthorized();
  const { v1path } = await ctx.params;
  const [resource, idStr] = v1path ?? [];
  const id = Number(idStr);
  const url = new URL(req.url);
  const origin = url.origin;
  const body: Record<string, any> = method === "GET" || method === "DELETE" ? {} : await req.json().catch(() => ({}));

  /* ================= clients ================= */
  if (resource === "clients") {
    if (method === "GET" && !idStr) {
      const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
      const offset = Number(url.searchParams.get("offset")) || 0;
      const rows = [...sand.clients].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(offset, offset + limit);
      return Response.json({ data: rows.map(sClient), meta: { total: sand.clients.length, limit, offset } });
    }
    if (method === "POST" && !idStr) {
      if (!body.name) return apiError(400, "`name` is required.");
      const c: Client = {
        id: nextId(sand.clients), name: String(body.name), email: body.email ?? null, phone: body.phone ?? null,
        leadSource: body.leadSource ?? "API", tags: Array.isArray(body.tags) ? body.tags.map(String).slice(0, 8) : [],
        addresses: Array.isArray(body.addresses) ? body.addresses : [],
        notes: body.notes ?? null, createdAt: nowIso(), updatedAt: nowIso(),
      };
      sand.clients.unshift(c);
      await fire("client.created", sClient(c) as unknown as Record<string, unknown>);
      return Response.json({ data: sClient(c) }, { status: 201 });
    }
    const c = sand.clients.find((x) => x.id === id);
    if (!c) return apiError(404, "Client not found.");
    if (method === "GET") {
      return Response.json({ data: { ...sClient(c), jobs: sand.jobs.filter((j) => j.clientId === c.id).map(sJob) } });
    }
    if (method === "PATCH") {
      if (typeof body.name === "string") c.name = body.name;
      if (typeof body.email === "string" || body.email === null) c.email = body.email;
      if (typeof body.phone === "string" || body.phone === null) c.phone = body.phone;
      if (typeof body.leadSource === "string") c.leadSource = body.leadSource;
      if (Array.isArray(body.tags)) c.tags = body.tags.map(String).slice(0, 8);
      if (typeof body.notes === "string" || body.notes === null) c.notes = body.notes;
      c.updatedAt = nowIso();
      return Response.json({ data: sClient(c) });
    }
    if (method === "DELETE") {
      if (sand.jobs.some((j) => j.clientId === c.id)) {
        return apiError(409, "Client has jobs on record and cannot be deleted — archive by tagging instead.");
      }
      sand.clients = sand.clients.filter((x) => x.id !== c.id);
      return new Response(null, { status: 204 });
    }
  }

  /* ================= jobs ================= */
  if (resource === "jobs") {
    if (method === "GET" && !idStr) {
      const stage = url.searchParams.get("stage");
      const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
      const rows = [...sand.jobs]
        .filter((j) => !stage || j.stage === stage)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit);
      return Response.json({ data: rows.map(sJob), meta: { total: sand.jobs.length, limit } });
    }
    if (method === "POST" && !idStr) {
      if (!body.clientId || !body.title) return apiError(400, "`clientId` and `title` are required.");
      const client = sand.clients.find((c) => c.id === Number(body.clientId));
      if (!client) return apiError(404, "Client not found.");
      const j: Job = {
        id: nextId(sand.jobs), clientId: client.id, title: String(body.title),
        serviceType: body.serviceType ?? "General Repairs", stage: "lead",
        address: body.address ?? formatAddress(primaryAddress(client)!), description: body.description ?? null,
        lineItems: asItems(body.lineItems), scheduledStart: null, scheduledEnd: null, lostReason: null,
        assigneeId: null, createdById: null, createdAt: nowIso(), updatedAt: nowIso(),
      };
      sand.jobs.unshift(j);
      await fire("job.created", sJob(j) as unknown as Record<string, unknown>);
      return Response.json({ data: sJob(j) }, { status: 201 });
    }
    const j = sand.jobs.find((x) => x.id === id);
    if (!j) return apiError(404, "Job not found.");
    if (method === "GET") return Response.json({ data: sJob(j) });
    if (method === "PATCH") {
      if (typeof body.stage === "string") {
        const from = j.stage;
        j.stage = String(body.stage);
        if (typeof body.lostReason === "string") j.lostReason = body.lostReason;
        j.updatedAt = nowIso();
        await fire("job.stage_changed", { jobId: j.id, clientId: j.clientId, from, to: j.stage, title: j.title });
      }
      if (Array.isArray(body.lineItems)) { j.lineItems = asItems(body.lineItems); j.updatedAt = nowIso(); }
      if (typeof body.title === "string") j.title = body.title;
      if (typeof body.description === "string") j.description = body.description;
      return Response.json({ data: sJob(j) });
    }
  }

  /* ================= appointments ================= */
  if (resource === "appointments") {
    if (method === "GET") {
      const assigneeId = url.searchParams.get("assigneeId");
      const rows = [...sand.appointments]
        .filter((a) => !assigneeId || a.assigneeId === Number(assigneeId))
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
        .slice(0, 200);
      return Response.json({ data: rows.map(sAppt) });
    }
    if (method === "POST") {
      if (!body.clientId || !body.title || !body.startsAt || !body.endsAt) {
        return apiError(400, "`clientId`, `title`, `startsAt` and `endsAt` are required.");
      }
      const a: Appointment = {
        id: nextId(sand.appointments), clientId: Number(body.clientId), jobId: body.jobId ? Number(body.jobId) : null,
        title: String(body.title), type: body.type ?? "job",
        startsAt: new Date(String(body.startsAt)).toISOString(), endsAt: new Date(String(body.endsAt)).toISOString(),
        assigneeId: body.assigneeId ? Number(body.assigneeId) : null, notes: body.notes ?? null,
        status: "scheduled", createdAt: nowIso(),
      };
      sand.appointments.push(a);
      await fire("appointment.created", sAppt(a) as unknown as Record<string, unknown>);
      return Response.json({ data: sAppt(a) }, { status: 201 });
    }
  }

  /* ================= forms ================= */
  if (resource === "forms") {
    if (method === "GET") {
      const status = url.searchParams.get("status");
      const rows = [...sand.forms]
        .filter((f) => !status || f.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 200);
      return Response.json({ data: rows.map((f) => sForm(f, origin)) });
    }
    if (method === "POST") {
      if (!body.jobId || !body.templateKey) return apiError(400, "`jobId` and `templateKey` are required.");
      const job = sand.jobs.find((j) => j.id === Number(body.jobId));
      if (!job) return apiError(404, "Job not found.");
      const client = sand.clients.find((c) => c.id === job.clientId)!;
      const template = sand.templates.find((t) => t.key === String(body.templateKey));
      if (!template) return apiError(404, "Template not found.");
      const channel = body.channel === "sms" ? "sms" : "email";
      const content = resolveTemplate(template.body, { client, clientAddress: formatAddress(primaryAddress(client)!), job });
      const f: Form & { signingUrl?: string } = {
        id: nextId(sand.forms), token: `fx-sign-${tok(6)}`, templateKey: template.key,
        jobId: job.id, clientId: client.id, status: "sent", channel,
        recipient: body.recipient ?? (channel === "sms" ? client.phone : client.email) ?? "",
        content, clientNote: null, signerName: null, signerEmail: null, signerIp: null,
        signatureUrl: null, sentById: null,
        events: [{ at: nowIso(), event: "sent", ip: null, meta: `${channel} (via API)` }],
        sentAt: nowIso(), signedAt: null, createdAt: nowIso(),
      };
      const doc = encodeURIComponent(JSON.stringify({ n: template.name, b: content, cn: client.name, e: client.email ?? "", j: job.title }));
      f.signingUrl = `${origin}/sign/${f.token}?d=${doc}`;
      sand.forms.unshift(f);
      await fire("form.sent", { formId: f.id, jobId: job.id, clientId: client.id, templateKey: template.key });
      return Response.json({ data: { ...sForm(f, origin), templateLabel: FORM_PHASES[template.key]?.label, signingUrl: f.signingUrl } }, { status: 201 });
    }
  }

  /* ================= team (bonus, read-only) ================= */
  if (resource === "team" && method === "GET") {
    return Response.json({
      data: sand.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, color: u.color })),
    });
  }

  return apiError(404, `Unknown route: /${(v1path ?? []).join("/")}`);
}

export const GET = (req: Request, ctx: Ctx) => handle(req, ctx, "GET");
export const POST = (req: Request, ctx: Ctx) => handle(req, ctx, "POST");
export const PATCH = (req: Request, ctx: Ctx) => handle(req, ctx, "PATCH");
export const DELETE = (req: Request, ctx: Ctx) => handle(req, ctx, "DELETE");
