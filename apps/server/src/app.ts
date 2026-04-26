import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import { DomainEventBus } from "@paperai/core";
import { getAdapterRegistry } from "./lib/adapters.js";
import { getConfig } from "./config.js";
import { routes } from "./routes/index.js";
import { PlatformService } from "./services/platform-service.js";
import { RuntimeOrchestrator } from "./services/runtime.js";

function findWebDistDir(env: NodeJS.ProcessEnv = process.env) {
  const webDistDir = env.PAPERAI_WEB_DIST_DIR?.trim();
  const repoRoot = env.PAPERAI_REPO_ROOT?.trim();
  const candidates = [
    webDistDir ? resolve(webDistDir) : null,
    repoRoot ? resolve(repoRoot, "apps/web/dist") : null,
    resolve(process.cwd(), "apps/web/dist"),
    resolve(process.cwd(), "../web/dist"),
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function parseBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, value] = header.split(" ", 2);
  if (scheme?.toLowerCase() !== "bearer" || !value) {
    return null;
  }
  return value.trim() || null;
}

function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isZodError(error: unknown): error is { issues: Array<{ path?: unknown; message?: unknown }> } {
  return isRecord(error) && error.name === "ZodError" && Array.isArray(error.issues);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : "request_failed";
}

function getHttpStatusCode(error: unknown): number | null {
  const statusCode = isRecord(error) ? error.statusCode : undefined;
  return typeof statusCode === "number" && statusCode >= 400 && statusCode < 600 ? statusCode : null;
}

function normalizeDomainErrorCode(message: string): string | null {
  const code = message.split(":", 1)[0] ?? "";
  return /^[a-z][a-z0-9_]*$/.test(code) ? code : null;
}

function getDomainErrorStatus(code: string): number | null {
  if (code === "unauthorized" || code === "invalid_credentials") {
    return 401;
  }
  if (code === "forbidden") {
    return 403;
  }
  if (code === "not_found" || code.endsWith("_not_found")) {
    return 404;
  }
  if (code.includes("already") || code.endsWith("_conflict")) {
    return 409;
  }
  if (code.startsWith("invalid_") || code.endsWith("_required")) {
    return 400;
  }
  return null;
}

function mapErrorResponse(error: unknown) {
  if (isZodError(error)) {
    return {
      statusCode: 400,
      body: {
        error: "validation_failed",
        message: "validation_failed",
        issues: error.issues.map((issue) => ({
          path: Array.isArray(issue.path) ? issue.path.join(".") : "",
          message: typeof issue.message === "string" ? issue.message : "Invalid input",
        })),
      },
    };
  }

  const message = getErrorMessage(error);
  const domainCode = normalizeDomainErrorCode(message);
  const domainStatus = domainCode ? getDomainErrorStatus(domainCode) : null;
  if (domainCode && domainStatus) {
    return {
      statusCode: domainStatus,
      body: {
        error: domainCode,
        message: domainCode,
      },
    };
  }

  const httpStatusCode = getHttpStatusCode(error);
  if (httpStatusCode && httpStatusCode < 500) {
    return {
      statusCode: httpStatusCode,
      body: {
        error: "request_failed",
        message,
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: "internal_error",
      message: "internal_error",
    },
  };
}

export interface CreateAppOptions {
  config?: ReturnType<typeof getConfig>;
  eventBus?: DomainEventBus;
  platformService?: PlatformService;
  runtime?: RuntimeOrchestrator;
}

export async function createApp(options: CreateAppOptions = {}) {
  const config = options.config ?? getConfig();
  const app = Fastify({ logger: true });
  const eventBus = options.eventBus ?? new DomainEventBus();
  const platformService = options.platformService ?? PlatformService.create(config.databaseUrl, eventBus);
  const runtime = options.runtime ?? new RuntimeOrchestrator(platformService, eventBus, getAdapterRegistry());

  await app.register(cors, {
    origin: config.webOrigin,
    credentials: true,
  });
  await app.register(jwt, {
    secret: config.jwtSecret,
  });

  app.setErrorHandler((error, request, reply) => {
    const response = mapErrorResponse(error);
    if (response.statusCode >= 500) {
      request.log.error({ err: error }, "request_failed");
    }
    reply.code(response.statusCode).send(response.body);
  });

  app.decorate("platformService", platformService);
  app.decorate("eventBus", eventBus);
  app.decorate("runtime", runtime);
  app.decorate("paperaiConfig", config);
  app.decorate("authenticate", async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const headerToken = parseBearerToken(request.headers.authorization);
    const boardApiKey = request.headers["x-paperai-api-key"];

    try {
      const queryToken = (request.query as { token?: string } | undefined)?.token;
      const rawBoardApiKey = typeof boardApiKey === "string" ? boardApiKey : headerToken && !looksLikeJwt(headerToken) ? headerToken : null;

      if (rawBoardApiKey) {
        const user = await app.platformService.authenticateBoardApiKey(rawBoardApiKey);
        if (!user) {
          throw new Error("unauthorized");
        }
        request.user = {
          sub: user.id,
          email: user.email,
          type: "user",
        };
      } else if (queryToken && !request.headers.authorization) {
        request.user = app.jwt.verify(queryToken);
      } else {
        await request.jwtVerify();
      }
    } catch {
      reply.code(401).send({ error: "unauthorized" });
    }
  });
  app.decorate("authenticateAgent", async function authenticateAgent(request: FastifyRequest, reply: FastifyReply) {
    const headerToken = parseBearerToken(request.headers.authorization);
    const rawAgentKey =
      typeof request.headers["x-paperai-agent-key"] === "string"
        ? request.headers["x-paperai-agent-key"]
        : headerToken && !looksLikeJwt(headerToken)
          ? headerToken
          : null;

    try {
      if (rawAgentKey) {
        const agent = await app.platformService.authenticateAgentApiKey(rawAgentKey);
        if (!agent) {
          throw new Error("unauthorized");
        }
        request.agent = agent;
        request.user = {
          sub: agent.id,
          type: "agent",
          agentId: agent.id,
        };
        return;
      }

      await request.jwtVerify();
      if (request.user.type !== "agent" || !request.user.agentId) {
        throw new Error("unauthorized");
      }

      const agent = await app.platformService.getAgent(request.user.agentId);
      if (!agent) {
        throw new Error("unauthorized");
      }
      request.agent = agent;
    } catch {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  await app.register(routes);

  const webDistDir = findWebDistDir();
  if (webDistDir) {
    await app.register(fastifyStatic, {
      root: webDistDir,
      prefix: "/",
      index: "index.html",
    });

    app.setNotFoundHandler(async (request, reply) => {
      const acceptsHtml = request.headers.accept?.includes("text/html") ?? false;
      const isSpaRoute =
        request.method === "GET" &&
        !request.url.startsWith("/api/") &&
        request.url !== "/health" &&
        !request.url.includes(".");

      if ((acceptsHtml || request.url === "/") && isSpaRoute) {
        return reply.sendFile("index.html");
      }

      return reply.code(404).send({ error: "not_found" });
    });
  }

  runtime.start();
  app.addHook("onClose", async () => {
    runtime.stop();
  });

  return app;
}
