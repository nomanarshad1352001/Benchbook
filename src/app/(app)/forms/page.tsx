import { db } from "@/db";
import { clients, forms, formTemplates, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import FormsView from "@/components/forms-view";
import { FORM_PHASES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const me = await getSessionUser();

  const [templates, formRows, jobRows] = await Promise.all([
    db.select().from(formTemplates),
    db
      .select({ f: forms, jobTitle: jobs.title, jobStage: jobs.stage, clientName: clients.name })
      .from(forms)
      .innerJoin(jobs, eq(forms.jobId, jobs.id))
      .innerJoin(clients, eq(forms.clientId, clients.id)),
    db
      .select({
        id: jobs.id,
        title: jobs.title,
        stage: jobs.stage,
        clientName: clients.name,
        clientEmail: clients.email,
        clientPhone: clients.phone,
      })
      .from(jobs)
      .innerJoin(clients, eq(jobs.clientId, clients.id)),
  ]);

  const targets = jobRows
    .filter((j) => j.stage !== "paid" && j.stage !== "lost")
    .map((j) => ({
      id: j.id,
      title: j.title,
      clientName: j.clientName,
      clientEmail: j.clientEmail,
      clientPhone: j.clientPhone,
      stage: j.stage,
    }));

  return (
    <FormsView
      templates={templates.map((t) => ({
        key: t.key,
        name: t.name,
        description: t.description ?? "",
        body: t.body,
        nextStage: t.nextStage,
        updatedAt: t.updatedAt.toISOString(),
      }))}
      forms={formRows
        .sort((a, b) => +new Date(b.f.createdAt) - +new Date(a.f.createdAt))
        .map((r) => ({
          id: r.f.id,
          token: r.f.token,
          templateKey: r.f.templateKey,
          templateLabel: FORM_PHASES[r.f.templateKey]?.label ?? r.f.templateKey,
          status: r.f.status,
          channel: r.f.channel,
          recipient: r.f.recipient,
          sentAt: r.f.sentAt.toISOString(),
          signedAt: r.f.signedAt?.toISOString() ?? null,
          signerName: r.f.signerName,
          signerIp: r.f.signerIp,
          jobId: r.f.jobId,
          jobTitle: r.jobTitle,
          jobStage: r.jobStage,
          clientName: r.clientName,
        }))}
      jobs={targets}
      canEdit={me?.role === "admin" || me?.role === "office"}
      openSend={sp.send === "1"}
      presetJobId={sp.job ? Number(sp.job) : null}
    />
  );
}
