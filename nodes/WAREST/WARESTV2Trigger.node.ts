import { createHmac, timingSafeEqual } from "node:crypto";

import type { Response } from "express";
import type {
  IDataObject,
  INode,
  INodeExecutionData,
  INodeProperties,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";

type WebhookResponseMode = "ack" | "empty" | "static";

const eventOptions = [
  "session_status",
  "message_received",
  "message_reaction",
  "message_command",
  "message_edited",
  "message_revoked",
  "group_participants",
  "group_join",
  "group_leave",
  "group_update",
  "presence_update",
  "creds_update",
  "call",
] as const;

type WarestEvent = (typeof eventOptions)[number];

interface AdditionalWebhookOptions {
  includeHeaders?: boolean;
  includeRawBody?: boolean;
  responseMode?: "ack" | "empty" | "static";
  responseJson?: IDataObject;
  responseActions?: IDataObject | IDataObject[];
  responseDelayMs?: number;
  disableSignatureCheck?: boolean;
  debugSignature?: boolean;
  verifyTimestamp?: boolean;
  timestampToleranceSeconds?: number;
}

export class WARESTV2Trigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "WAREST Webhook (V2)",
    name: "warestV2WebhookTrigger",
    group: ["trigger"],
    version: 1,
    description:
      "Receive webhook events from WARest with signature verification (multi-output)",
    defaults: {
      name: "WAREST Webhook (V2)",
    },
    codex: {
      categories: ["Trigger"],
      subcategories: {
        Trigger: ["Communication", "Messaging"],
      },
      alias: ["WAREST", "WAREST Webhook", "WhatsApp Webhook"],
    },
    activationMessage: "Listening for WARest webhook calls",
    icon: "file:../icons/warest.png",
    inputs: [],
    outputs: eventOptions.map(() => "main"),
    outputNames: [...eventOptions],
    webhooks: [
      {
        name: "default",
        httpMethod: "POST",
        responseMode: "onReceived",
        path: '={{$parameter["path"]}}',
      },
    ],
    properties: [
      {
        displayName: "Webhook Path",
        name: "path",
        type: "string",
        default: "warestWebhook",
        description:
          "Relative path that WARest will call, e.g. /webhook/warest",
      },
      {
        displayName: "Shared Secrets",
        name: "webhookSecrets",
        type: "string",
        required: true,
        typeOptions: {
          password: true,
          rows: 4,
        },
        default: "",
        description:
          "Comma or newline separated secrets configured on WARest sessions. Multiple secrets let you rotate keys seamlessly.",
      },
      {
        displayName: "Additional Fields",
        name: "additionalFields",
        type: "collection",
        default: {},
        placeholder: "Add Field",
        options: [
          {
            displayName: "Include HTTP Headers",
            name: "includeHeaders",
            type: "boolean",
            default: true,
          },
          {
            displayName: "Include Raw Body",
            name: "includeRawBody",
            type: "boolean",
            default: false,
            description:
              "Adds the unparsed JSON string to the output for custom signature checks/logging.",
          },
          {
            displayName: "Response Mode",
            name: "responseMode",
            type: "options",
            default: "ack",
            options: [
              {
                name: 'ACK ({"ok":true})',
                value: "ack",
              },
              {
                name: "Empty 200",
                value: "empty",
              },
              {
                name: "Static JSON",
                value: "static",
              },
            ],
          },
          {
            displayName: "Static Response JSON",
            name: "responseJson",
            type: "json",
            default: "",
            typeOptions: {
              rows: 4,
            },
            displayOptions: {
              show: {
                responseMode: ["static"],
              },
            },
            description:
              'Payload returned to WARest when using the Static JSON response mode. Leave empty to default to {"ok": true}.',
          },
          {
            displayName: "Response Actions",
            name: "responseActions",
            type: "json",
            default: "",
            typeOptions: {
              rows: 4,
            },
            description:
              "Optional actions array to return alongside the acknowledgement. Use the same structure demonstrated in the Express example.",
          },
          {
            displayName: "Response Delay (ms)",
            name: "responseDelayMs",
            type: "number",
            default: 0,
            description:
              "Optional delayMs included in the response to slow down WARest follow-up actions.",
          },
          {
            displayName: "Disable Signature Verification",
            name: "disableSignatureCheck",
            type: "boolean",
            default: false,
            description:
              "Enable only for debugging. Production webhooks should always verify signatures.",
          },
          {
            displayName: "Debug Signature Logging",
            name: "debugSignature",
            type: "boolean",
            default: false,
            description:
              "Log expected vs received signatures whenever verification fails. Mirrors the DEBUG_SIGNATURE flag from the Express example.",
          },
          {
            displayName: "Verify Timestamp Freshness",
            name: "verifyTimestamp",
            type: "boolean",
            default: false,
            description:
              "Reject requests when X-WAREST-Timestamp drifts beyond the tolerance.",
          },
          {
            displayName: "Timestamp Tolerance (seconds)",
            name: "timestampToleranceSeconds",
            type: "number",
            default: 300,
            displayOptions: {
              show: {
                verifyTimestamp: [true],
              },
            },
            description:
              "Maximum difference allowed between X-WAREST-Timestamp and the current time.",
          },
        ] as INodeProperties[],
      },
    ],
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const req = this.getRequestObject();
    const res = this.getResponseObject();
    const body = (this.getBodyData() ?? {}) as IDataObject;
    const rawBody = getRawBody(req, body);

    const additionalFields =
      (this.getNodeParameter(
        "additionalFields",
        {}
      ) as AdditionalWebhookOptions) ?? {};

    const headerMeta = extractHeaderMeta(req.headers as IDataObject);
    const dataPayload = (body.data ?? {}) as IDataObject;
    const eventName = String(
      headerMeta.event ?? body.event ?? dataPayload?.event ?? ""
    ).trim();

    if (eventName === "preflight") {
      sendResponse(res, {
        mode: "ack",
        staticPayload: { ok: true, pong: true },
        eventName,
      });
      return {
        noWebhookResponse: true,
        workflowData: [],
      };
    }

    const secrets = parseSecrets(
      this.getNodeParameter("webhookSecrets", "") as string
    );

    const disableSignature = additionalFields.disableSignatureCheck === true;
    if (!disableSignature && secrets.length === 0) {
      throw new NodeOperationError(
        this.getNode(),
        "Configure at least one webhook secret or enable signature override for debugging."
      );
    }

    const debugSignature = additionalFields.debugSignature === true;
    const signatureValid = disableSignature
      ? true
      : verifySignature(
          req.headers as IDataObject,
          rawBody,
          secrets,
          body,
          debugSignature
        );

    if (!signatureValid) {
      res.status(401).json({ ok: false, message: "Invalid signature" });
      return {
        noWebhookResponse: true,
        workflowData: [],
      };
    }

    const shouldVerifyTimestamp = additionalFields.verifyTimestamp === true;
    if (
      shouldVerifyTimestamp &&
      !isTimestampFresh(
        req.headers as IDataObject,
        Number(additionalFields.timestampToleranceSeconds ?? 300)
      )
    ) {
      res.status(401).json({ ok: false, message: "Stale timestamp" });
      return {
        noWebhookResponse: true,
        workflowData: [],
      };
    }

    const includeHeaders =
      additionalFields.includeHeaders !== undefined
        ? additionalFields.includeHeaders
        : true;
    const includeRawBody = additionalFields.includeRawBody === true;

    const responseMode =
      (additionalFields.responseMode as WebhookResponseMode) ?? "ack";
    const staticPayload =
      (parseOptionalJson(
        additionalFields.responseJson,
        "Static Response JSON",
        this.getNode()
      ) as IDataObject) ?? ({ ok: true } as IDataObject);
    const responseActions = normalizeActionPayload(
      parseOptionalJson(
        additionalFields.responseActions,
        "Response Actions",
        this.getNode()
      )
    );
    const responseDelayMs = Number(additionalFields.responseDelayMs ?? 0);

    const bodySession = (body.session ?? {}) as IDataObject;
    const sessionIdFromBody =
      typeof bodySession.id === "string" ? (bodySession.id as string) : null;
    const timestamp =
      headerMeta.timestamp ??
      (typeof body.ts === "number" ? body.ts : undefined) ??
      null;

    const metadata: IDataObject = {
      event: eventName || null,
      sessionId: headerMeta.sessionId ?? sessionIdFromBody ?? null,
      registry: headerMeta.registry ?? null,
      username: headerMeta.username ?? null,
      timestamp,
      eventId: headerMeta.eventId ?? null,
      version: headerMeta.version ?? null,
    };

    const item: IDataObject = {
      event: eventName || body.event || null,
      ts: timestamp,
      session: bodySession,
      data: body.data ?? body,
      metadata,
      payload: body,
      signatureValid,
    };

    if (includeHeaders) {
      item.headers = req.headers;
    }
    if (includeRawBody) {
      item.rawBody =
        typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    }

    sendResponse(res, {
      mode: responseMode,
      staticPayload,
      eventName,
      actions: responseActions,
      delayMs: responseDelayMs,
    });

    const workflowData: INodeExecutionData[][] = eventOptions.map(() => []);

    const eventIndex = eventOptions.indexOf(
      (eventName as WarestEvent) || "message_received"
    );
    const targetIndex = eventIndex >= 0 ? eventIndex : 0;

    workflowData[targetIndex].push({ json: item });

    return {
      noWebhookResponse: true,
      workflowData,
    };
  }
}

function parseSecrets(input: string): string[] {
  return input
    .split(/[\r\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function verifySignature(
  headers: IDataObject,
  rawBody: Buffer,
  secrets: string[],
  parsedBody?: IDataObject,
  debugSignature?: boolean
): boolean {
  try {
    const signatureHeader = String(headers["x-warest-signature"] ?? "");
    const [token, signatureHexRaw] = signatureHeader.split("=");
    const normalizedToken = (token ?? "").trim().toUpperCase();
    const signatureHex = (signatureHexRaw ?? "").trim();
    if (!normalizedToken || !signatureHex) {
      return false;
    }

    const algorithm = resolveAlgorithm(
      String(headers["x-warest-signature-alg"] ?? normalizedToken)
    );
    const username = String(headers["x-warest-username"] ?? "");
    const payloads: Buffer[] = [];
    const pushPayload = (buffer: Buffer) => {
      if (!payloads.some((existing) => existing.equals(buffer))) {
        payloads.push(buffer);
      }
    };
    pushPayload(rawBody);
    if (parsedBody) {
      pushPayload(Buffer.from(JSON.stringify(parsedBody ?? {})));
    }

    for (const secret of secrets) {
      const key = `${secret}${username}`;
      for (const payload of payloads) {
        const computed = createHmac(algorithm, key)
          .update(payload)
          .digest("hex");
        if (safeCompareStrings(computed, signatureHex)) {
          return true;
        }
        if (debugSignature) {
          console.warn(
            "[WAREST webhook] signature mismatch for secret rotation entry"
          );
          console.warn("Expected:", computed);
          console.warn("Received:", signatureHex);
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

function isTimestampFresh(headers: IDataObject, toleranceSeconds: number) {
  const headerValue = Number(headers["x-warest-timestamp"] ?? 0);
  if (!Number.isFinite(headerValue) || headerValue <= 0) {
    return false;
  }
  const toleranceMs = Math.max(toleranceSeconds, 0) * 1000;
  const now = Date.now();
  return Math.abs(now - headerValue) <= toleranceMs;
}

function getRawBody(req: unknown, body: IDataObject): Buffer {
  const raw = (req as { rawBody?: Buffer | string } | undefined)?.rawBody;
  if (Buffer.isBuffer(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    return Buffer.from(raw, "utf8");
  }
  return Buffer.from(JSON.stringify(body ?? {}));
}

function sendResponse(
  res: Response,
  options: {
    mode: WebhookResponseMode;
    staticPayload?: IDataObject;
    eventName?: string;
    actions?: IDataObject[];
    delayMs?: number;
  }
) {
  if (options.mode === "empty") {
    res.status(200).end();
    return;
  }
  const payload: IDataObject =
    options.mode === "static" && options.staticPayload
      ? { ...(options.staticPayload as IDataObject) }
      : { ok: true };
  if (options.eventName === "preflight" && options.mode !== "static") {
    payload.pong = true;
  }
  if (options.actions && options.actions.length > 0) {
    payload.actions = options.actions;
  }
  if (
    typeof options.delayMs === "number" &&
    Number.isFinite(options.delayMs) &&
    options.delayMs > 0
  ) {
    payload.delayMs = options.delayMs;
  }
  res.json(payload);
}

function resolveAlgorithm(header: string): string {
  try {
    const match = header.toUpperCase().match(/^HMAC-SHA(224|256|384|512)$/);
    const bits = match ? match[1] : "256";
    switch (bits) {
      case "224":
        return "sha224";
      case "384":
        return "sha384";
      case "512":
        return "sha512";
      default:
        return "sha256";
    }
  } catch {
    return "sha256";
  }
}

function safeCompareStrings(expected: string, provided: string): boolean {
  try {
    const a = Buffer.from(String(expected || ""), "utf8");
    const b = Buffer.from(String(provided || ""), "utf8");
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function extractHeaderMeta(headers: IDataObject) {
  const readHeader = (key: string) => {
    const normalizedKey = key.toLowerCase();
    const value = headers[normalizedKey];
    if (value === undefined || value === null) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return String(value[0] ?? "").trim();
    }
    return String(value).trim();
  };
  const tsRaw = readHeader("x-warest-timestamp");
  const timestamp = Number(tsRaw);
  return {
    event: readHeader("x-warest-event") ?? null,
    sessionId: readHeader("x-warest-session") ?? null,
    registry: readHeader("x-warest-registry") ?? null,
    username: readHeader("x-warest-username") ?? null,
    timestamp: Number.isFinite(timestamp) ? timestamp : null,
    eventId: readHeader("x-warest-event-id") ?? null,
    version: readHeader("x-warest-version") ?? null,
  };
}

function normalizeActionPayload(
  value: IDataObject | IDataObject[] | undefined
): IDataObject[] | undefined {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is IDataObject => !!entry && typeof entry === "object"
    );
  }
  if (typeof value === "object") {
    return [value];
  }
  return undefined;
}

function parseOptionalJson(
  value: unknown,
  label: string,
  node: INode
): IDataObject | IDataObject[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new NodeOperationError(node, `${label} must be valid JSON`);
    }
  }
  if (typeof value === "object") {
    return value as IDataObject | IDataObject[];
  }
  return undefined;
}
