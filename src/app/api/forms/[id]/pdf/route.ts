import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { db } from "@/db";
import { clients, forms, formTemplates, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { COMPANY } from "@/lib/constants";
import { computeTotals, resolveTemplate } from "@/lib/ops";
import { formatAddress } from "@/lib/utils";
import type { Address } from "@/db/schema";

export const dynamic = "force-dynamic";

const INK = rgb(0.086, 0.09, 0.102);
const SOFT = rgb(0.4, 0.41, 0.43);
const LINE = rgb(0.87, 0.86, 0.84);
const ACCENT = rgb(0.96, 0.62, 0.04);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const [form] = await db.select().from(forms).where(eq(forms.id, Number(id)));
  if (!form) return new Response("Not found", { status: 404 });
  const [job] = await db.select().from(jobs).where(eq(jobs.id, form.jobId));
  const [client] = await db.select().from(clients).where(eq(clients.id, form.clientId));
  const [template] = await db.select().from(formTemplates).where(eq(formTemplates.key, form.templateKey));
  if (!job || !client || !template) return new Response("Not found", { status: 404 });

  const primary: Address | undefined = client.addresses.find((a) => a.primary) ?? client.addresses[0];
  const content = resolveTemplate(template.body, {
    client,
    clientAddress: primary ? formatAddress(primary) : "",
    job,
  });

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${template.name} — ${client.name}`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const W = 612;
  const H = 792;
  const M = 56;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const ensure = (need: number) => {
    if (y - need < 64) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };
  const drawTextLine = (text: string, size: number, f: PDFFont, color = INK, indent = 0) => {
    page.drawText(text, { x: M + indent, y, size, font: f, color });
  };
  const wrap = (text: string, size: number, f: PDFFont, maxW: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  /* ---------- header band ---------- */
  page.drawRectangle({ x: 0, y: H - 92, width: W, height: 92, color: INK });
  page.drawRectangle({ x: M, y: H - 66, width: 14, height: 14, color: ACCENT });
  page.drawText(COMPANY.name.toUpperCase(), { x: M + 24, y: H - 66, size: 13, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`${COMPANY.city} · ${COMPANY.phone} · HST #${COMPANY.hstNumber}`, {
    x: M + 24, y: H - 80, size: 7.5, font, color: rgb(0.7, 0.7, 0.7),
  });
  page.drawText(template.name.toUpperCase(), {
    x: W - M - bold.widthOfTextAtSize(template.name.toUpperCase(), 9), y: H - 66, size: 9, font: bold, color: ACCENT,
  });
  page.drawText(`#FW-${String(form.id).padStart(5, "0")}`, {
    x: W - M - font.widthOfTextAtSize(`#FW-${String(form.id).padStart(5, "0")}`, 8), y: H - 80, size: 8, font, color: rgb(0.7, 0.7, 0.7),
  });
  y = H - 124;

  /* ---------- meta block ---------- */
  const meta: [string, string][] = [
    ["Client", client.name],
    ["Service address", job.address ?? (primary ? formatAddress(primary) : "—")],
    ["Job", `${job.title} (${job.serviceType})`],
    ["Issued", form.sentAt.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })],
  ];
  for (const [k, v] of meta) {
    drawTextLine(k.toUpperCase(), 7.5, bold, SOFT);
    drawTextLine(v, 10.5, font, INK, 130);
    y -= 17;
  }
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });
  y -= 22;

  /* ---------- body ---------- */
  for (const rawLine of content.split("\n")) {
    if (!rawLine.trim()) {
      y -= 9;
      ensure(9);
      continue;
    }
    const isHeader = rawLine === rawLine.toUpperCase() && rawLine.length > 6 && !/^\s|\$/.test(rawLine);
    const f = isHeader ? bold : font;
    const size = isHeader ? 10 : 9.5;
    for (const ln of wrap(rawLine, size, f, W - M * 2)) {
      ensure(15);
      drawTextLine(ln, size, f, isHeader ? INK : rgb(0.18, 0.19, 0.2));
      y -= isHeader ? 16 : 14;
    }
  }
  y -= 14;

  /* ---------- totals box ---------- */
  const { subtotal, hst, total } = computeTotals(job.lineItems);
  ensure(76);
  const bx = W - M - 210;
  page.drawRectangle({ x: bx, y: y - 62, width: 210, height: 68, color: rgb(0.965, 0.96, 0.945), borderColor: LINE, borderWidth: 1 });
  page.drawText("Subtotal", { x: bx + 14, y: y - 18, size: 9, font, color: SOFT });
  page.drawText(`$${subtotal.toFixed(2)}`, { x: bx + 196 - font.widthOfTextAtSize(`$${subtotal.toFixed(2)}`, 9), y: y - 18, size: 9, font });
  page.drawText("HST (13%)", { x: bx + 14, y: y - 34, size: 9, font, color: SOFT });
  page.drawText(`$${hst.toFixed(2)}`, { x: bx + 196 - font.widthOfTextAtSize(`$${hst.toFixed(2)}`, 9), y: y - 34, size: 9, font });
  page.drawText("TOTAL (CAD)", { x: bx + 14, y: y - 53, size: 10, font: bold });
  page.drawText(`$${total.toFixed(2)}`, { x: bx + 196 - bold.widthOfTextAtSize(`$${total.toFixed(2)}`, 10), y: y - 53, size: 10, font: bold });
  y -= 96;

  /* ---------- signature ---------- */
  ensure(170);
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });
  y -= 24;
  drawTextLine("SIGNATURE", 8, bold, SOFT);
  y -= 12;

  if (form.status === "signed") {
    const sigTop = y;
    let sigH = 0;
    if (form.signatureUrl?.startsWith("data:image/png")) {
      try {
        const b64 = form.signatureUrl.split(",")[1];
        const png = await pdf.embedPng(Buffer.from(b64, "base64"));
        const scale = Math.min(190 / png.width, 74 / png.height);
        const w = png.width * scale;
        sigH = png.height * scale;
        page.drawImage(png, { x: M, y: y - sigH, width: w, height: sigH });
      } catch {
        /* fall through to typed name */
      }
    }
    if (!sigH) {
      page.drawText(form.signerName ?? "", { x: M, y: y - 40, size: 30, font: oblique, color: INK });
      sigH = 44;
    }
    y = sigTop - sigH - 8;
    page.drawLine({ start: { x: M, y }, end: { x: M + 240, y }, thickness: 1, color: INK });
    y -= 14;
    drawTextLine(`${form.signerName} — signed electronically`, 9, font);
    y -= 14;
    drawTextLine(
      `${form.signedAt ? form.signedAt.toLocaleString("en-CA", { dateStyle: "long", timeStyle: "short" }) : ""} · IP ${form.signerIp ?? "—"}${form.signerEmail ? ` · ${form.signerEmail}` : ""}`,
      8, font, SOFT
    );
    y -= 22;
    drawTextLine("AUDIT TRAIL", 8, bold, SOFT);
    y -= 13;
    for (const e of form.events) {
      for (const ln of wrap(
        `${e.event.toUpperCase()} — ${new Date(e.at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}${e.ip ? ` · IP ${e.ip}` : ""}${e.meta ? ` · ${e.meta}` : ""}`,
        7.5, font, W - M * 2
      )) {
        ensure(12);
        drawTextLine(ln, 7.5, font, SOFT);
        y -= 11;
      }
    }
  } else {
    page.drawRectangle({ x: M, y: y - 90, width: W - M * 2, height: 90, borderColor: LINE, borderWidth: 1, borderDashArray: [4, 4] });
    page.drawText("Awaiting client signature", { x: M + 16, y: y - 50, size: 10, font: oblique, color: SOFT });
    y -= 110;
  }

  /* ---------- footer ---------- */
  const foot = `Generated by Benchbook for ${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone} · HST #${COMPANY.hstNumber}`;
  for (const p of pdf.getPages()) {
    p.drawText(foot, { x: M, y: 34, size: 7, font, color: SOFT });
    p.drawLine({ start: { x: M, y: 48 }, end: { x: W - M, y: 48 }, thickness: 0.75, color: LINE });
  }

  const bytes = await pdf.save();
  const safeName = `${template.key}-${client.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}"`,
    },
  });
}
