export const dynamic = "force-dynamic";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Fixwell Handyman — CRM API",
    version: "1.0.0",
    description:
      "REST API for the Fixwell CRM: clients, jobs, appointments and e-signature forms. Authenticate every request with an API key (`x-api-key` header or Bearer token). Keys are issued in Settings → API keys.",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ ApiKeyAuth: [] }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
    },
    schemas: {
      Address: {
        type: "object",
        properties: {
          label: { type: "string" },
          line1: { type: "string" },
          city: { type: "string" },
          province: { type: "string" },
          postal: { type: "string" },
          primary: { type: "boolean" },
        },
      },
      Client: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          email: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
          leadSource: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          addresses: { type: "array", items: { $ref: "#/components/schemas/Address" } },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      LineItem: {
        type: "object",
        properties: {
          id: { type: "integer" },
          description: { type: "string" },
          kind: { type: "string", enum: ["labour", "material"] },
          qty: { type: "number" },
          unit: { type: "string" },
          rate: { type: "number" },
        },
      },
      Job: {
        type: "object",
        properties: {
          id: { type: "integer" },
          clientId: { type: "integer" },
          title: { type: "string" },
          serviceType: { type: "string" },
          stage: {
            type: "string",
            enum: ["lead", "quoted", "approved", "scheduled", "completed", "paid", "lost"],
          },
          address: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          lineItems: { type: "array", items: { $ref: "#/components/schemas/LineItem" } },
          totals: {
            type: "object",
            properties: {
              subtotal: { type: "number" },
              hst: { type: "number" },
              total: { type: "number" },
              currency: { type: "string", example: "CAD" },
              taxRate: { type: "number", example: 0.13 },
            },
          },
          scheduledStart: { type: "string", format: "date-time", nullable: true },
          scheduledEnd: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Appointment: {
        type: "object",
        properties: {
          id: { type: "integer" },
          clientId: { type: "integer" },
          jobId: { type: "integer", nullable: true },
          title: { type: "string" },
          type: { type: "string", enum: ["estimate", "job", "callback"] },
          startsAt: { type: "string", format: "date-time" },
          endsAt: { type: "string", format: "date-time" },
          assigneeId: { type: "integer", nullable: true },
          notes: { type: "string", nullable: true },
          status: { type: "string", enum: ["scheduled", "done", "cancelled"] },
        },
      },
      Form: {
        type: "object",
        properties: {
          id: { type: "integer" },
          templateKey: { type: "string", enum: ["work-authorization", "change-order", "completion-signoff"] },
          jobId: { type: "integer" },
          clientId: { type: "integer" },
          status: { type: "string", enum: ["sent", "viewed", "signed"] },
          channel: { type: "string", enum: ["email", "sms"] },
          signingUrl: { type: "string" },
          signerName: { type: "string", nullable: true },
          signerIp: { type: "string", nullable: true },
          audit: { type: "array", items: { type: "object" } },
          sentAt: { type: "string", format: "date-time" },
          signedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
    },
  },
  paths: {
    "/clients": {
      get: {
        summary: "List clients",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { "200": { description: "Paginated list of clients." } },
      },
      post: {
        summary: "Create a client",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Client" },
              example: { name: "Dana Whitfield", email: "dana.w@gmail.com", phone: "(416) 555-0172", leadSource: "Referral" },
            },
          },
        },
        responses: { "201": { description: "Client created." } },
      },
    },
    "/clients/{id}": {
      get: {
        summary: "Get a client (includes their jobs)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Client with jobs." }, "404": { description: "Not found." } },
      },
      patch: {
        summary: "Update a client",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Updated client." } },
      },
      delete: {
        summary: "Delete a client (only if they have no jobs)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "204": { description: "Deleted." }, "409": { description: "Client has jobs." } },
      },
    },
    "/jobs": {
      get: {
        summary: "List jobs",
        parameters: [
          { name: "stage", in: "query", schema: { type: "string" }, description: "Filter by pipeline stage" },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: { "200": { description: "Jobs with computed CAD totals." } },
      },
      post: {
        summary: "Create a job (starts as a lead)",
        responses: { "201": { description: "Job created." } },
      },
    },
    "/jobs/{id}": {
      get: { summary: "Get a job", parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Job." } } },
      patch: {
        summary: "Update a job — move stages, edit the estimate",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          content: {
            "application/json": {
              example: { stage: "quoted" },
            },
          },
        },
        responses: { "200": { description: "Updated job." } },
      },
    },
    "/appointments": {
      get: {
        summary: "List appointments",
        parameters: [{ name: "assigneeId", in: "query", schema: { type: "integer" } }],
        responses: { "200": { description: "Appointments." } },
      },
      post: { summary: "Book an appointment", responses: { "201": { description: "Appointment created." } } },
    },
    "/forms": {
      get: {
        summary: "List forms",
        parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["sent", "viewed", "signed"] } }],
        responses: { "200": { description: "Forms with audit trails." } },
      },
      post: {
        summary: "Send a form for e-signature",
        requestBody: {
          content: {
            "application/json": {
              example: { jobId: 14, templateKey: "work-authorization", channel: "email" },
            },
          },
        },
        responses: { "201": { description: "Form sent; signingUrl returned." } },
      },
    },
  },
  "x-webhooks": {
    description:
      "HTTPS POST with JSON body { id, event, createdAt, data } and headers X-Webhook-Event / X-Webhook-Secret. Manage endpoints in Settings → Webhooks.",
    events: ["client.created", "job.created", "job.stage_changed", "form.sent", "form.signed", "appointment.created"],
  },
};

export async function GET() {
  return Response.json(spec);
}
