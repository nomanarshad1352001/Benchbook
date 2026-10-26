"use client";

/* =========================================================================
   Zero-database persistence layer.
   - Data lives in localStorage (seeded on first visit, survives reloads).
   - window.fetch("/api/...") is shimmed to this store so every existing
     screen keeps working unchanged — on Vercel or anywhere, no DB needed.
   - /api/v1/* requests pass through to the real serverless sandbox API.
   ========================================================================= */

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  buildSeed, clientsToCsv, computeTotals, formatAddress, parseClientsCsv,
  primaryAddress, resolveTemplate,
  type Appointment, type Client, type DataSet, type Form, type Job, type LineItem, type User,
} from "@/lib/model";
import { FORM_PHASES, TAX_RATE, stageLabel, WORK_PHOTOS } from "@/lib/constants";

const LS_DATA = "bb_data_v2";
const LS_UID = "bb_uid_v1";

let data: DataSet = buildSeed();
let uid: number | null = null;
let ready = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((f) => f()); }
function persist() {
  try { localStorage.setItem(LS_DATA, JSON.stringify({ v: 2, data })); } catch { /* full */ }
}

export function initStore() {
  if (ready || typeof window === "undefined") return;
  ready = true;
  try {
    const raw = localStorage.getItem(LS_DATA);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.v === 2 && parsed.data?.clients) data = parsed.data;
    }
    const u = localStorage.getItem(LS_UID);
    uid = u ? Number(u) : null;
  } catch { /* corrupted state -> fresh seed */ }
  installFetchShim();
}

export function useReady(): boolean {
  // Initialize from the module flag: after the very first init, the store is
  // already in memory, so every subsequent page mount is instantly "ready" —
  // no loading frame on navigation or tab switches. On a cold first load the
  // effect below performs the one-time localStorage hydrate.
  const [r, setR] = useState(ready);
  useEffect(() => {
    if (!ready) {
      initStore();
      setR(true);
    } else if (!r) {
      setR(true);
    }
  }, [r]);
  return r || ready;
}

export function useData(): DataSet {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => data,
    () => data
  );
}

export const auth = {
  get uid() { return uid; },
};

function nextId(arr: { id: number }[]): number {
  return arr.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}
function write(fn: (d: DataSet) => void) {
  fn(data);
  data = { ...data };
  persist();
  emit();
}
function nowIso() { return new Date().toISOString(); }
function tok(n = 6) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n))).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function addActivity(d: DataSet, a: { clientId?: number | null; jobId?: number | null; userId?: number | null; kind?: string; message: string }) {
  d.activities.unshift({
    id: nextId(d.activities), clientId: a.clientId ?? null, jobId: a.jobId ?? null,
    userId: a.userId ?? null, kind: a.kind ?? "event", message: a.message, createdAt: nowIso(),
  });
}

function fireWebhooks(d: DataSet, event: string, payload: Record<string, unknown>) {
  const targets = d.webhooks.filter((w) => w.active && w.events.includes(event));
  for (const w of targets) {
    const delivery = {
      id: nextId(d.deliveries), endpointId: w.id, event,
      payload: { id: `evt_${tok(5)}`, event, createdAt: nowIso(), data: payload },
      status: "pending", responseCode: null as number | null, createdAt: nowIso(),
    };
    d.deliveries.unshift(delivery);
    fetch(w.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Event": event, "X-Webhook-Secret": w.secret },
      body: JSON.stringify(delivery.payload),
      mode: "no-cors",
    })
      .then(() => { delivery.status = "sent"; emit(); })
      .catch(() => { delivery.status = "failed"; emit(); });
  }
}

function moveStage(d: DataSet, job: Job, stage: string, userId: number | null, lostReason?: string) {
  const from = job.stage;
  job.stage = stage;
  if (lostReason !== undefined) job.lostReason = lostReason;
  job.updatedAt = nowIso();
  addActivity(d, { clientId: job.clientId, jobId: job.id, userId, kind: "stage", message: `Job moved from ${stageLabel(from)} to ${stageLabel(stage)}` });
  fireWebhooks(d, "job.stage_changed", { jobId: job.id, clientId: job.clientId, from, to: stage, title: job.title });
}

/* ------------------------------ operations ------------------------------ */

export const ops = {
  login(email: string, password: string): { ok: boolean; error?: string } {
    const user = data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) return { ok: false, error: "That email and password don't match our records." };
    uid = user.id;
    try { localStorage.setItem(LS_UID, String(user.id)); } catch { /* ignore */ }
    emit();
    return { ok: true };
  },
  logout() {
    uid = null;
    try { localStorage.removeItem(LS_UID); } catch { /* ignore */ }
    emit();
  },
  me(): User | null { return data.users.find((u) => u.id === uid) ?? null; },

  createClient(b: { name: string; email?: string; phone?: string; leadSource?: string; tags?: string; line1?: string; postal?: string; notes?: string }): Client {
    const meId = uid;
    let created!: Client;
    write((d) => {
      created = {
        id: nextId(d.clients), name: b.name.trim(), email: b.email?.trim() || null, phone: b.phone?.trim() || null,
        leadSource: b.leadSource || "Referral",
        tags: String(b.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8),
        addresses: b.line1?.trim() ? [{ label: "Home", line1: b.line1.trim(), city: "Toronto", province: "ON", postal: b.postal?.trim() || "", primary: true }] : [],
        notes: b.notes?.trim() || null, createdAt: nowIso(), updatedAt: nowIso(),
      };
      d.clients.unshift(created);
      addActivity(d, { clientId: created.id, userId: meId, kind: "client", message: `Client added — ${created.name}` });
      fireWebhooks(d, "client.created", { id: created.id, name: created.name, email: created.email, phone: created.phone, leadSource: created.leadSource });
    });
    return created;
  },

  createJob(b: { clientId: number; title: string; serviceType?: string; address?: string; description?: string; assigneeId?: number | null; lineItems?: LineItem[] }): Job {
    const meId = uid;
    let created!: Job;
    write((d) => {
      const client = d.clients.find((c) => c.id === b.clientId);
      created = {
        id: nextId(d.jobs), clientId: b.clientId, title: b.title.trim(),
        serviceType: b.serviceType || "General Repairs", stage: "lead",
        address: b.address?.trim() || (client ? formatAddress(primaryAddress(client)!) : null),
        description: b.description?.trim() || null,
        lineItems: (b.lineItems ?? []).filter((i) => i.description?.trim()),
        scheduledStart: null, scheduledEnd: null, lostReason: null,
        assigneeId: b.assigneeId ?? null, createdById: meId, createdAt: nowIso(), updatedAt: nowIso(),
      };
      d.jobs.unshift(created);
      addActivity(d, { clientId: created.clientId, jobId: created.id, userId: meId, kind: "job", message: `Job created — ${created.title}` });
      fireWebhooks(d, "job.created", { id: created.id, clientId: created.clientId, title: created.title, stage: created.stage });
    });
    return created;
  },

  patchJob(id: number, b: { stage?: string; lostReason?: string; lineItems?: LineItem[]; assigneeId?: number | null }) {
    const meId = uid;
    write((d) => {
      const job = d.jobs.find((j) => j.id === id);
      if (!job) return;
      if (typeof b.stage === "string") moveStage(d, job, b.stage, meId, b.lostReason);
      if (Array.isArray(b.lineItems)) {
        job.lineItems = b.lineItems.filter((i) => i.description?.trim());
        job.updatedAt = nowIso();
        addActivity(d, { clientId: job.clientId, jobId: job.id, userId: meId, kind: "quote", message: "Estimate line items updated" });
      }
      if (typeof b.assigneeId === "number" || b.assigneeId === null) {
        job.assigneeId = b.assigneeId;
        job.updatedAt = nowIso();
      }
    });
  },

  addNote(b: { clientId: number; jobId?: number | null; body: string }) {
    const me = ops.me();
    write((d) => {
      d.notes.unshift({ id: nextId(d.notes), clientId: b.clientId, jobId: b.jobId ?? null, userId: me?.id ?? null, body: b.body.trim(), createdAt: nowIso() });
      addActivity(d, { clientId: b.clientId, jobId: b.jobId ?? null, userId: me?.id ?? null, kind: "note", message: `${me?.name.split(" ")[0] ?? "Someone"} added a note` });
    });
  },

  addPhoto(b: { clientId: number; jobId?: number | null }) {
    const meId = uid;
    const captions = ["Before — site condition on arrival", "Mid-job — work in progress", "After — wrapped and cleaned up", "Detail — finish work", "Materials staged on site"];
    const idx = data.photos.length % WORK_PHOTOS.length;
    write((d) => {
      d.photos.unshift({ id: nextId(d.photos), clientId: b.clientId, jobId: b.jobId ?? null, url: WORK_PHOTOS[idx], caption: captions[idx % captions.length], createdAt: nowIso() });
      addActivity(d, { clientId: b.clientId, jobId: b.jobId ?? null, userId: meId, kind: "photo", message: "Photo added to record" });
    });
  },

  bookAppointment(b: { clientId: number; jobId?: number | null; title: string; type: string; startsAt: string; endsAt: string; assigneeId?: number | null; notes?: string }): Appointment {
    const meId = uid;
    let created!: Appointment;
    write((d) => {
      created = {
        id: nextId(d.appointments), clientId: b.clientId, jobId: b.jobId ?? null, title: b.title.trim(),
        type: b.type || "job", startsAt: b.startsAt, endsAt: b.endsAt,
        assigneeId: b.assigneeId ?? null, notes: b.notes?.trim() || null, status: "scheduled", createdAt: nowIso(),
      };
      d.appointments.push(created);
      if (created.jobId && created.type === "job") {
        const job = d.jobs.find((j) => j.id === created.jobId);
        if (job) { job.scheduledStart = created.startsAt; job.scheduledEnd = created.endsAt; }
      }
      addActivity(d, { clientId: created.clientId, jobId: created.jobId, userId: meId, kind: "event", message: `Scheduled — ${created.title}` });
      fireWebhooks(d, "appointment.created", { id: created.id, clientId: created.clientId, jobId: created.jobId, startsAt: created.startsAt, assigneeId: created.assigneeId });
    });
    return created;
  },

  sendForm(b: { jobId: number; templateKey: string; channel: "email" | "sms"; recipient?: string }): { form: Form; link: string } {
    const meId = uid;
    let created!: Form;
    let link = "";
    write((d) => {
      const job = d.jobs.find((j) => j.id === b.jobId);
      const client = job && d.clients.find((c) => c.id === job.clientId);
      const template = d.templates.find((t) => t.key === b.templateKey);
      if (!job || !client || !template) throw new Error("Job or template not found.");
      const content = resolveTemplate(template.body, { client, clientAddress: formatAddress(primaryAddress(client)!), job });
      const recipient = b.recipient?.trim() || (b.channel === "sms" ? client.phone : client.email) || "";
      created = {
        id: nextId(d.forms), token: `fx-sign-${tok(6)}`, templateKey: template.key, jobId: job.id, clientId: client.id,
        status: "sent", channel: b.channel, recipient, content, clientNote: null,
        signerName: null, signerEmail: null, signerIp: null, signatureUrl: null, sentById: meId,
        events: [{ at: nowIso(), event: "sent", ip: null, meta: `${b.channel === "sms" ? "Text message" : "Email"} to ${recipient}` }],
        sentAt: nowIso(), signedAt: null, createdAt: nowIso(),
      };
      d.forms.unshift(created);
      addActivity(d, { clientId: client.id, jobId: job.id, userId: meId, kind: "form", message: `${FORM_PHASES[template.key]?.label ?? template.name} sent to ${client.name} by ${b.channel === "sms" ? "text" : "email"}` });
      fireWebhooks(d, "form.sent", { formId: created.id, jobId: job.id, clientId: client.id, templateKey: template.key });
      const doc = encodeURIComponent(JSON.stringify({ n: template.name, b: content, cn: client.name, e: client.email ?? "", j: job.title }));
      link = `/sign/${created.token}?d=${doc}`;
    });
    return { form: created, link };
  },

  markFormViewed(token: string) {
    write((d) => {
      const f = d.forms.find((x) => x.token === token);
      if (f && f.status === "sent") {
        f.status = "viewed";
        f.events.push({ at: nowIso(), event: "viewed", ip: null, meta: "Signing page opened" });
      }
    });
  },

  async signForm(b: { token: string; signerName: string; signerEmail?: string; clientNote?: string; signature: string }): Promise<{ ok: boolean; movedTo?: string | null; error?: string }> {
    let movedTo: string | null = null;
    let ip: string | null = null;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 1800);
      const res = await fetch("https://api.ipify.org?format=json", { signal: ctl.signal });
      clearTimeout(t);
      ip = (await res.json()).ip ?? null;
    } catch { /* offline demo */ }
    const ua = navigator.userAgent;
    const device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : "Device";
    let err: string | undefined;
    write((d) => {
      const f = d.forms.find((x) => x.token === b.token);
      if (!f) { err = "Form not found."; return; }
      if (f.status === "signed") { err = "This form has already been signed."; return; }
      f.status = "signed";
      f.signerName = b.signerName.trim();
      f.signerEmail = b.signerEmail?.trim() || null;
      f.signerIp = ip;
      f.signatureUrl = b.signature;
      f.clientNote = b.clientNote?.trim() || null;
      f.signedAt = nowIso();
      f.events.push({ at: nowIso(), event: "signed", ip, meta: `${device} · ${b.signerName.trim()}` });
      const template = d.templates.find((t) => t.key === f.templateKey);
      addActivity(d, { clientId: f.clientId, jobId: f.jobId, kind: "form", message: `${FORM_PHASES[f.templateKey]?.label ?? template?.name ?? f.templateKey} signed by ${b.signerName.trim()}` });
      if (template?.nextStage) {
        const job = d.jobs.find((j) => j.id === f.jobId);
        if (job) { moveStage(d, job, template.nextStage, null); movedTo = template.nextStage; }
      }
      fireWebhooks(d, "form.signed", { formId: f.id, jobId: f.jobId, clientId: f.clientId, templateKey: f.templateKey, signerName: b.signerName.trim(), signedAt: f.signedAt, ip });
    });
    if (err) return { ok: false, error: err };
    return { ok: true, movedTo };
  },

  updateTemplate(key: string, body: string) {
    write((d) => {
      const t = d.templates.find((x) => x.key === key);
      if (t) { t.body = body; t.updatedAt = nowIso(); }
      addActivity(d, { userId: uid, kind: "form", message: `Form template updated — ${key}` });
    });
  },

  importClients(csv: string): { added: number; skipped: number } {
    const rows = parseClientsCsv(csv);
    if (!rows.length) return { added: 0, skipped: 0 };
    let added = 0, skipped = 0;
    write((d) => {
      const seen = new Set(d.clients.map((c) => `${c.name.toLowerCase()}|${(c.email ?? "").toLowerCase()}`));
      for (const r of rows) {
        const key = `${r.name.toLowerCase()}|${r.email.toLowerCase()}`;
        if (seen.has(key)) { skipped++; continue; }
        seen.add(key);
        d.clients.unshift({
          id: nextId(d.clients), name: r.name, email: r.email || null, phone: r.phone || null,
          leadSource: r.leadSource, tags: r.tags, addresses: r.address ? [r.address] : [],
          notes: "Imported from spreadsheet.", createdAt: nowIso(), updatedAt: nowIso(),
        });
        added++;
      }
      fireWebhooks(d, "client.created", { imported: added, skipped });
    });
    return { added, skipped };
  },

  exportClientsCsv(): string { return clientsToCsv(data.clients); },

  createApiKey(name: string): { id: number; plainKey: string } {
    const plainKey = `fwk_live_${tok(12)}`;
    let id = 0;
    write((d) => {
      id = nextId(d.apiKeys);
      d.apiKeys.unshift({ id, name: name.trim(), prefix: plainKey.slice(0, 16), createdAt: nowIso(), lastUsedAt: null, revoked: false });
      addActivity(d, { userId: uid, kind: "security", message: `API key created — ${name.trim()}` });
    });
    return { id, plainKey };
  },
  revokeApiKey(id: number) {
    write((d) => {
      const k = d.apiKeys.find((x) => x.id === id);
      if (k) k.revoked = true;
      addActivity(d, { userId: uid, kind: "security", message: "API key revoked" });
    });
  },
  addWebhook(url: string, events: string[]): { id: number } {
    let id = 0;
    write((d) => {
      id = nextId(d.webhooks);
      d.webhooks.unshift({ id, url: url.trim(), events, secret: `whsec_${tok(6)}`, active: true, createdAt: nowIso() });
      addActivity(d, { userId: uid, kind: "security", message: `Webhook endpoint added — ${new URL(url).host}` });
    });
    return { id };
  },
  toggleWebhook(id: number, active: boolean) {
    write((d) => {
      const w = d.webhooks.find((x) => x.id === id);
      if (w) w.active = active;
    });
  },

  resetDemo() {
    write(() => { data = { ...buildSeed() }; });
  },
};

/* ------------------------------ fetch shim ------------------------------ */

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function parseBody(init?: RequestInit): Record<string, unknown> {
  try { return init?.body ? JSON.parse(String(init.body)) : {}; } catch { return {}; }
}

const PHOTO_CAPTIONS = ["Before — site condition on arrival", "Mid-job — work in progress", "After — wrapped and cleaned up", "Detail — finish work"];

let shimInstalled = false;
function installFetchShim() {
  if (shimInstalled || typeof window === "undefined") return;
  shimInstalled = true;
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    // only intercept same-origin /api calls (not /api/v1, not /api/health, not openapi)
    const isLocalApi = url.startsWith("/api/") && !url.startsWith("/api/v1") && !url.startsWith("/api/health") && !url.startsWith("/api/openapi.json");
    if (!isLocalApi) return realFetch(input, init);

    const path = url.split("?")[0];
    const method = (init?.method ?? "GET").toUpperCase();
    const b = parseBody(init);
    void TAX_RATE; void PHOTO_CAPTIONS;

    try {
      switch (true) {
        /* auth */
        case path === "/api/auth/login" && method === "POST": {
          const r = ops.login(String(b.email ?? ""), String(b.password ?? ""));
          return r.ok ? json({ ok: true }) : json({ error: r.error }, 401);
        }
        case path === "/api/auth/logout" && method === "POST":
          ops.logout();
          return json({ ok: true });

        /* clients */
        case path === "/api/clients" && method === "POST": {
          if (!String(b.name ?? "").trim()) return json({ error: "Client name is required." }, 400);
          const c = ops.createClient(b as Parameters<typeof ops.createClient>[0]);
          return json({ id: c.id });
        }
        case path === "/api/clients/import" && method === "POST": {
          const r = ops.importClients(String(b.csv ?? ""));
          if (!r.added && !r.skipped) return json({ error: "CSV needs a header row and at least one client." }, 400);
          return json(r);
        }
        case path === "/api/notes" && method === "POST": {
          if (!String(b.body ?? "").trim()) return json({ error: "Note body and client are required." }, 400);
          ops.addNote({ clientId: Number(b.clientId), jobId: b.jobId ? Number(b.jobId) : null, body: String(b.body) });
          return json({ ok: true });
        }
        case path === "/api/photos" && method === "POST": {
          ops.addPhoto({ clientId: Number(b.clientId), jobId: b.jobId ? Number(b.jobId) : null });
          return json({ ok: true });
        }

        /* jobs */
        case path === "/api/jobs" && method === "POST": {
          if (!String(b.title ?? "").trim() || !b.clientId) return json({ error: "Job title and client are required." }, 400);
          const j = ops.createJob({
            clientId: Number(b.clientId), title: String(b.title), serviceType: b.serviceType as string,
            address: b.address as string, description: b.description as string,
            assigneeId: b.assigneeId ? Number(b.assigneeId) : null, lineItems: b.lineItems as LineItem[],
          });
          return json({ id: j.id });
        }
        case /^\/api\/jobs\/\d+$/.test(path) && method === "PATCH": {
          const id = Number(path.split("/").pop());
          ops.patchJob(id, {
            stage: typeof b.stage === "string" ? b.stage : undefined,
            lostReason: typeof b.lostReason === "string" ? b.lostReason : undefined,
            lineItems: Array.isArray(b.lineItems) ? (b.lineItems as LineItem[]) : undefined,
            assigneeId: b.assigneeId === null ? null : typeof b.assigneeId === "number" ? b.assigneeId : typeof b.assigneeId === "string" && b.assigneeId ? Number(b.assigneeId) : undefined,
          });
          return json({ ok: true });
        }

        /* appointments */
        case path === "/api/appointments" && method === "POST": {
          if (!String(b.title ?? "").trim() || !b.clientId || !b.startsAt || !b.endsAt) {
            return json({ error: "Title, client, start and end are required." }, 400);
          }
          const a = ops.bookAppointment({
            clientId: Number(b.clientId), jobId: b.jobId ? Number(b.jobId) : null,
            title: String(b.title), type: String(b.type ?? "job"),
            startsAt: new Date(String(b.startsAt)).toISOString(), endsAt: new Date(String(b.endsAt)).toISOString(),
            assigneeId: b.assigneeId ? Number(b.assigneeId) : null, notes: b.notes as string,
          });
          return json({ id: a.id });
        }

        /* forms */
        case path === "/api/forms" && method === "POST": {
          try {
            const { form, link } = ops.sendForm({
              jobId: Number(b.jobId), templateKey: String(b.templateKey),
              channel: b.channel === "sms" ? "sms" : "email", recipient: b.recipient as string,
            });
            return json({ id: form.id, token: form.token, link });
          } catch (e) {
            return json({ error: e instanceof Error ? e.message : "Could not send form." }, 400);
          }
        }
        case path === "/api/forms/templates" && method === "PATCH": {
          if (!String(b.body ?? "").trim()) return json({ error: "Template key and body are required." }, 400);
          ops.updateTemplate(String(b.key), String(b.body));
          return json({ ok: true });
        }
        case path === "/api/forms/sign" && method === "POST": {
          if (!String(b.signerName ?? "").trim() || !b.signature) return json({ error: "Name and signature are required." }, 400);
          const r = await ops.signForm({
            token: String(b.token), signerName: String(b.signerName),
            signerEmail: b.signerEmail as string, clientNote: b.clientNote as string, signature: String(b.signature),
          });
          return r.ok ? json({ ok: true, movedTo: r.movedTo ?? null }) : json({ error: r.error }, 409);
        }
        case /^\/api\/forms\/\d+\/pdf$/.test(path) && method === "GET": {
          const id = Number(path.split("/")[3]);
          const { buildFormPdf } = await import("@/lib/pdf");
          const f = data.forms.find((x) => x.id === id);
          if (!f) return new Response("Not found", { status: 404 });
          const bytes = await buildFormPdf(data, id);
          const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
          return new Response(buf, {
            headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="fixwell-form-${id}.pdf"` },
          });
        }

        /* api keys */
        case path === "/api/keys" && method === "POST": {
          const me = ops.me();
          if (!me || me.role !== "admin") return json({ error: "Only admins can create API keys." }, 403);
          if (!String(b.name ?? "").trim()) return json({ error: "Key name is required." }, 400);
          const k = ops.createApiKey(String(b.name));
          return json(k);
        }
        case path === "/api/keys" && method === "PATCH": {
          const me = ops.me();
          if (!me || me.role !== "admin") return json({ error: "Only admins can manage API keys." }, 403);
          ops.revokeApiKey(Number(b.id));
          return json({ ok: true });
        }

        /* webhooks */
        case path === "/api/webhooks" && method === "POST": {
          const me = ops.me();
          if (!me || me.role !== "admin") return json({ error: "Only admins can manage webhooks." }, 403);
          if (!String(b.url ?? "").startsWith("https://") || !Array.isArray(b.events) || !(b.events as unknown[]).length) {
            return json({ error: "HTTPS URL and at least one event are required." }, 400);
          }
          return json(ops.addWebhook(String(b.url), (b.events as unknown[]).map(String)));
        }
        case path === "/api/webhooks" && method === "PATCH": {
          const me = ops.me();
          if (!me || me.role !== "admin") return json({ error: "Only admins can manage webhooks." }, 403);
          ops.toggleWebhook(Number(b.id), Boolean(b.active));
          return json({ ok: true });
        }

        default:
          return json({ error: `No local handler for ${method} ${path}` }, 404);
      }
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Store error" }, 500);
    }
  };
}

/* -------------------- convenience: CSV / PDF downloads -------------------- */

export function downloadClientsCsv() {
  const csv = ops.exportClientsCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `fixwell-clients-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function downloadFormPdf(formId: number) {
  const { buildFormPdf } = await import("@/lib/pdf");
  const bytes = await buildFormPdf(data, formId);
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `fixwell-form-${formId}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export { computeTotals };
