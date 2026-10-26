import "dotenv/config";
import { db, pool } from "@/db";
import * as s from "@/db/schema";
import type { Address, AuditEvent, LineItem } from "@/db/schema";
import { hashPassword, sha256 } from "@/lib/auth";
import { AVATARS, COMPANY, WORK_PHOTOS } from "@/lib/constants";
import { sql } from "drizzle-orm";

export const DEMO_API_KEY = "fwk_live_demokey7a3f9b2c4d8e1560";

const li = (
  id: number,
  description: string,
  kind: "labour" | "material",
  qty: number,
  unit: string,
  rate: number
): LineItem => ({ id, description, kind, qty, unit, rate });

const addr = (label: string, line1: string, postal: string): Address => ({
  label,
  line1,
  city: "Toronto",
  province: "ON",
  postal,
  primary: true,
});

function day(offsetDays: number, hour: number, min = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, min, 0, 0);
  return d;
}

function daysAgo(n: number, h = 10, m = 0): Date {
  const d = day(-n, h);
  d.setMinutes(m);
  return d;
}

export async function ensureSeeded() {
  const rows = await db.select({ n: sql<number>`count(*)` }).from(s.users);
  if (Number(rows[0]?.n ?? 0) > 0) return;
  await seed();
}

export async function seed() {
  /* ---------- wipe ---------- */
  const order = [
    s.webhookDeliveries,
    s.webhookEndpoints,
    s.apiKeys,
    s.activities,
    s.photos,
    s.notes,
    s.forms,
    s.formTemplates,
    s.appointments,
    s.jobs,
    s.clients,
    s.sessions,
    s.users,
  ];
  for (const t of order) {
    await db.execute(sql`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`);
  }

  /* ---------- users ---------- */
  const pw = hashPassword("demo1234");
  const team = await db
    .insert(s.users)
    .values([
      { name: "Dan Whitfield", email: "dan@fixwell.ca", passwordHash: pw, role: "admin", phone: "(416) 555-0110", color: "#f59e0b", avatarUrl: AVATARS.dan },
      { name: "Priya Sharma", email: "priya@fixwell.ca", passwordHash: pw, role: "office", phone: "(416) 555-0111", color: "#8b5cf6", avatarUrl: AVATARS.priya },
      { name: "Marcus Cole", email: "marcus@fixwell.ca", passwordHash: pw, role: "field", phone: "(416) 555-0112", color: "#3b82f6", avatarUrl: AVATARS.marcus },
      { name: "Tanya Rivera", email: "tanya@fixwell.ca", passwordHash: pw, role: "field", phone: "(416) 555-0113", color: "#22c55e", avatarUrl: AVATARS.tanya },
      { name: "Jim Kowalski", email: "jim@fixwell.ca", passwordHash: pw, role: "field", phone: "(416) 555-0114", color: "#ec4899", avatarUrl: AVATARS.jim },
    ])
    .returning();
  const [dan, priya, marcus, tanya, jim] = team;

  /* ---------- clients ---------- */
  const clientRows = await db
    .insert(s.clients)
    .values([
      { name: "Eleanor Vance", email: "eleanor.vance@gmail.com", phone: "(416) 555-0134", leadSource: "Referral", tags: ["Repeat", "VIP"], addresses: [addr("Home", "88 Roxborough St E", "M4W 1V7")], notes: "Prefers weekday mornings. Side gate lock code 4471. Dog (friendly, barks).", createdAt: daysAgo(210) },
      { name: "Marcus Bell", email: "mbell88@outlook.com", phone: "(647) 555-0192", leadSource: "Google", tags: ["New"], addresses: [addr("Home", "214 Logan Ave", "M4M 2M9")], notes: null, createdAt: daysAgo(12) },
      { name: "Sofia Ricci", email: "sofia.ricci@icloud.com", phone: "(416) 555-0173", leadSource: "Repeat client", tags: ["Repeat"], addresses: [addr("Home", "47 Gough Ave", "M4K 3N8")], notes: "Three jobs with us since 2023. Pays by e-transfer.", createdAt: daysAgo(400) },
      { name: "The Beaconsfield — Nadia Osei", email: "nadia@beaconsfieldpm.ca", phone: "(416) 555-0155", leadSource: "Commercial", tags: ["Property mgmt", "Commercial"], addresses: [addr("Building A", "1159 Queen St W", "M6J 1J4"), { ...addr("Building B", "38 Gladstone Ave", "M6J 3K6"), primary: false }], notes: "PO required on invoices over $1,000. Key pickup at site office.", createdAt: daysAgo(150) },
      { name: "Anita Desai", email: "anita.desai@rogers.com", phone: "(416) 555-0188", leadSource: "HomeStars", tags: ["Senior"], addresses: [addr("Home", "62 Brookview Dr", "M6A 2K1")], notes: mating(), createdAt: daysAgo(40) },
      { name: "Tom & Grace Whitaker", email: "whitaker.tg@gmail.com", phone: "(416) 555-0102", leadSource: "Referral", tags: ["Repeat"], addresses: [addr("Home", "301 Humberside Ave", "M6P 1K4")], notes: "Grace works from home Tuesdays — schedule around meetings.", createdAt: daysAgo(96) },
      { name: "Jordan Lee", email: "jordan.lee.tor@gmail.com", phone: "(647) 555-0161", leadSource: "Facebook", tags: ["New"], addresses: [addr("Home", "19 Balfour Beach Rd", "M4C 2A4")], notes: null, createdAt: daysAgo(6) },
      { name: "Harriet Cohen", email: "hcohen@sympatico.ca", phone: "(416) 555-0149", leadSource: "Repeat client", tags: ["Repeat", "Warranty"], addresses: [addr("Home", "25 Castlefield Ave", "M4R 1G3")], notes: "Outlet work under 12-month workmanship warranty.", createdAt: daysAgo(320) },
      { name: "Riverside Dental — Dr. May Chen", email: "frontdesk@riversidedental.ca", phone: "(416) 555-0120", leadSource: "Commercial", tags: ["Commercial"], addresses: [addr("Clinic", "720 Queen St E", "M4M 1H2")], notes: "Work must happen after 6 PM or weekends — clinic hours 8–5.", createdAt: daysAgo(62) },
      { name: "Owen Gallagher", email: "owen.gall@gmail.com", phone: "(437) 555-0176", leadSource: "Google", tags: ["New"], addresses: [addr("Home", "140 Maplewood Ave", "M6C 1J7")], notes: null, createdAt: daysAgo(3) },
      { name: "Farah Nasser", email: "farah.n@gmail.com", phone: "(437) 555-0180", leadSource: "Kijiji", tags: ["New"], addresses: [addr("Home", "57 Greenwood Ave, Unit 3", "M4L 2P7")], notes: "Tenant — coordinate with landlord for approval.", createdAt: daysAgo(2) },
      { name: "Bill & Doris Petrov", email: "petrov.bd@gmail.com", phone: "(416) 555-0126", leadSource: "Repeat client", tags: ["Repeat", "Senior"], addresses: [addr("Home", "9 Kingsmount Park Rd", "M4L 3L3")], notes: "Ladder work reviewed with son (Mark) first — (416) 555-0190.", createdAt: daysAgo(180) },
      { name: "Keiko Tanaka", email: "keiko.t.tanaka@gmail.com", phone: "(416) 555-0141", leadSource: "Referral", tags: ["Designer referral"], addresses: [addr("Home", "22 Macpherson Ave", "M5R 1W8")], notes: "Referred by Studio North interiors. High finish expectations — photos at every milestone.", createdAt: daysAgo(75) },
      { name: "Sam O'Riley", email: "sam.oriley@yahoo.ca", phone: "(647) 555-0108", leadSource: "Walk-in", tags: ["New"], addresses: [addr("Home", "208 Rhodes Ave", "M4L 2Z9")], notes: null, createdAt: daysAgo(1) },
    ])
    .returning();

  const C = Object.fromEntries(clientRows.map((c) => [c.name, c]));
  const A = (name: string) => {
    const c = C[name];
    const a = c.addresses.find((x) => x.primary) ?? c.addresses[0];
    return `${a.line1}, ${a.city}, ${a.province} ${a.postal}`;
  };

  /* ---------- jobs ---------- */
  type SeedJob = {
    client: string; title: string; serviceType: string; stage: string;
    items: LineItem[]; description?: string; created: number; assignee?: number;
    schedStart?: Date; schedEnd?: Date; lost?: string;
  };
  const spec: SeedJob[] = [
    { client: "Owen Gallagher", title: "Deck board replacement & re-stain", serviceType: "Decks & Fences", stage: "lead", created: 3, items: [] },
    { client: "Farah Nasser", title: "Kitchen faucet & shut-off valves", serviceType: "Plumbing", stage: "lead", created: 2, items: [] },
    { client: "Jordan Lee", title: "Fence gate rebuild (cedar)", serviceType: "Decks & Fences", stage: "lead", created: 1, items: [] },
    { client: "Sam O'Riley", title: "Basement door rehang + lockset", serviceType: "Doors & Windows", stage: "lead", created: 0, assignee: marcus.id, schedStart: day(2, 9), schedEnd: day(2, 11), items: [] },
    { client: "Anita Desai", title: "Bathroom vanity replacement", serviceType: "Plumbing", stage: "quoted", created: 9, items: [li(1, "Remove old vanity, cap & re-connect supply and drain", "labour", 3, "hrs", 95), li(2, "36\" vanity + top (client-selected)", "material", 1, "ea", 689), li(3, "Faucet, P-trap, braided supplies, silicone", "material", 1, "lot", 146)] },
    { client: "Tom & Grace Whitaker", title: "Pot lights — living room (6×)", serviceType: "Electrical", stage: "quoted", created: 7, items: [li(1, "Cut-in, wire & trim 6 recessed fixtures", "labour", 5, "hrs", 95), li(2, "4\" LED gimbal fixtures, dimmable", "material", 6, "ea", 42), li(3, "14/2 NMD90, connectors, dimmer", "material", 1, "lot", 118)] },
    { client: "Keiko Tanaka", title: "Accent wall + trim paint, den", serviceType: "Painting", stage: "quoted", created: 6, items: [li(1, "Prep, cut & roll feature wall + all trim", "labour", 6, "hrs", 85), li(2, "Benjamin Moore Aura — colour matched", "material", 2, "gal", 92), li(3, "Caulk, filler, tape, sundries", "material", 1, "lot", 38)] },
    { client: "Sofia Ricci", title: "Floating shelves — office nook", serviceType: "Carpentry", stage: "quoted", created: 5, items: [li(1, "Build & install 3 white-oak floating shelves", "labour", 4, "hrs", 95), li(2, "White oak 8/4 stock, brackets, finish", "material", 1, "lot", 265)] },
    { client: "Bill & Doris Petrov", title: "Eavestrough clean & re-slope", serviceType: "Gutter & Exterior", stage: "approved", created: 12, assignee: jim.id, items: [li(1, "Clean, flush & re-slope 140 ft eavestrough", "labour", 5, "hrs", 85), li(2, "Hangers, sealant, downpipe extension", "material", 1, "lot", 84)] },
    { client: "Marcus Bell", title: "TV wall-mount + concealed wiring", serviceType: "Electrical", stage: "approved", created: 11, assignee: marcus.id, items: [li(1, "Mount 65\" TV, relocate receptacle, fish HDMI", "labour", 3, "hrs", 95), li(2, "Full-motion mount, recessed box, plate", "material", 1, "lot", 189)] },
    { client: "Harriet Cohen", title: "Drywall patch & paint — hallway", serviceType: "Drywall & Patching", stage: "approved", created: 10, assignee: tanya.id, items: [li(1, "Cut out damaged section, patch, tape, 3 coats mud", "labour", 4, "hrs", 85), li(2, "Sand, prime & blend paint to match", "labour", 2, "hrs", 85), li(3, "Drywall, compound, primer, paint", "material", 1, "lot", 96)] },
    { client: "Eleanor Vance", title: "Main floor refresh — walls & trim", serviceType: "Painting", stage: "scheduled", created: 16, assignee: tanya.id, schedStart: day(1, 8, 30), schedEnd: day(3, 16), items: [li(1, "Walls, 2 coats — living, dining, hall", "labour", 18, "hrs", 85), li(2, "Trim & doors, enamel", "labour", 8, "hrs", 85), li(3, "Paint (client colours), primer, sundries", "material", 1, "lot", 420)] },
    { client: "The Beaconsfield — Nadia Osei", title: "Exterior caulking — 12 windows", serviceType: "Gutter & Exterior", stage: "scheduled", created: 14, assignee: jim.id, schedStart: day(2, 9), schedEnd: day(2, 16), items: [li(1, "Strip & re-caulk 12 window perimeters", "labour", 7, "hrs", 85), li(2, "High-movement exterior sealant ×6", "material", 6, "tubes", 14)] },
    { client: "Riverside Dental — Dr. May Chen", title: "Vanity + exhaust fan fixes", serviceType: "General Repairs", stage: "scheduled", created: 13, assignee: marcus.id, schedStart: day(4, 18), schedEnd: day(4, 21), items: [li(1, "Secure vanity, reseal, quiet-hinge adjust", "labour", 2, "hrs", 110), li(2, "Replace exhaust fan motor & grille", "labour", 1, "hrs", 110), li(3, "Fan motor kit, sealant, fasteners", "material", 1, "lot", 128)] },
    { client: "Anita Desai", title: "Handrail install — front steps", serviceType: "Carpentry", stage: "scheduled", created: 15, assignee: jim.id, schedStart: day(5, 10), schedEnd: day(5, 13), items: [li(1, "Set posts, fit & anchor wrought-iron rail", "labour", 3, "hrs", 95), li(2, "Rail kit, masonry anchors, touch-up paint", "material", 1, "lot", 214)] },
    { client: "Sofia Ricci", title: "Shower re-caulk & cartridge swap", serviceType: "Plumbing", stage: "completed", created: 24, assignee: marcus.id, schedStart: daysAgo(2, 9), schedEnd: daysAgo(2, 12), items: [li(1, "Strip & re-caulk shower enclosure", "labour", 2, "hrs", 95), li(2, "Replace Moen 1225 cartridge, test", "labour", 1, "hrs", 95), li(3, "Cartridge, 100% silicone", "material", 1, "lot", 58)] },
    { client: "Tom & Grace Whitaker", title: "Storm door install", serviceType: "Doors & Windows", stage: "completed", created: 26, assignee: jim.id, schedStart: daysAgo(3, 13), schedEnd: daysAgo(3, 17), items: [li(1, "Fit & hang storm door, hardware, closer", "labour", 4, "hrs", 95), li(2, "Aluminum storm door (white)", "material", 1, "ea", 449)] },
    { client: "The Beaconsfield — Nadia Osei", title: "Gutter guards — both buildings", serviceType: "Gutter & Exterior", stage: "completed", created: 30, assignee: jim.id, schedStart: daysAgo(4, 8), schedEnd: daysAgo(4, 15), items: [li(1, "Install micro-mesh guards, 2 storeys", "labour", 8, "hrs", 85), li(2, "Micro-mesh guard panels 220 ft", "material", 220, "ft", 2.4)] },
    { client: "Eleanor Vance", title: "Kitchen backsplash — zellige tile", serviceType: "General Repairs", stage: "paid", created: 46, items: [li(1, "Set zellige tile ~28 sq ft, grout, seal", "labour", 9, "hrs", 95), li(2, "Thinset, grout (white), sealer, trim", "material", 1, "lot", 238)] },
    { client: "Keiko Tanaka", title: "Wainscoting — dining room", serviceType: "Carpentry", stage: "paid", created: 52, items: [li(1, "Install MDF panel moulding + cap rail, 42 ft", "labour", 14, "hrs", 95), li(2, "MDF millwork, adhesive, caulk", "material", 1, "lot", 512), li(3, "Spray prime & 2 coats enamel", "labour", 4, "hrs", 85)] },
    { client: "Harriet Cohen", title: "Outlet & dimmer fixes (warranty)", serviceType: "Electrical", stage: "paid", created: 34, items: [li(1, "Replace 3 worn receptacles + 2 dimmers", "labour", 2, "hrs", 95), li(2, "Decora devices, plates", "material", 1, "lot", 74)] },
    { client: "Jordan Lee", title: "Full basement finish — quote", serviceType: "General Repairs", stage: "lost", created: 10, lost: "Went with a general contractor for full reno", items: [li(1, "Full basement finish — scope A", "labour", 1, "job", 14800)] },
  ];
  const jobRows = [];
  for (const j of spec) {
    const client = C[j.client];
    const [row] = await db
      .insert(s.jobs)
      .values({
        clientId: client.id,
        title: j.title,
        serviceType: j.serviceType,
        stage: j.stage,
        address: A(j.client),
        description: j.description ?? defaultDescription(j.title),
        lineItems: j.items,
        scheduledStart: j.schedStart ?? null,
        scheduledEnd: j.schedEnd ?? null,
        assigneeId: j.assignee ?? null,
        lostReason: j.lost ?? null,
        createdById: priya.id,
        createdAt: daysAgo(j.created, 11),
        updatedAt: daysAgo(Math.max(0, j.created - 3), 15),
      })
      .returning();
    jobRows.push(row);
  }
  const J = Object.fromEntries(jobRows.map((r) => [r.title, r]));

  /* ---------- appointments ---------- */
  const ap = (
    jobTitle: string | null, clientName: string, title: string, type: string,
    start: Date, end: Date, assignee: number, notes?: string, status = "scheduled"
  ) => ({
    jobId: jobTitle ? J[jobTitle].id : null,
    clientId: C[clientName].id,
    title, type, startsAt: start, endsAt: end,
    assigneeId: assignee, notes: notes ?? null, status,
    createdAt: daysAgo(1, 9),
  });
  await db.insert(s.appointments).values([
    ap("Main floor refresh — walls & trim", "Eleanor Vance", "Main floor refresh — Day 1", "job", day(1, 8, 30), day(1, 16), tanya.id, "Brought colour card for final sign-off."),
    ap("Main floor refresh — walls & trim", "Eleanor Vance", "Main floor refresh — Day 2", "job", day(2, 8, 30), day(2, 16), tanya.id),
    ap("Main floor refresh — walls & trim", "Eleanor Vance", "Main floor refresh — Day 3", "job", day(3, 8, 30), day(3, 15), tanya.id),
    ap("Exterior caulking — 12 windows", "The Beaconsfield — Nadia Osei", "Caulking — Building A", "job", day(2, 9), day(2, 13), jim.id, "Key pickup at site office, ask for Ray."),
    ap("Exterior caulking — 12 windows", "The Beaconsfield — Nadia Osei", "Caulking — Building B", "job", day(2, 13, 30), day(2, 16), jim.id),
    ap("Vanity + exhaust fan fixes", "Riverside Dental — Dr. May Chen", "Clinic fixes (after hours)", "job", day(4, 18), day(4, 21), marcus.id, "After 6 PM only. Alarm code in office file."),
    ap("Handrail install — front steps", "Anita Desai", "Handrail install", "job", day(5, 10), day(5, 13), jim.id, "Concrete anchors — bring hammer drill."),
    ap("Basement door rehang + lockset", "Sam O'Riley", "Estimate visit — basement door", "estimate", day(2, 9), day(2, 10, 30), marcus.id),
    ap("Fence gate rebuild (cedar)", "Jordan Lee", "Estimate visit — fence gate", "estimate", day(1, 13), day(1, 14, 30), marcus.id),
    ap("Deck board replacement & re-stain", "Owen Gallagher", "Estimate visit — deck", "estimate", day(3, 10), day(3, 11), jim.id, "Check joists for rot while there."),
    ap("Kitchen faucet & shut-off valves", "Farah Nasser", "Estimate visit — faucet", "estimate", day(1, 16, 30), day(1, 17, 30), tanya.id, "Tenant on-site; landlord cc'd by email text chain."),
    ap("Bathroom vanity replacement", "Anita Desai", "Measure & confirm vanity", "estimate", day(6, 10), day(6, 11), marcus.id),
    ap("Eavestrough clean & re-slope", "Bill & Doris Petrov", "Eavestrough work", "job", day(7, 9), day(7, 14), jim.id, "Mark (son) wants walkthrough at finish."),
    ap("TV wall-mount + concealed wiring", "Marcus Bell", "TV mount install", "job", day(8, 10), day(8, 13), marcus.id),
    ap("Drywall patch & paint — hallway", "Harriet Cohen", "Patch & paint", "job", day(9, 9), day(9, 15), tanya.id),
    ap(null, "Eleanor Vance", "Call — re: garden fence quote", "callback", day(1, 17), day(1, 17, 30), priya.id),
    ap(null, "Jordan Lee", "Call — follow up on gate quote", "callback", day(2, 12), day(2, 12, 30), priya.id),
    ap(null, "The Beaconsfield — Nadia Osei", "Call — PO for caulking invoice", "callback", day(3, 11), day(3, 11, 30), priya.id),
    ap("Shower re-caulk & cartridge swap", "Sofia Ricci", "Shower work", "job", daysAgo(2, 9), daysAgo(2, 12), marcus.id, undefined, "done"),
    ap("Storm door install", "Tom & Grace Whitaker", "Storm door install", "job", daysAgo(3, 13), daysAgo(3, 17), jim.id, undefined, "done"),
    ap("Gutter guards — both buildings", "The Beaconsfield — Nadia Osei", "Gutter guards install", "job", daysAgo(4, 8), daysAgo(4, 15), jim.id, undefined, "done"),
    ap(null, "Keiko Tanaka", "Site walkthrough — accent wall colour", "estimate", daysAgo(1, 14), daysAgo(1, 15), tanya.id, undefined, "done"),
    ap("Pot lights — living room (6×)", "Tom & Grace Whitaker", "Estimate visit — pot lights", "estimate", day(10, 13), day(10, 14), marcus.id),
    ap("Bathroom vanity replacement", "Anita Desai", "Vanity install", "job", day(12, 9), day(12, 15), marcus.id, "Pending quote approval"),
    ap("Accent wall + trim paint, den", "Keiko Tanaka", "Paint day — den", "job", day(13, 9), day(13, 16), tanya.id),
    ap("Floating shelves — office nook", "Sofia Ricci", "Shelf install", "job", day(14, 10), day(14, 13), jim.id),
  ]);

  /* ---------- form templates ---------- */
  await db.insert(s.formTemplates).values([
    {
      key: "work-authorization",
      name: "Estimate approval & work authorization",
      description: "Sent with the estimate. Signature moves the job to Approved.",
      nextStage: "approved",
      body: [
        "ESTIMATE APPROVAL & WORK AUTHORIZATION",
        "",
        "Date: {{date.today}}",
        "Client: {{client.name}}",
        "Service address: {{job.address}}",
        "",
        "Project: {{job.title}} ({{job.service}})",
        "{{job.description}}",
        "",
        "Estimate (CAD):",
        "{{job.items}}",
        "",
        "Subtotal: {{job.subtotal}}",
        "HST (13%): {{job.hst}}",
        "TOTAL: {{job.total}}",
        "",
        "By signing below, I approve the estimate above and authorize {{company.name}} to schedule and perform the work. Materials are ordered after approval; a 30% deposit may be invoiced for material-heavy projects. Work is covered by a 12-month workmanship warranty.",
        "",
        "{{company.name}} · {{company.phone}} · {{company.email}}",
        "HST #{{company.hst}}",
      ].join("\n"),
    },
    {
      key: "change-order",
      name: "Change order",
      description: "Scope or price change mid-job. Signature acknowledges the change.",
      nextStage: null,
      body: [
        "CHANGE ORDER",
        "",
        "Date: {{date.today}}",
        "Client: {{client.name}}",
        "Job: {{job.title}} — {{job.address}}",
        "",
        "Description of change:",
        "{{job.description}}",
        "",
        "Revised pricing (CAD):",
        "{{job.items}}",
        "",
        "Revised subtotal: {{job.subtotal}}",
        "HST (13%): {{job.hst}}",
        "REVISED TOTAL: {{job.total}}",
        "",
        "This change order modifies the original estimate. All other terms of the work authorization remain in effect. The schedule may shift as a result of this change; {{company.name}} will confirm revised dates.",
        "",
        "{{company.name}} · {{company.phone}} · HST #{{company.hst}}",
      ].join("\n"),
    },
    {
      key: "completion-signoff",
      name: "Job completion sign-off",
      description: "Signed at wrap-up. Signature moves the job to Completed.",
      nextStage: "completed",
      body: [
        "JOB COMPLETION SIGN-OFF",
        "",
        "Date: {{date.today}}",
        "Client: {{client.name}}",
        "Job: {{job.title}} — {{job.address}}",
        "",
        "Final invoice summary (CAD):",
        "{{job.items}}",
        "",
        "Subtotal: {{job.subtotal}}",
        "HST (13%): {{job.hst}}",
        "FINAL TOTAL: {{job.total}}",
        "",
        "I confirm the work described above has been completed to my satisfaction, the site was left clean, and I have reviewed care/maintenance notes with the technician. Workmanship is warranted for 12 months from today.",
        "",
        "Thank you for choosing {{company.name}}.",
        "{{company.phone}} · {{company.email}}",
      ].join("\n"),
    },
  ]);

  /* ---------- forms ---------- */
  const ev = (at: Date, event: string, ip: string | null, meta: string | null): AuditEvent => ({
    at: at.toISOString(), event, ip, meta,
  });
  await db.insert(s.forms).values([
    {
      token: "fx-sign-cd419e2b8801", templateKey: "completion-signoff",
      jobId: J["Storm door install"].id, clientId: C["Tom & Grace Whitaker"].id,
      status: "signed", channel: "sms", recipient: "(416) 555-0102",
      content: "(resolved at send time — see PDF)",
      signerName: "Grace Whitaker", signerEmail: "whitaker.tg@gmail.com",
      signerIp: "99.244.18.72", signatureUrl: null,
      sentById: jim.id,
      events: [
        ev(daysAgo(3, 17, 5), "sent", null, "Text message to (416) 555-0102"),
        ev(daysAgo(3, 18, 41), "viewed", "99.244.18.72", "iPhone · Safari"),
        ev(daysAgo(3, 18, 44), "signed", "99.244.18.72", "iPhone · Safari · Grace Whitaker"),
      ],
      sentAt: daysAgo(3, 17, 5), signedAt: daysAgo(3, 18, 44),
    },
    {
      token: "fx-sign-7b12aa90335f", templateKey: "change-order",
      jobId: J["Main floor refresh — walls & trim"].id, clientId: C["Eleanor Vance"].id,
      status: "sent", channel: "email", recipient: "eleanor.vance@gmail.com",
      content: "(resolved at send time — see PDF)",
      sentById: priya.id,
      events: [ev(daysAgo(1, 9, 12), "sent", null, "Email to eleanor.vance@gmail.com")],
      sentAt: daysAgo(1, 9, 12),
    },
    {
      token: "fx-sign-01e5cc77d902", templateKey: "work-authorization",
      jobId: J["Floating shelves — office nook"].id, clientId: C["Sofia Ricci"].id,
      status: "viewed", channel: "sms", recipient: "(416) 555-0173",
      content: "(resolved at send time — see PDF)",
      sentById: priya.id,
      events: [
        ev(daysAgo(2, 10, 2), "sent", null, "Text message to (416) 555-0173"),
        ev(daysAgo(2, 19, 3), "viewed", "70.28.114.60", "Android · Chrome"),
      ],
      sentAt: daysAgo(2, 10, 2),
    },
    {
      token: "fx-sign-ef9a04cb21d7", templateKey: "work-authorization",
      jobId: J["Bathroom vanity replacement"].id, clientId: C["Anita Desai"].id,
      status: "sent", channel: "email", recipient: "anita.desai@rogers.com",
      content: "(resolved at send time — see PDF)",
      sentById: priya.id,
      events: [ev(daysAgo(1, 15, 40), "sent", null, "Email to anita.desai@rogers.com")],
      sentAt: daysAgo(1, 15, 40),
    },
  ]);

  /* ---------- notes ---------- */
  const N = (clientName: string, userId: number, body: string, ago: number, jobTitle?: string) => ({
    clientId: C[clientName].id, jobId: jobTitle ? J[jobTitle].id : null,
    userId, body, createdAt: daysAgo(ago, 13),
  });
  await db.insert(s.notes).values([
    N("Eleanor Vance", priya.id, "Eleanor called — wants the sunroom quoted after the main floor refresh is done. Keep pricing consistent with last visit.", 1),
    N("Eleanor Vance", tanya.id, "Client very happy with day 1 progress. Asked about wall colour in hallway — matched to BM Classic Gray.", 0, "Main floor refresh — walls & trim"),
    N("The Beaconsfield — Nadia Osei", dan.id, "Nadia confirmed PO #BC-2026-114 covers the caulking job. Invoice goes to accounting@beaconsfieldpm.ca.", 2),
    N("The Beaconsfield — Nadia Osei", jim.id, "Building B gutter guards done. Two downspouts crushed at grade — flagged to Nadia, quoting separately.", 4, "Gutter guards — both buildings"),
    N("Anita Desai", priya.id, "Anita is nervous about the vanity plumbing. Promised photos of shut-offs before we close the wall.", 5),
    N("Anita Desai", marcus.id, "Vanity arrives at supplier Thursday. Confirmed 36\" as discussed.", 3, "Bathroom vanity replacement"),
    N("Harriet Cohen", tanya.id, "Patch blends well in daylight. Second paint coat Friday AM to cure before weekend.", 6, "Drywall patch & paint — hallway"),
    N("Keiko Tanaka", dan.id, "Studio North wants photos of the wainscoting for their portfolio — client approved.", 8),
    N("Bill & Doris Petrov", jim.id, "Doris asked us to check the shed door hinges while on the ladder. Added 20 min, no charge — goodwill.", 12),
    N("Marcus Bell", priya.id, "New client from Google Ads. Very responsive by text.", 10),
    N("Jordan Lee", priya.id, "Quoted full basement scope — likely going with a GC. Keep relationship warm, send gate quote anyway.", 4),
    N("Sofia Ricci", marcus.id, "Shower cartridge was seized — soaked with vinegar, freed up. Showed Sofia the old part.", 2, "Shower re-caulk & cartridge swap"),
  ]);

  /* ---------- photos ---------- */
  const P = (i: number, clientName: string, caption: string, ago: number, jobTitle?: string) => ({
    url: WORK_PHOTOS[i % WORK_PHOTOS.length], clientId: C[clientName].id,
    jobId: jobTitle ? J[jobTitle].id : null, caption, createdAt: daysAgo(ago, 12),
  });
  await db.insert(s.photos).values([
    P(8, "The Beaconsfield — Nadia Osei", "Gutter guards — Building B, after", 4, "Gutter guards — both buildings"),
    P(4, "Tom & Grace Whitaker", "Storm door hung, hardware on", 3, "Storm door install"),
    P(3, "Tom & Grace Whitaker", "Frame squared before set", 3, "Storm door install"),
    P(1, "The Beaconsfield — Nadia Osei", "North elevation — caulk failing", 14, "Exterior caulking — 12 windows"),
    P(10, "Sofia Ricci", "Shower enclosure — caulk stripped", 2, "Shower re-caulk & cartridge swap"),
    P(6, "Anita Desai", "Existing vanity — shut-offs corroded", 5, "Bathroom vanity replacement"),
    P(9, "Eleanor Vance", "Main floor — walls cut in, day 1", 1, "Main floor refresh — walls & trim"),
    P(11, "Keiko Tanaka", "Den wall — colour sample patch", 6, "Accent wall + trim paint, den"),
    P(0, "Harriet Cohen", "Hallway — section cut out square", 6, "Drywall patch & paint — hallway"),
    P(5, "Marcus Bell", "Stud bay opened for receptacle move", 10, "TV wall-mount + concealed wiring"),
    P(2, "Eleanor Vance", "Backsplash finished — zellige", 40, "Kitchen backsplash — zellige tile"),
    P(7, "Keiko Tanaka", "Wainscoting — cap rail detail", 48, "Wainscoting — dining room"),
  ]);

  /* ---------- activities ---------- */
  const ACT = (
    kind: string, message: string, ago: number,
    clientName?: string, jobTitle?: string, userId?: number
  ) => ({
    kind, message, createdAt: daysAgo(ago, 16),
    clientId: clientName ? C[clientName].id : null,
    jobId: jobTitle ? J[jobTitle].id : null,
    userId: userId ?? null,
  });
  await db.insert(s.activities).values([
    ACT("client", "Client added — imported from walk-in list", 0, "Sam O'Riley", undefined, priya.id),
    ACT("job", "Job created from estimate visit booking", 1, "Owen Gallagher", "Deck board replacement & re-stain", priya.id),
    ACT("form", "Work authorization sent by text to Sofia Ricci", 2, "Sofia Ricci", "Floating shelves — office nook", priya.id),
    ACT("stage", "Job moved from Quoted to Approved", 2, "Bill & Doris Petrov", "Eavestrough clean & re-slope", dan.id),
    ACT("stage", "Job moved from Approved to Scheduled", 3, "Anita Desai", "Handrail install — front steps", priya.id),
    ACT("form", "Completion sign-off signed by Grace Whitaker", 3, "Tom & Grace Whitaker", "Storm door install"),
    ACT("stage", "Job moved from Scheduled to Completed", 3, "Tom & Grace Whitaker", "Storm door install", jim.id),
    ACT("photo", "3 photos added to job", 3, "Tom & Grace Whitaker", "Storm door install", jim.id),
    ACT("note", "Priya added a note", 1, "Eleanor Vance", undefined, priya.id),
    ACT("stage", "Job moved from Scheduled to Completed", 4, "The Beaconsfield — Nadia Osei", "Gutter guards — both buildings", jim.id),
    ACT("quote", "Estimate updated — paint sundries adjusted", 5, "Keiko Tanaka", "Accent wall + trim paint, den", dan.id),
    ACT("stage", "Job moved from Lead to Quoted", 6, "Keiko Tanaka", "Accent wall + trim paint, den", priya.id),
    ACT("form", "Work authorization emailed to Anita Desai", 1, "Anita Desai", "Bathroom vanity replacement", priya.id),
    ACT("client", "Client added from Google lead", 3, "Owen Gallagher", undefined, priya.id),
    ACT("stage", "Job marked as Lost — Went with a general contractor", 4, "Jordan Lee", "Full basement finish — quote", dan.id),
    ACT("quote", "Estimate sent — $935.00 + HST", 9, "Anita Desai", "Bathroom vanity replacement", priya.id),
    ACT("invoice", "Invoice FW-1042 paid — e-transfer", 9, "Harriet Cohen", "Outlet & dimmer fixes (warranty)", priya.id),
    ACT("invoice", "Invoice FW-1046 paid — cheque", 12, "Keiko Tanaka", "Wainscoting — dining room", priya.id),
    ACT("invoice", "Invoice FW-1051 paid — e-transfer", 14, "Eleanor Vance", "Kitchen backsplash — zellige tile", priya.id),
    ACT("note", "Dan added a note re: PO for caulking", 2, "The Beaconsfield — Nadia Osei", undefined, dan.id),
  ]);

  /* ---------- api keys & webhooks ---------- */
  await db.insert(s.apiKeys).values({
    name: "QuickBooks sync (demo)",
    prefix: DEMO_API_KEY.slice(0, 16),
    keyHash: sha256(DEMO_API_KEY),
    createdById: dan.id,
    lastUsedAt: daysAgo(0, 8),
  });
  const [hook] = await db
    .insert(s.webhookEndpoints)
    .values({
      url: "https://webhook.site/fixwell-demo",
      events: ["client.created", "job.stage_changed", "form.signed"],
      secret: "whsec_demo74f2b9c1",
      active: true,
    })
    .returning();
  await db.insert(s.webhookDeliveries).values([
    {
      endpointId: hook.id, event: "form.signed", status: "delivered", responseCode: 200,
      payload: { id: "evt_p9w31d", event: "form.signed", data: { jobId: 8, signer: "Grace Whitaker" } },
      createdAt: daysAgo(3, 18, 45),
    },
    {
      endpointId: hook.id, event: "job.stage_changed", status: "failed", responseCode: null,
      payload: { id: "evt_lm093q", event: "job.stage_changed", data: { jobId: 7, from: "scheduled", to: "completed" } },
      createdAt: daysAgo(4, 15, 5),
    },
  ]);

  console.log(`Seeded ${COMPANY.name}: ${team.length} users, ${clientRows.length} clients, ${jobRows.length} jobs.`);
}

function defaultDescription(title: string): string {
  const d: Record<string, string> = {
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
  return d[title] ?? "Scope as discussed on site visit.";
}

function mating(): string {
  return "Prefers written quotes over email before any phone call. Daughter handles payments.";
}

if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error(e);
      await pool.end();
      process.exit(1);
    });
}
