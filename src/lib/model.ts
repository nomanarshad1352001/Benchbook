/* =========================================================================
   Pure data model — types, math, template resolution, seed data, CSV I/O.
   No DB, no server-only deps. Shared by the browser store, the PDF builder
   and the /api/v1 sandbox.
   ========================================================================= */

import { AVATARS, COMPANY, WORK_PHOTOS } from "@/lib/constants";

/* ------------------------------- types ------------------------------- */

export interface Address {
  label: string; line1: string; city: string; province: string; postal: string; primary?: boolean;
}
export interface LineItem {
  id: number; description: string; kind: "labour" | "material"; qty: number; unit: string; rate: number;
}
export interface AuditEvent { at: string; event: string; ip?: string | null; meta?: string | null; }

export interface User {
  id: number; name: string; email: string; password: string;
  role: "admin" | "office" | "field"; phone: string | null; color: string; avatarUrl: string | null;
}
export interface Client {
  id: number; name: string; email: string | null; phone: string | null;
  leadSource: string; tags: string[]; addresses: Address[]; notes: string | null;
  createdAt: string; updatedAt: string;
}
export interface Job {
  id: number; clientId: number; title: string; serviceType: string; stage: string;
  address: string | null; description: string | null; lineItems: LineItem[];
  scheduledStart: string | null; scheduledEnd: string | null; lostReason: string | null;
  assigneeId: number | null; createdById: number | null; createdAt: string; updatedAt: string;
}
export interface Appointment {
  id: number; jobId: number | null; clientId: number; title: string; type: string;
  startsAt: string; endsAt: string; assigneeId: number | null; notes: string | null;
  status: string; createdAt: string;
}
export interface FormTemplate {
  key: string; name: string; description: string; body: string; nextStage: string | null; updatedAt: string;
}
export interface Form {
  id: number; token: string; templateKey: string; jobId: number; clientId: number;
  status: string; channel: string; recipient: string | null; content: string;
  clientNote: string | null; signerName: string | null; signerEmail: string | null;
  signerIp: string | null; signatureUrl: string | null; sentById: number | null;
  events: AuditEvent[]; sentAt: string; signedAt: string | null; createdAt: string;
}
export interface Note { id: number; clientId: number; jobId: number | null; userId: number | null; body: string; createdAt: string; }
export interface Photo { id: number; clientId: number; jobId: number | null; url: string; caption: string | null; createdAt: string; }
export interface Activity { id: number; clientId: number | null; jobId: number | null; userId: number | null; kind: string; message: string; createdAt: string; }
export interface ApiKey { id: number; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revoked: boolean; }
export interface WebhookEndpoint { id: number; url: string; events: string[]; secret: string; active: boolean; createdAt: string; }
export interface Delivery { id: number; endpointId: number; event: string; payload: unknown; status: string; responseCode: number | null; createdAt: string; }

export interface DataSet {
  users: User[]; clients: Client[]; jobs: Job[]; appointments: Appointment[];
  templates: FormTemplate[]; forms: Form[]; notes: Note[]; photos: Photo[];
  activities: Activity[]; apiKeys: ApiKey[]; webhooks: WebhookEndpoint[]; deliveries: Delivery[];
}

export const DEMO_API_KEY = "fwk_live_demokey7a3f9b2c4d8e1560";

/* ------------------------------- math ------------------------------- */

export function computeTotals(items: LineItem[]): { subtotal: number; hst: number; total: number } {
  const subtotal = items.reduce((s, it) => s + it.qty * it.rate, 0);
  const hst = Math.round(subtotal * 0.13 * 100) / 100;
  return { subtotal, hst, total: subtotal + hst };
}

export function itemsSummary(items: LineItem[]): string {
  if (!items.length) return "  (no line items yet)";
  return items
    .map((it, i) => `  ${i + 1}. ${it.description} — ${it.qty} ${it.unit} × $${it.rate.toFixed(2)} = $${(it.qty * it.rate).toFixed(2)}`)
    .join("\n");
}

export function formatAddress(a: Pick<Address, "line1" | "city" | "province" | "postal">): string {
  return `${a.line1}, ${a.city}, ${a.province} ${a.postal}`;
}

export function primaryAddress(c: Client): Address | undefined {
  return c.addresses.find((a) => a.primary) ?? c.addresses[0];
}

export function resolveTemplate(
  body: string,
  ctx: {
    client: Pick<Client, "name" | "email" | "phone">;
    clientAddress: string;
    job: Pick<Job, "title" | "serviceType" | "address" | "lineItems" | "description">;
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
    "date.today": new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }),
  };
  let out = body;
  for (const [k, v] of Object.entries(map)) out = out.split(`{{${k}}}`).join(v);
  return out;
}

/* ------------------------------- CSV ------------------------------- */

const CSV_HEADERS = ["name", "email", "phone", "lead_source", "tags", "address", "city", "postal"];

export function clientsToCsv(clients: Client[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = clients.map((c) => {
    const a = primaryAddress(c);
    return [
      c.name, c.email ?? "", c.phone ?? "", c.leadSource, c.tags.join(" | "),
      a?.line1 ?? "", a?.city ?? "", a?.postal ?? "",
    ].map((v) => esc(String(v))).join(",");
  });
  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function parseClientsCsv(csv: string): { name: string; email: string; phone: string; leadSource: string; tags: string[]; address?: Address }[] {
  const parseRow = (line: string): string[] => {
    const out: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const [name, email, phone, leadSource, tags, line1, city, postal] = parseRow(line);
    return {
      name: (name ?? "").replace(/^"|"$/g, ""),
      email: email || "", phone: phone || "", leadSource: leadSource || "Import",
      tags: (tags || "").split(/[|;]/).map((t) => t.trim()).filter(Boolean).slice(0, 8),
      address: line1 ? { label: "Home", line1, city: city || "Toronto", province: "ON", postal: postal || "", primary: true } : undefined,
    };
  }).filter((r) => r.name);
}

/* ------------------------------- seed ------------------------------- */

function day(offsetDays: number, hour: number, min = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}
const daysAgo = (n: number, h = 10, m = 0) => day(-n, h, m);
const li = (id: number, description: string, kind: "labour" | "material", qty: number, unit: string, rate: number): LineItem =>
  ({ id, description, kind, qty, unit, rate });
const addr = (label: string, line1: string, postal: string): Address =>
  ({ label, line1, city: "Toronto", province: "ON", postal, primary: true });

const DESCRIPTIONS: Record<string, string> = {
  "Deck board replacement & re-stain": "Replace ~14 cupped cedar boards, re-secure lifted screws, wash and re-stain deck (~320 sq ft).",
  "Kitchen faucet & shut-off valves": "Replace failing faucet and both corroded angle stops; check drain for slow leak noted by tenant.",
  "Fence gate rebuild (cedar)": "Rebuild sagging 42\" cedar gate — new frame, Z-brace, heavy hinges and re-set latch post if needed.",
  "Basement door rehang + lockset": "Rehang rubbed basement door, plane strike edge, replace passage set with keyed entry set.",
  "Bathroom vanity replacement": "Swap 30-year-old vanity for client-selected 36\" unit. Reconnect supply and drain, reseal.",
  "Pot lights — living room (6×)": "Fish six recessed gimbal fixtures across lofted ceiling, new dimmer, patch and blend.",
  "Accent wall + trim paint, den": "Feature wall in client colour plus all trim and doors refreshed in semi-gloss white.",
  "Floating shelves — office nook": "Three white-oak floating shelves on concealed steel brackets over desk nook.",
  "Eavestrough clean & re-slope": "Clean and flush both runs, re-slope toward downspouts, re-hang loose sections.",
  "TV wall-mount + concealed wiring": "Full-motion mount for 65\" TV, move receptacle behind TV, in-wall rated HDMI run.",
  "Drywall patch & paint — hallway": "Patch doorknob-size hole plus two stress cracks; prime and blend paint.",
  "Main floor refresh — walls & trim": "Two coats walls (living, dining, hall) plus enamel on trim and doors. Colour card approved.",
  "Exterior caulking — 12 windows": "Strip failed caulk and re-seal twelve window perimeters on Buildings A & B.",
  "Vanity + exhaust fan fixes": "Re-secure loose washroom vanity, reseal, replace noisy exhaust fan motor.",
  "Handrail install — front steps": "Wrought-iron rail anchored into concrete steps, height to code, touch-up paint.",
  "Shower re-caulk & cartridge swap": "Strip mouldy silicone, re-caulk enclosure, replace seized Moen cartridge.",
  "Storm door install": "Supply and install aluminum storm door, set closer and hardware.",
  "Gutter guards — both buildings": "Micro-mesh guards on second-storey gutters, both buildings (~220 linear ft).",
  "Kitchen backsplash — zellige tile": "Handmade-look zellige backsplash, ~28 sq ft, white grout, sealed.",
  "Wainscoting — dining room": "Panel-mould wainscoting with cap rail, 42 linear ft, sprayed enamel finish.",
  "Outlet & dimmer fixes (warranty)": "Warranty call — replace worn receptacles and two flickery dimmers.",
  "Full basement finish — quote": "Scope A: framed bedroom, bath rough-in allowance, LVP flooring, paint.",
};

export function buildSeed(): DataSet {
  const users: User[] = [
    { id: 1, name: "Dan Whitfield", email: "dan@fixwell.ca", password: "demo1234", role: "admin", phone: "(416) 555-0110", color: "#f59e0b", avatarUrl: AVATARS.dan },
    { id: 2, name: "Priya Sharma", email: "priya@fixwell.ca", password: "demo1234", role: "office", phone: "(416) 555-0111", color: "#8b5cf6", avatarUrl: AVATARS.priya },
    { id: 3, name: "Marcus Cole", email: "marcus@fixwell.ca", password: "demo1234", role: "field", phone: "(416) 555-0112", color: "#3b82f6", avatarUrl: AVATARS.marcus },
    { id: 4, name: "Tanya Rivera", email: "tanya@fixwell.ca", password: "demo1234", role: "field", phone: "(416) 555-0113", color: "#22c55e", avatarUrl: AVATARS.tanya },
    { id: 5, name: "Jim Kowalski", email: "jim@fixwell.ca", password: "demo1234", role: "field", phone: "(416) 555-0114", color: "#ec4899", avatarUrl: AVATARS.jim },
  ];

  const cl: Array<[string, string, string, string, string[], Address[], string | null, number]> = [
    ["Eleanor Vance", "eleanor.vance@gmail.com", "(416) 555-0134", "Referral", ["Repeat", "VIP"], [addr("Home", "88 Roxborough St E", "M4W 1V7")], "Prefers weekday mornings. Side gate lock code 4471. Dog (friendly, barks).", 210],
    ["Marcus Bell", "mbell88@outlook.com", "(647) 555-0192", "Google", ["New"], [addr("Home", "214 Logan Ave", "M4M 2M9")], null, 12],
    ["Sofia Ricci", "sofia.ricci@icloud.com", "(416) 555-0173", "Repeat client", ["Repeat"], [addr("Home", "47 Gough Ave", "M4K 3N8")], "Three jobs with us since 2023. Pays by e-transfer.", 400],
    ["The Beaconsfield — Nadia Osei", "nadia@beaconsfieldpm.ca", "(416) 555-0155", "Commercial", ["Property mgmt", "Commercial"], [addr("Building A", "1159 Queen St W", "M6J 1J4"), { ...addr("Building B", "38 Gladstone Ave", "M6J 3K6"), primary: false }], "PO required on invoices over $1,000. Key pickup at site office.", 150],
    ["Anita Desai", "anita.desai@rogers.com", "(416) 555-0188", "HomeStars", ["Senior"], [addr("Home", "62 Brookview Dr", "M6A 2K1")], "Prefers written quotes over email before any phone call. Daughter handles payments.", 40],
    ["Tom & Grace Whitaker", "whitaker.tg@gmail.com", "(416) 555-0102", "Referral", ["Repeat"], [addr("Home", "301 Humberside Ave", "M6P 1K4")], "Grace works from home Tuesdays — schedule around meetings.", 96],
    ["Jordan Lee", "jordan.lee.tor@gmail.com", "(647) 555-0161", "Facebook", ["New"], [addr("Home", "19 Balfour Beach Rd", "M4C 2A4")], null, 6],
    ["Harriet Cohen", "hcohen@sympatico.ca", "(416) 555-0149", "Repeat client", ["Repeat", "Warranty"], [addr("Home", "25 Castlefield Ave", "M4R 1G3")], "Outlet work under 12-month workmanship warranty.", 320],
    ["Riverside Dental — Dr. May Chen", "frontdesk@riversidedental.ca", "(416) 555-0120", "Commercial", ["Commercial"], [addr("Clinic", "720 Queen St E", "M4M 1H2")], "Work must happen after 6 PM or weekends — clinic hours 8–5.", 62],
    ["Owen Gallagher", "owen.gall@gmail.com", "(437) 555-0176", "Google", ["New"], [addr("Home", "140 Maplewood Ave", "M6C 1J7")], null, 3],
    ["Farah Nasser", "farah.n@gmail.com", "(437) 555-0180", "Kijiji", ["New"], [addr("Home", "57 Greenwood Ave, Unit 3", "M4L 2P7")], "Tenant — coordinate with landlord for approval.", 2],
    ["Bill & Doris Petrov", "petrov.bd@gmail.com", "(416) 555-0126", "Repeat client", ["Repeat", "Senior"], [addr("Home", "9 Kingsmount Park Rd", "M4L 3L3")], "Ladder work reviewed with son (Mark) first — (416) 555-0190.", 180],
    ["Keiko Tanaka", "keiko.t.tanaka@gmail.com", "(416) 555-0141", "Referral", ["Designer referral"], [addr("Home", "22 Macpherson Ave", "M5R 1W8")], "Referred by Studio North interiors. High finish expectations — photos at every milestone.", 75],
    ["Sam O'Riley", "sam.oriley@yahoo.ca", "(647) 555-0108", "Walk-in", ["New"], [addr("Home", "208 Rhodes Ave", "M4L 2Z9")], null, 1],
  ];
  const clients: Client[] = cl.map((c, i) => ({
    id: i + 1, name: c[0], email: c[1], phone: c[2], leadSource: c[3], tags: c[4],
    addresses: c[5], notes: c[6], createdAt: daysAgo(c[7]), updatedAt: daysAgo(Math.max(0, c[7] - 5)),
  }));
  const A = (id: number) => formatAddress(primaryAddress(clients[id - 1])!);

  const jb: Array<[number, string, string, string, LineItem[], number, number | null, string | null, string | null, string | null]> = [
    [10, "Deck board replacement & re-stain", "Decks & Fences", "lead", [], 3, null, null, null, null],
    [11, "Kitchen faucet & shut-off valves", "Plumbing", "lead", [], 2, null, null, null, null],
    [7, "Fence gate rebuild (cedar)", "Decks & Fences", "lead", [], 1, null, null, null, null],
    [14, "Basement door rehang + lockset", "Doors & Windows", "lead", [], 0, 3, day(2, 9), day(2, 11), null],
    [5, "Bathroom vanity replacement", "Plumbing", "quoted", [li(1, "Remove old vanity, cap & re-connect supply and drain", "labour", 3, "hrs", 95), li(2, "36\" vanity + top (client-selected)", "material", 1, "ea", 689), li(3, "Faucet, P-trap, braided supplies, silicone", "material", 1, "lot", 146)], 9, null, null, null, null],
    [6, "Pot lights — living room (6×)", "Electrical", "quoted", [li(1, "Cut-in, wire & trim 6 recessed fixtures", "labour", 5, "hrs", 95), li(2, "4\" LED gimbal fixtures, dimmable", "material", 6, "ea", 42), li(3, "14/2 NMD90, connectors, dimmer", "material", 1, "lot", 118)], 7, null, null, null, null],
    [13, "Accent wall + trim paint, den", "Painting", "quoted", [li(1, "Prep, cut & roll feature wall + all trim", "labour", 6, "hrs", 85), li(2, "Benjamin Moore Aura — colour matched", "material", 2, "gal", 92), li(3, "Caulk, filler, tape, sundries", "material", 1, "lot", 38)], 6, null, null, null, null],
    [3, "Floating shelves — office nook", "Carpentry", "quoted", [li(1, "Build & install 3 white-oak floating shelves", "labour", 4, "hrs", 95), li(2, "White oak 8/4 stock, brackets, finish", "material", 1, "lot", 265)], 5, null, null, null, null],
    [12, "Eavestrough clean & re-slope", "Gutter & Exterior", "approved", [li(1, "Clean, flush & re-slope 140 ft eavestrough", "labour", 5, "hrs", 85), li(2, "Hangers, sealant, downpipe extension", "material", 1, "lot", 84)], 12, 5, null, null, null],
    [2, "TV wall-mount + concealed wiring", "Electrical", "approved", [li(1, "Mount 65\" TV, relocate receptacle, fish HDMI", "labour", 3, "hrs", 95), li(2, "Full-motion mount, recessed box, plate", "material", 1, "lot", 189)], 11, 3, null, null, null],
    [8, "Drywall patch & paint — hallway", "Drywall & Patching", "approved", [li(1, "Cut out damaged section, patch, tape, 3 coats mud", "labour", 4, "hrs", 85), li(2, "Sand, prime & blend paint to match", "labour", 2, "hrs", 85), li(3, "Drywall, compound, primer, paint", "material", 1, "lot", 96)], 10, 4, null, null, null],
    [1, "Main floor refresh — walls & trim", "Painting", "scheduled", [li(1, "Walls, 2 coats — living, dining, hall", "labour", 18, "hrs", 85), li(2, "Trim & doors, enamel", "labour", 8, "hrs", 85), li(3, "Paint (client colours), primer, sundries", "material", 1, "lot", 420)], 16, 4, day(1, 8, 30), day(3, 16), null],
    [4, "Exterior caulking — 12 windows", "Gutter & Exterior", "scheduled", [li(1, "Strip & re-caulk 12 window perimeters", "labour", 7, "hrs", 85), li(2, "High-movement exterior sealant ×6", "material", 6, "tubes", 14)], 14, 5, day(2, 9), day(2, 16), null],
    [9, "Vanity + exhaust fan fixes", "General Repairs", "scheduled", [li(1, "Secure vanity, reseal, quiet-hinge adjust", "labour", 2, "hrs", 110), li(2, "Replace exhaust fan motor & grille", "labour", 1, "hrs", 110), li(3, "Fan motor kit, sealant, fasteners", "material", 1, "lot", 128)], 13, 3, day(4, 18), day(4, 21), null],
    [5, "Handrail install — front steps", "Carpentry", "scheduled", [li(1, "Set posts, fit & anchor wrought-iron rail", "labour", 3, "hrs", 95), li(2, "Rail kit, masonry anchors, touch-up paint", "material", 1, "lot", 214)], 15, 5, day(5, 10), day(5, 13), null],
    [3, "Shower re-caulk & cartridge swap", "Plumbing", "completed", [li(1, "Strip & re-caulk shower enclosure", "labour", 2, "hrs", 95), li(2, "Replace Moen 1225 cartridge, test", "labour", 1, "hrs", 95), li(3, "Cartridge, 100% silicone", "material", 1, "lot", 58)], 24, 3, daysAgo(2, 9), daysAgo(2, 12), null],
    [6, "Storm door install", "Doors & Windows", "completed", [li(1, "Fit & hang storm door, hardware, closer", "labour", 4, "hrs", 95), li(2, "Aluminum storm door (white)", "material", 1, "ea", 449)], 26, 5, daysAgo(3, 13), daysAgo(3, 17), null],
    [4, "Gutter guards — both buildings", "Gutter & Exterior", "completed", [li(1, "Install micro-mesh guards, 2 storeys", "labour", 8, "hrs", 85), li(2, "Micro-mesh guard panels 220 ft", "material", 220, "ft", 2.4)], 30, 5, daysAgo(4, 8), daysAgo(4, 15), null],
    [1, "Kitchen backsplash — zellige tile", "General Repairs", "paid", [li(1, "Set zellige tile ~28 sq ft, grout, seal", "labour", 9, "hrs", 95), li(2, "Thinset, grout (white), sealer, trim", "material", 1, "lot", 238)], 46, null, null, null, null],
    [13, "Wainscoting — dining room", "Carpentry", "paid", [li(1, "Install MDF panel moulding + cap rail, 42 ft", "labour", 14, "hrs", 95), li(2, "MDF millwork, adhesive, caulk", "material", 1, "lot", 512), li(3, "Spray prime & 2 coats enamel", "labour", 4, "hrs", 85)], 52, null, null, null, null],
    [8, "Outlet & dimmer fixes (warranty)", "Electrical", "paid", [li(1, "Replace 3 worn receptacles + 2 dimmers", "labour", 2, "hrs", 95), li(2, "Decora devices, plates", "material", 1, "lot", 74)], 34, null, null, null, null],
    [7, "Full basement finish — quote", "General Repairs", "lost", [li(1, "Full basement finish — scope A", "labour", 1, "job", 14800)], 10, null, null, null, "Went with a general contractor for full reno"],
  ];
  const jobs: Job[] = jb.map((j, i) => ({
    id: i + 1, clientId: j[0], title: j[1], serviceType: j[2], stage: j[3], lineItems: j[4],
    createdAt: daysAgo(j[5], 11), updatedAt: daysAgo(Math.max(0, j[5] - 3), 15),
    assigneeId: j[6], scheduledStart: j[7], scheduledEnd: j[8], lostReason: j[9],
    address: A(j[0]), description: DESCRIPTIONS[j[1]] ?? "Scope as discussed on site visit.",
    createdById: 2,
  }));
  const J = Object.fromEntries(jobs.map((r) => [r.title, r]));
  const C = (id: number) => clients[id - 1];

  const ap = (jobTitle: string | null, clientId: number, title: string, type: string, start: string, end: string, assigneeId: number, notes: string | null, status = "scheduled"): Omit<Appointment, "id" | "createdAt"> => ({
    jobId: jobTitle ? J[jobTitle].id : null, clientId, title, type, startsAt: start, endsAt: end, assigneeId, notes, status,
  });
  const appointments: Appointment[] = [
    ap("Main floor refresh — walls & trim", 1, "Main floor refresh — Day 1", "job", day(1, 8, 30), day(1, 16), 4, "Brought colour card for final sign-off."),
    ap("Main floor refresh — walls & trim", 1, "Main floor refresh — Day 2", "job", day(2, 8, 30), day(2, 16), 4, null),
    ap("Main floor refresh — walls & trim", 1, "Main floor refresh — Day 3", "job", day(3, 8, 30), day(3, 15), 4, null),
    ap("Exterior caulking — 12 windows", 4, "Caulking — Building A", "job", day(2, 9), day(2, 13), 5, "Key pickup at site office, ask for Ray."),
    ap("Exterior caulking — 12 windows", 4, "Caulking — Building B", "job", day(2, 13, 30), day(2, 16), 5, null),
    ap("Vanity + exhaust fan fixes", 9, "Clinic fixes (after hours)", "job", day(4, 18), day(4, 21), 3, "After 6 PM only. Alarm code in office file."),
    ap("Handrail install — front steps", 5, "Handrail install", "job", day(5, 10), day(5, 13), 5, "Concrete anchors — bring hammer drill."),
    ap("Basement door rehang + lockset", 14, "Estimate visit — basement door", "estimate", day(2, 9), day(2, 10, 30), 3, null),
    ap("Fence gate rebuild (cedar)", 7, "Estimate visit — fence gate", "estimate", day(1, 13), day(1, 14, 30), 3, null),
    ap("Deck board replacement & re-stain", 10, "Estimate visit — deck", "estimate", day(3, 10), day(3, 11), 5, "Check joists for rot while there."),
    ap("Kitchen faucet & shut-off valves", 11, "Estimate visit — faucet", "estimate", day(1, 16, 30), day(1, 17, 30), 4, "Tenant on-site; landlord cc'd by email text chain."),
    ap("Bathroom vanity replacement", 5, "Measure & confirm vanity", "estimate", day(6, 10), day(6, 11), 3, null),
    ap("Eavestrough clean & re-slope", 12, "Eavestrough work", "job", day(7, 9), day(7, 14), 5, "Mark (son) wants walkthrough at finish."),
    ap("TV wall-mount + concealed wiring", 2, "TV mount install", "job", day(8, 10), day(8, 13), 3, null),
    ap("Drywall patch & paint — hallway", 8, "Patch & paint", "job", day(9, 9), day(9, 15), 4, null),
    ap(null, 1, "Call — re: garden fence quote", "callback", day(1, 17), day(1, 17, 30), 2, null),
    ap(null, 7, "Call — follow up on gate quote", "callback", day(2, 12), day(2, 12, 30), 2, null),
    ap(null, 4, "Call — PO for caulking invoice", "callback", day(3, 11), day(3, 11, 30), 2, null),
    ap("Shower re-caulk & cartridge swap", 3, "Shower work", "job", daysAgo(2, 9), daysAgo(2, 12), 3, null, "done"),
    ap("Storm door install", 6, "Storm door install", "job", daysAgo(3, 13), daysAgo(3, 17), 5, null, "done"),
    ap("Gutter guards — both buildings", 4, "Gutter guards install", "job", daysAgo(4, 8), daysAgo(4, 15), 5, null, "done"),
    ap(null, 13, "Site walkthrough — accent wall colour", "estimate", daysAgo(1, 14), daysAgo(1, 15), 4, null, "done"),
    ap("Pot lights — living room (6×)", 6, "Estimate visit — pot lights", "estimate", day(10, 13), day(10, 14), 3, null),
    ap("Bathroom vanity replacement", 5, "Vanity install", "job", day(12, 9), day(12, 15), 3, "Pending quote approval"),
    ap("Accent wall + trim paint, den", 13, "Paint day — den", "job", day(13, 9), day(13, 16), 4, null),
    ap("Floating shelves — office nook", 3, "Shelf install", "job", day(14, 10), day(14, 13), 5, null),
  ].map((a, i) => ({ ...a, id: i + 1, createdAt: daysAgo(1, 9) }));

  const templates: FormTemplate[] = [
    {
      key: "work-authorization", name: "Estimate approval & work authorization",
      description: "Sent with the estimate. Signature moves the job to Approved.", nextStage: "approved", updatedAt: daysAgo(30),
      body: [
        "ESTIMATE APPROVAL & WORK AUTHORIZATION", "", "Date: {{date.today}}", "Client: {{client.name}}",
        "Service address: {{job.address}}", "", "Project: {{job.title}} ({{job.service}})", "{{job.description}}", "",
        "Estimate (CAD):", "{{job.items}}", "", "Subtotal: {{job.subtotal}}", "HST (13%): {{job.hst}}", "TOTAL: {{job.total}}", "",
        "By signing below, I approve the estimate above and authorize {{company.name}} to schedule and perform the work. Materials are ordered after approval; a 30% deposit may be invoiced for material-heavy projects. Work is covered by a 12-month workmanship warranty.",
        "", "{{company.name}} · {{company.phone}} · {{company.email}}", "HST #{{company.hst}}",
      ].join("\n"),
    },
    {
      key: "change-order", name: "Change order",
      description: "Scope or price change mid-job. Signature acknowledges the change.", nextStage: null, updatedAt: daysAgo(30),
      body: [
        "CHANGE ORDER", "", "Date: {{date.today}}", "Client: {{client.name}}", "Job: {{job.title}} — {{job.address}}", "",
        "Description of change:", "{{job.description}}", "", "Revised pricing (CAD):", "{{job.items}}", "",
        "Revised subtotal: {{job.subtotal}}", "HST (13%): {{job.hst}}", "REVISED TOTAL: {{job.total}}", "",
        "This change order modifies the original estimate. All other terms of the work authorization remain in effect. The schedule may shift as a result of this change; {{company.name}} will confirm revised dates.",
        "", "{{company.name}} · {{company.phone}} · HST #{{company.hst}}",
      ].join("\n"),
    },
    {
      key: "completion-signoff", name: "Job completion sign-off",
      description: "Signed at wrap-up. Signature moves the job to Completed.", nextStage: "completed", updatedAt: daysAgo(30),
      body: [
        "JOB COMPLETION SIGN-OFF", "", "Date: {{date.today}}", "Client: {{client.name}}", "Job: {{job.title}} — {{job.address}}", "",
        "Final invoice summary (CAD):", "{{job.items}}", "", "Subtotal: {{job.subtotal}}", "HST (13%): {{job.hst}}", "FINAL TOTAL: {{job.total}}", "",
        "I confirm the work described above has been completed to my satisfaction, the site was left clean, and I have reviewed care/maintenance notes with the technician. Workmanship is warranted for 12 months from today.",
        "", "Thank you for choosing {{company.name}}.", "{{company.phone}} · {{company.email}}",
      ].join("\n"),
    },
  ];

  const ev = (at: string, event: string, ip: string | null, meta: string | null): AuditEvent => ({ at, event, ip, meta });
  const forms: Form[] = [
    {
      id: 1, token: "fx-sign-cd419e2b8801", templateKey: "completion-signoff", jobId: J["Storm door install"].id, clientId: 6,
      status: "signed", channel: "sms", recipient: "(416) 555-0102", content: "",
      clientNote: null, signerName: "Grace Whitaker", signerEmail: "whitaker.tg@gmail.com", signerIp: "99.244.18.72",
      signatureUrl: null, sentById: 5,
      events: [ev(daysAgo(3, 17, 5), "sent", null, "Text message to (416) 555-0102"), ev(daysAgo(3, 18, 41), "viewed", "99.244.18.72", "iPhone · Safari"), ev(daysAgo(3, 18, 44), "signed", "99.244.18.72", "iPhone · Safari · Grace Whitaker")],
      sentAt: daysAgo(3, 17, 5), signedAt: daysAgo(3, 18, 44), createdAt: daysAgo(3, 17, 5),
    },
    {
      id: 2, token: "fx-sign-7b12aa90335f", templateKey: "change-order", jobId: J["Main floor refresh — walls & trim"].id, clientId: 1,
      status: "sent", channel: "email", recipient: "eleanor.vance@gmail.com", content: "",
      clientNote: null, signerName: null, signerEmail: null, signerIp: null, signatureUrl: null, sentById: 2,
      events: [ev(daysAgo(1, 9, 12), "sent", null, "Email to eleanor.vance@gmail.com")],
      sentAt: daysAgo(1, 9, 12), signedAt: null, createdAt: daysAgo(1, 9, 12),
    },
    {
      id: 3, token: "fx-sign-01e5cc77d902", templateKey: "work-authorization", jobId: J["Floating shelves — office nook"].id, clientId: 3,
      status: "viewed", channel: "sms", recipient: "(416) 555-0173", content: "",
      clientNote: null, signerName: null, signerEmail: null, signerIp: null, signatureUrl: null, sentById: 2,
      events: [ev(daysAgo(2, 10, 2), "sent", null, "Text message to (416) 555-0173"), ev(daysAgo(2, 19, 3), "viewed", "70.28.114.60", "Android · Chrome")],
      sentAt: daysAgo(2, 10, 2), signedAt: null, createdAt: daysAgo(2, 10, 2),
    },
    {
      id: 4, token: "fx-sign-ef9a04cb21d7", templateKey: "work-authorization", jobId: J["Bathroom vanity replacement"].id, clientId: 5,
      status: "sent", channel: "email", recipient: "anita.desai@rogers.com", content: "",
      clientNote: null, signerName: null, signerEmail: null, signerIp: null, signatureUrl: null, sentById: 2,
      events: [ev(daysAgo(1, 15, 40), "sent", null, "Email to anita.desai@rogers.com")],
      sentAt: daysAgo(1, 15, 40), signedAt: null, createdAt: daysAgo(1, 15, 40),
    },
  ];

  const N = (clientId: number, userId: number, body: string, ago: number, jobTitle?: string): Note => ({ clientId, userId, body, createdAt: daysAgo(ago, 13), id: 0, jobId: jobTitle ? J[jobTitle].id : null });
  const notes: Note[] = [
    N(1, 2, "Eleanor called — wants the sunroom quoted after the main floor refresh is done. Keep pricing consistent with last visit.", 1),
    N(1, 4, "Client very happy with day 1 progress. Asked about wall colour in hallway — matched to BM Classic Gray.", 0, "Main floor refresh — walls & trim"),
    N(4, 1, "Nadia confirmed PO #BC-2026-114 covers the caulking job. Invoice goes to accounting@beaconsfieldpm.ca.", 2),
    N(4, 5, "Building B gutter guards done. Two downspouts crushed at grade — flagged to Nadia, quoting separately.", 4, "Gutter guards — both buildings"),
    N(5, 2, "Anita is nervous about the vanity plumbing. Promised photos of shut-offs before we close the wall.", 5),
    N(5, 3, "Vanity arrives at supplier Thursday. Confirmed 36\" as discussed.", 3, "Bathroom vanity replacement"),
    N(8, 4, "Patch blends well in daylight. Second paint coat Friday AM to cure before weekend.", 6, "Drywall patch & paint — hallway"),
    N(13, 1, "Studio North wants photos of the wainscoting for their portfolio — client approved.", 8),
    N(12, 5, "Doris asked us to check the shed door hinges while on the ladder. Added 20 min, no charge — goodwill.", 12),
    N(2, 2, "New client from Google Ads. Very responsive by text.", 10),
    N(7, 2, "Quoted full basement scope — likely going with a GC. Keep relationship warm, send gate quote anyway.", 4),
    N(3, 3, "Shower cartridge was seized — soaked with vinegar, freed up. Showed Sofia the old part.", 2, "Shower re-caulk & cartridge swap"),
  ].map((n, i) => ({ ...n, id: i + 1 }));

  const P = (i: number, clientId: number, caption: string, ago: number, jobTitle?: string): Photo => ({ url: WORK_PHOTOS[i % WORK_PHOTOS.length], clientId, jobId: jobTitle ? J[jobTitle].id : null, caption, createdAt: daysAgo(ago, 12), id: 0 });
  const photos: Photo[] = [
    P(8, 4, "Gutter guards — Building B, after", 4, "Gutter guards — both buildings"),
    P(4, 6, "Storm door hung, hardware on", 3, "Storm door install"),
    P(3, 6, "Frame squared before set", 3, "Storm door install"),
    P(1, 4, "North elevation — caulk failing", 14, "Exterior caulking — 12 windows"),
    P(10, 3, "Shower enclosure — caulk stripped", 2, "Shower re-caulk & cartridge swap"),
    P(6, 5, "Existing vanity — shut-offs corroded", 5, "Bathroom vanity replacement"),
    P(9, 1, "Main floor — walls cut in, day 1", 1, "Main floor refresh — walls & trim"),
    P(11, 13, "Den wall — colour sample patch", 6, "Accent wall + trim paint, den"),
    P(0, 8, "Hallway — section cut out square", 6, "Drywall patch & paint — hallway"),
    P(5, 2, "Stud bay opened for receptacle move", 10, "TV wall-mount + concealed wiring"),
    P(2, 1, "Backsplash finished — zellige", 40, "Kitchen backsplash — zellige tile"),
    P(7, 13, "Wainscoting — cap rail detail", 48, "Wainscoting — dining room"),
  ].map((p, i) => ({ ...p, id: i + 1 }));

  const ACT = (kind: string, message: string, ago: number, clientId?: number, jobTitle?: string, userId?: number): Activity => ({
    kind, message, createdAt: daysAgo(ago, 16), clientId: clientId ?? null, jobId: jobTitle ? J[jobTitle].id : null, userId: userId ?? null, id: 0,
  });
  const activities: Activity[] = [
    ACT("client", "Client added — imported from walk-in list", 0, 14, undefined, 2),
    ACT("job", "Job created from estimate visit booking", 1, 10, "Deck board replacement & re-stain", 2),
    ACT("form", "Work authorization sent by text to Sofia Ricci", 2, 3, "Floating shelves — office nook", 2),
    ACT("stage", "Job moved from Quoted to Approved", 2, 12, "Eavestrough clean & re-slope", 1),
    ACT("stage", "Job moved from Approved to Scheduled", 3, 5, "Handrail install — front steps", 2),
    ACT("form", "Completion sign-off signed by Grace Whitaker", 3, 6, "Storm door install"),
    ACT("stage", "Job moved from Scheduled to Completed", 3, 6, "Storm door install", 5),
    ACT("photo", "3 photos added to job", 3, 6, "Storm door install", 5),
    ACT("note", "Priya added a note", 1, 1, undefined, 2),
    ACT("stage", "Job moved from Scheduled to Completed", 4, 4, "Gutter guards — both buildings", 5),
    ACT("quote", "Estimate updated — paint sundries adjusted", 5, 13, "Accent wall + trim paint, den", 1),
    ACT("stage", "Job moved from Lead to Quoted", 6, 13, "Accent wall + trim paint, den", 2),
    ACT("form", "Work authorization emailed to Anita Desai", 1, 5, "Bathroom vanity replacement", 2),
    ACT("client", "Client added from Google lead", 3, 10, undefined, 2),
    ACT("stage", "Job marked as Lost — Went with a general contractor", 4, 7, "Full basement finish — quote", 1),
    ACT("quote", "Estimate sent — $935.00 + HST", 9, 5, "Bathroom vanity replacement", 2),
    ACT("invoice", "Invoice FW-1042 paid — e-transfer", 9, 8, "Outlet & dimmer fixes (warranty)", 2),
    ACT("invoice", "Invoice FW-1046 paid — cheque", 12, 13, "Wainscoting — dining room", 2),
    ACT("invoice", "Invoice FW-1051 paid — e-transfer", 14, 1, "Kitchen backsplash — zellige tile", 2),
    ACT("note", "Dan added a note re: PO for caulking", 2, 4, undefined, 1),
  ].map((a, i) => ({ ...a, id: i + 1 }));

  const apiKeys: ApiKey[] = [
    { id: 1, name: "QuickBooks sync (demo)", prefix: DEMO_API_KEY.slice(0, 16), createdAt: daysAgo(20), lastUsedAt: daysAgo(0, 8), revoked: false },
  ];
  const webhooks: WebhookEndpoint[] = [
    { id: 1, url: "https://webhook.site/fixwell-demo", events: ["client.created", "job.stage_changed", "form.signed"], secret: "whsec_demo74f2b9c1", active: true, createdAt: daysAgo(20) },
  ];
  const deliveries: Delivery[] = [
    { id: 1, endpointId: 1, event: "form.signed", status: "delivered", responseCode: 200, payload: { id: "evt_p9w31d", event: "form.signed", data: { jobId: 17, signer: "Grace Whitaker" } }, createdAt: daysAgo(3, 18, 45) },
    { id: 2, endpointId: 1, event: "job.stage_changed", status: "failed", responseCode: null, payload: { id: "evt_lm093q", event: "job.stage_changed", data: { jobId: 16, from: "scheduled", to: "completed" } }, createdAt: daysAgo(4, 15, 5) },
  ];

  return { users, clients, jobs, appointments, templates, forms, notes, photos, activities, apiKeys, webhooks, deliveries };
}
