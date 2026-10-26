import { headers } from "next/headers";
import { Wrench } from "lucide-react";
import { db } from "@/db";
import { clients, forms, formTemplates, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveTemplate } from "@/lib/ops";
import { COMPANY } from "@/lib/constants";
import type { Address } from "@/db/schema";
import { formatAddress } from "@/lib/utils";
import SignView from "@/components/sign-view";

export const dynamic = "force-dynamic";

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [form] = await db.select().from(forms).where(eq(forms.token, token));

  if (!form) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas p-6">
        <div className="card max-w-sm p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-ink text-accent">
            <Wrench className="size-5" />
          </span>
          <h1 className="mt-4 font-display text-lg font-bold">Link not found</h1>
          <p className="mt-1 text-sm text-ink-soft">
            This signing link is invalid or has expired. Ask {COMPANY.name} to send a fresh one — {COMPANY.phone}.
          </p>
        </div>
      </main>
    );
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, form.clientId));
  const [job] = await db.select().from(jobs).where(eq(jobs.id, form.jobId));
  const [template] = await db.select().from(formTemplates).where(eq(formTemplates.key, form.templateKey));

  /* mark viewed exactly once (first open) */
  if (form.status === "sent") {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await db
      .update(forms)
      .set({
        status: "viewed",
        events: [
          ...form.events,
          { at: new Date().toISOString(), event: "viewed", ip, meta: "Signing page opened" },
        ],
      })
      .where(eq(forms.id, form.id));
  }

  const primary: Address | undefined = client?.addresses.find((a) => a.primary) ?? client?.addresses[0];
  const content = client && job && template
    ? resolveTemplate(template.body, { client, clientAddress: primary ? formatAddress(primary) : "", job })
    : form.content;

  return (
    <SignView
      token={token}
      docName={template?.name ?? "Document"}
      content={content}
      status={form.status === "sent" ? "viewed" : form.status}
      clientName={client?.name ?? ""}
      clientEmail={client?.email ?? ""}
      jobTitle={job?.title ?? ""}
      signed={{
        signerName: form.signerName,
        signedAt: form.signedAt?.toISOString() ?? null,
        signerIp: form.signerIp,
        signatureUrl: form.signatureUrl,
      }}
    />
  );
}
