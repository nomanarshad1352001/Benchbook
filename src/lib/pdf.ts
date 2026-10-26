/* Browser-side PDF generation with pdf-lib (works on any static host). */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { COMPANY } from "@/lib/constants";
import { computeTotals, formatAddress, primaryAddress, resolveTemplate, type DataSet } from "@/lib/model";

const INK = rgb(0.086, 0.09, 0.102);
const SOFT = rgb(0.4, 0.41, 0.43);
const LINE = rgb(0.87, 0.86, 0.84);
const ACCENT = rgb(0.96, 0.62, 0.04);

export async function buildFormPdf(d: DataSet, formId: number): Promise<Uint8Array> {
  const form = d.forms.find((f) => f.id === formId);
  if (!form) throw new Error("Form not found");
  const job = d.jobs.find((j) => j.id === form.jobId);
  const client = d.clients.find((c) => c.id === form.clientId);
  const template = d.templates.find((t) => t.key === form.templateKey);
  if (!job || !client || !template) throw new Error("Record incomplete");

  const primary = primaryAddress(client);
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

  const W = 612, H = 792, M = 56;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const ensure = (need: number) => {
    if (y - need < 64) { page = pdf.addPage([W, H]); y = H - M; }
  };
  const drawLine = (text: string, size: number, f: PDFFont, color = INK, indent = 0) => {
    page.drawText(text, { x: M + indent, y, size, font: f, color });
  };
  const wrap = (text: string, size: number, f: PDFFont, maxW: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  /* header band */
  page.drawRectangle({ x: 0, y: H - 92, width: W, height: 92, color: INK });
  page.drawRectangle({ x: M, y: H - 66, width: 14, height: 14, color: ACCENT });
  page.drawText(COMPANY.name.toUpperCase(), { x: M + 24, y: H - 66, size: 13, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`${COMPANY.city} · ${COMPANY.phone} · HST #${COMPANY.hstNumber}`, {
    x: M + 24, y: H - 80, size: 7.5, font, color: rgb(0.7, 0.7, 0.7),
  });
  page.drawText(template.name.toUpperCase(), {
    x: W - M - bold.widthOfTextAtSize(template.name.toUpperCase(), 9), y: H - 66, size: 9, font: bold, color: ACCENT,
  });
  const ref = `#FW-${String(form.id).padStart(5, "0")}`;
  page.drawText(ref, { x: W - M - font.widthOfTextAtSize(ref, 8), y: H - 80, size: 8, font, color: rgb(0.7, 0.7, 0.7) });
  y = H - 124;

  /* meta */
  const meta: [string, string][] = [
    ["Client", client.name],
    ["Service address", job.address ?? (primary ? formatAddress(primary) : "—")],
    ["Job", `${job.title} (${job.serviceType})`],
    ["Issued", new Date(form.sentAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })],
  ];
  for (const [k, v] of meta) {
    drawLine(k.toUpperCase(), 7.5, bold, SOFT);
    for (const part of wrap(v, 10.5, font, W - M * 2 - 130)) {
      drawLine(part, 10.5, font, INK, 130);
      y -= 17;
    }
  }
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });
  y -= 22;

  /* body */
  for (const rawLine of content.split("\n")) {
    if (!rawLine.trim()) { y -= 9; ensure(9); continue; }
    const isHeader = rawLine === rawLine.toUpperCase() && rawLine.length > 6 && !/^\s|\$/.test(rawLine);
    const f = isHeader ? bold : font;
    const size = isHeader ? 10 : 9.5;
    for (const ln of wrap(rawLine, size, f, W - M * 2)) {
      ensure(15);
      drawLine(ln, size, f, isHeader ? INK : rgb(0.18, 0.19, 0.2));
      y -= isHeader ? 16 : 14;
    }
  }
  y -= 14;

  /* totals */
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

  /* signature */
  ensure(170);
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });
  y -= 24;
  drawLine("SIGNATURE", 8, bold, SOFT);
  y -= 12;

  if (form.status === "signed") {
    const sigTop = y;
    let sigH = 0;
    if (form.signatureUrl?.startsWith("data:image/png")) {
      try {
        const b64 = form.signatureUrl.split(",")[1];
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const png = await pdf.embedPng(bytes);
        const scale = Math.min(190 / png.width, 74 / png.height);
        sigH = png.height * scale;
        page.drawImage(png, { x: M, y: y - sigH, width: png.width * scale, height: sigH });
      } catch { /* typed fallback */ }
    }
    if (!sigH) {
      page.drawText(form.signerName ?? "", { x: M, y: y - 40, size: 30, font: oblique, color: INK });
      sigH = 44;
    }
    y = sigTop - sigH - 8;
    page.drawLine({ start: { x: M, y }, end: { x: M + 240, y }, thickness: 1, color: INK });
    y -= 14;
    drawLine(`${form.signerName} — signed electronically`, 9, font);
    y -= 14;
    drawLine(
      `${form.signedAt ? new Date(form.signedAt).toLocaleString("en-CA", { dateStyle: "long", timeStyle: "short" }) : ""} · IP ${form.signerIp ?? "recorded on-device"}${form.signerEmail ? ` · ${form.signerEmail}` : ""}`,
      8, font, SOFT
    );
    y -= 22;
    drawLine("AUDIT TRAIL", 8, bold, SOFT);
    y -= 13;
    for (const e of form.events) {
      for (const ln of wrap(
        `${e.event.toUpperCase()} — ${new Date(e.at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}${e.ip ? ` · IP ${e.ip}` : ""}${e.meta ? ` · ${e.meta}` : ""}`,
        7.5, font, W - M * 2
      )) {
        ensure(12);
        drawLine(ln, 7.5, font, SOFT);
        y -= 11;
      }
    }
  } else {
    page.drawRectangle({ x: M, y: y - 90, width: W - M * 2, height: 90, borderColor: LINE, borderWidth: 1, borderDashArray: [4, 4] });
    page.drawText("Awaiting client signature", { x: M + 16, y: y - 50, size: 10, font: oblique, color: SOFT });
    y -= 110;
  }

  const foot = `Generated by Benchbook for ${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone} · HST #${COMPANY.hstNumber}`;
  for (const p of pdf.getPages()) {
    p.drawText(foot, { x: M, y: 34, size: 7, font, color: SOFT });
    p.drawLine({ start: { x: M, y: 48 }, end: { x: W - M, y: 48 }, thickness: 0.75, color: LINE });
  }

  return pdf.save();
}
