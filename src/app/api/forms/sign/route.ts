import { headers } from "next/headers";
import { db } from "@/db";
import { forms, formTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fireWebhooks, moveJobStage, recordActivity } from "@/lib/ops";
import { FORM_PHASES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.token || !b?.signerName?.trim() || !b?.signature) {
    return Response.json({ error: "Name and signature are required." }, { status: 400 });
  }

  const [form] = await db.select().from(forms).where(eq(forms.token, String(b.token)));
  if (!form) return Response.json({ error: "Form not found." }, { status: 404 });
  if (form.status === "signed") {
    return Response.json({ error: "This form has already been signed." }, { status: 409 });
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "0.0.0.0";
  const ua = h.get("user-agent") ?? "";
  const device = /iPhone/i.test(ua) ? "iPhone" : /iPad/i.test(ua) ? "iPad" : /Android/i.test(ua) ? "Android" : /Mac/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows PC" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";

  const now = new Date();
  const events = [
    ...form.events,
    { at: now.toISOString(), event: "signed", ip, meta: `${device} · ${browser} · ${b.signerName.trim()}` },
  ];

  await db
    .update(forms)
    .set({
      status: "signed",
      signerName: b.signerName.trim(),
      signerEmail: b.signerEmail?.trim() || null,
      signerIp: ip,
      signatureUrl: String(b.signature),
      clientNote: b.clientNote?.trim() || null,
      signedAt: now,
      events,
    })
    .where(eq(forms.id, form.id));

  const [template] = await db.select().from(formTemplates).where(eq(formTemplates.key, form.templateKey));
  const label = FORM_PHASES[form.templateKey]?.label ?? template?.name ?? form.templateKey;

  await recordActivity({
    clientId: form.clientId,
    jobId: form.jobId,
    kind: "form",
    message: `${label} signed by ${b.signerName.trim()}`,
  });

  if (template?.nextStage) {
    await moveJobStage({ jobId: form.jobId, stage: template.nextStage, userId: null });
  }
  await fireWebhooks("form.signed", {
    formId: form.id,
    jobId: form.jobId,
    clientId: form.clientId,
    templateKey: form.templateKey,
    signerName: b.signerName.trim(),
    signedAt: now.toISOString(),
    ip,
  });

  return Response.json({ ok: true, movedTo: template?.nextStage ?? null });
}
