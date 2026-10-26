export const COMPANY = {
  name: "Fixwell Handyman Co.",
  product: "Benchbook",
  city: "Toronto, ON",
  phone: "(416) 555-0107",
  email: "office@fixwell.ca",
  hstNumber: "70412 8852 RT0001",
};

export const TAX_RATE = 0.13; // Ontario HST

export type StageKey =
  | "lead"
  | "quoted"
  | "approved"
  | "scheduled"
  | "completed"
  | "paid"
  | "lost";

export const STAGES: {
  key: StageKey;
  label: string;
  color: string;
  soft: string;
  text: string;
}[] = [
  { key: "lead", label: "Lead", color: "#64748b", soft: "bg-slate-100", text: "text-slate-600" },
  { key: "quoted", label: "Quoted", color: "#8b5cf6", soft: "bg-violet-100", text: "text-violet-700" },
  { key: "approved", label: "Approved", color: "#3b82f6", soft: "bg-blue-100", text: "text-blue-700" },
  { key: "scheduled", label: "Scheduled", color: "#f59e0b", soft: "bg-amber-100", text: "text-amber-700" },
  { key: "completed", label: "Completed", color: "#22c55e", soft: "bg-green-100", text: "text-green-700" },
  { key: "paid", label: "Paid", color: "#059669", soft: "bg-emerald-100", text: "text-emerald-700" },
  { key: "lost", label: "Lost", color: "#ef4444", soft: "bg-red-100", text: "text-red-600" },
];

export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<
  StageKey,
  (typeof STAGES)[number]
>;

export function stageLabel(key: string): string {
  return STAGE_MAP[key as StageKey]?.label ?? key;
}

export const SERVICE_TYPES = [
  "General Repairs",
  "Carpentry",
  "Plumbing",
  "Electrical",
  "Painting",
  "Drywall & Patching",
  "Flooring",
  "Decks & Fences",
  "Doors & Windows",
  "Assembly & Mounting",
  "Gutter & Exterior",
];

export const LEAD_SOURCES = [
  "Referral",
  "Google",
  "HomeStars",
  "Facebook",
  "Kijiji",
  "Repeat client",
  "Walk-in",
];

export const APPOINTMENT_TYPES: Record<string, { label: string; icon: string }> = {
  estimate: { label: "Estimate visit", icon: "Ruler" },
  job: { label: "Job", icon: "Wrench" },
  callback: { label: "Callback", icon: "PhoneCall" },
};

export const FORM_PHASES: Record<string, { label: string; nextStage: string | null }> = {
  "work-authorization": { label: "Estimate approval / Work authorization", nextStage: "approved" },
  "change-order": { label: "Change order", nextStage: null },
  "completion-signoff": { label: "Job completion sign-off", nextStage: "completed" },
};

/* Curated Pexels imagery used across the app (photos.pexels.com CDN). */
export const WORK_PHOTOS = [
  "https://images.pexels.com/photos/5768107/pexels-photo-5768107.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/38407198/pexels-photo-38407198.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/5767926/pexels-photo-5767926.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/7218567/pexels-photo-7218567.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/7285924/pexels-photo-7285924.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/5768284/pexels-photo-5768284.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/4981802/pexels-photo-4981802.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/29871587/pexels-photo-29871587.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/5493654/pexels-photo-5493654.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/15124970/pexels-photo-15124970.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/5691686/pexels-photo-5691686.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  "https://images.pexels.com/photos/6474491/pexels-photo-6474491.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
];

export const AVATARS = {
  dan: "https://images.pexels.com/photos/32845660/pexels-photo-32845660.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=200&w=200",
  priya: "https://images.pexels.com/photos/8487397/pexels-photo-8487397.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=200&w=200",
  marcus: "https://images.pexels.com/photos/10682438/pexels-photo-10682438.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=200&w=200",
  tanya: "https://images.pexels.com/photos/37556463/pexels-photo-37556463.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=200&w=200",
  jim: "https://images.pexels.com/photos/4981783/pexels-photo-4981783.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=200&w=200",
};

export const LOGIN_HERO =
  "https://images.pexels.com/photos/17063686/pexels-photo-17063686.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1200&w=1600";

export const DEMO_ACCOUNTS = [
  {
    role: "admin" as const,
    label: "Admin",
    name: "Dan Whitfield",
    title: "Owner",
    email: "dan@fixwell.ca",
    password: "demo1234",
    blurb: "Full access — settings, API keys, team, everything.",
  },
  {
    role: "office" as const,
    label: "Office",
    name: "Priya Sharma",
    title: "Office manager",
    email: "priya@fixwell.ca",
    password: "demo1234",
    blurb: "Runs the board — clients, quotes, forms, scheduling.",
  },
  {
    role: "field" as const,
    label: "Field crew",
    name: "Marcus Cole",
    title: "Lead technician",
    email: "marcus@fixwell.ca",
    password: "demo1234",
    blurb: "Mobile-first view — schedule, jobs, on-site signing.",
  },
];

export const WEBHOOK_EVENTS = [
  { key: "client.created", label: "New client" },
  { key: "job.created", label: "Job created" },
  { key: "job.stage_changed", label: "Job stage change" },
  { key: "form.sent", label: "Form sent" },
  { key: "form.signed", label: "Form signed" },
  { key: "appointment.created", label: "Appointment created" },
];
