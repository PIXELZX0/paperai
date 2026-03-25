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

function findWebDistDir() {
  const candidates = [resolve(process.cwd(), "apps/web/dist"), resolve(process.cwd(), "../web/dist")];
  return candidates.find((candidate) => existsSync(candidate));
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
      index: false,
    });

    app.setNotFoundHandler(async (request, reply) => {
      const acceptsHtml = request.headers.accept?.includes("text/html") ?? false;
      const isSpaRoute =
        request.method === "GET" &&
        !request.url.startsWith("/api/") &&
        request.url !== "/health" &&
        !request.url.includes(".");

      if (acceptsHtml && isSpaRoute) {
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
