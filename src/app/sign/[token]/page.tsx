"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Wrench } from "lucide-react";
import SignView from "@/components/sign-view";
import { COMPANY } from "@/lib/constants";
import { formatAddress, primaryAddress, resolveTemplate } from "@/lib/model";
import { ops, useData, useReady } from "@/lib/store";

export default function SignPage() {
  const ready = useReady();
  const d = useData();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const marked = useRef(false);

  const form = ready ? d.forms.find((f) => f.token === token) : undefined;

  useEffect(() => {
    if (ready && form && form.status === "sent" && !marked.current) {
      marked.current = true;
      ops.markFormViewed(token);
    }
  }, [ready, form, token]);

  if (!ready) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas">
        <span className="grid size-14 animate-pulse place-items-center rounded-3xl bg-ink text-accent">
          <Wrench className="size-6" />
        </span>
      </main>
    );
  }

  /* 1) form exists in this browser's workspace */
  if (form) {
    const client = d.clients.find((c) => c.id === form.clientId);
    const job = d.jobs.find((j) => j.id === form.jobId);
    const template = d.templates.find((t) => t.key === form.templateKey);
    const content = client && job && template
      ? resolveTemplate(template.body, {
          client,
          clientAddress: client.addresses.length ? formatAddress(primaryAddress(client)!) : "",
          job,
        })
      : form.content;

    return (
      <SignView
        token={token}
        formId={form.id}
        docName={template?.name ?? "Document"}
        content={content}
        status={form.status === "sent" ? "viewed" : form.status}
        clientName={client?.name ?? ""}
        clientEmail={client?.email ?? ""}
        jobTitle={job?.title ?? ""}
        signed={{
          signerName: form.signerName,
          signedAt: form.signedAt,
          signerIp: form.signerIp,
          signatureUrl: form.signatureUrl,
        }}
      />
    );
  }

  /* 2) shared link opened on a device without this workspace — decode the embedded document */
  const dParam = new URLSearchParams(window.location.search).get("d");
  if (dParam) {
    try {
      const doc = JSON.parse(decodeURIComponent(dParam)) as { n: string; b: string; cn: string; e: string; j: string };
      return (
        <SignView
          token={token}
          docName={doc.n}
          content={doc.b}
          status="viewed"
          clientName={doc.cn}
          clientEmail={doc.e}
          jobTitle={doc.j}
          ephemeral
          signed={{ signerName: null, signedAt: null, signerIp: null, signatureUrl: null }}
        />
      );
    } catch { /* fall through to invalid */ }
  }

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
