import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Fastify from "fastify";
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

export async function createApp() {
  const config = getConfig();
  const app = Fastify({ logger: true });
  const eventBus = new DomainEventBus();
  const platformService = PlatformService.create(config.databaseUrl, eventBus);
  const runtime = new RuntimeOrchestrator(platformService, eventBus, getAdapterRegistry());

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
  app.decorate("authenticate", async function authenticate(request, reply) {
    try {
      const queryToken = (request.query as { token?: string } | undefined)?.token;
      if (queryToken && !request.headers.authorization) {
        request.user = app.jwt.verify(queryToken);
      } else {
        await request.jwtVerify();
      }
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
