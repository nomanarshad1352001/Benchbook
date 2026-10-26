import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

/* =========================================================================
   Benchbook is zero-database at runtime: the interface persists in
   localStorage (src/lib/store.ts) and the public REST API uses the
   serverless sandbox (src/app/api/v1/[...v1path]/route.ts).

   This file intentionally keeps the FULL table definitions so that (a) any
   older checkout of the repo that still references these tables compiles
   cleanly, and (b) it doubles as the canonical relational data model if you
   later point the app at a real Postgres. Nothing in the active UI imports
   from here.
   ========================================================================= */

export type Address = {
  label: string;
  line1: string;
  city: string;
  province: string;
  postal: string;
  primary?: boolean;
};

export type LineItem = {
  id: number;
  description: string;
  kind: "labour" | "material";
  qty: number;
  unit: string;
  rate: number;
};

export type AuditEvent = {
  at: string;
  event: string;
  ip?: string | null;
  meta?: string | null;
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("field"), // admin | office | field
  phone: text("phone"),
  color: text("color").notNull().default("#f59e0b"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  leadSource: text("lead_source").notNull().default("Referral"),
  tags: jsonb("tags").$type<string[]>().notNull(),
  addresses: jsonb("addresses").$type<Address[]>().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  title: text("title").notNull(),
  serviceType: text("service_type").notNull().default("General Repairs"),
  stage: text("stage").notNull().default("lead"),
  address: text("address"),
  description: text("description"),
  lineItems: jsonb("line_items").$type<LineItem[]>().notNull(),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
  lostReason: text("lost_reason"),
  assigneeId: integer("assignee_id").references(() => users.id),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id),
  clientId: integer("client_id").notNull().references(() => clients.id),
  title: text("title").notNull(),
  type: text("type").notNull().default("job"), // estimate | job | callback
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  assigneeId: integer("assignee_id").references(() => users.id),
  notes: text("notes"),
  status: text("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const formTemplates = pgTable("form_templates", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  body: text("body").notNull(),
  nextStage: text("next_stage"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const forms = pgTable("forms", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  templateKey: text("template_key").notNull(),
  jobId: integer("job_id").notNull().references(() => jobs.id),
  clientId: integer("client_id").notNull().references(() => clients.id),
  status: text("status").notNull().default("sent"),
  channel: text("channel").notNull().default("email"),
  recipient: text("recipient"),
  content: text("content").notNull(),
  clientNote: text("client_note"),
  signerName: text("signer_name"),
  signerEmail: text("signer_email"),
  signerIp: text("signer_ip"),
  signatureUrl: text("signature_url"),
  sentById: integer("sent_by_id").references(() => users.id),
  events: jsonb("events").$type<AuditEvent[]>().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  jobId: integer("job_id").references(() => jobs.id),
  userId: integer("user_id").references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  jobId: integer("job_id").references(() => jobs.id),
  url: text("url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  jobId: integer("job_id").references(() => jobs.id),
  userId: integer("user_id").references(() => users.id),
  kind: text("kind").notNull().default("event"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  events: jsonb("events").$type<string[]>().notNull(),
  secret: text("secret").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  endpointId: integer("endpoint_id").notNull().references(() => webhookEndpoints.id),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  responseCode: integer("response_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
