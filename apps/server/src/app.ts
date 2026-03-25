import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { DomainEventBus } from "@paperai/core";
import { getAdapterRegistry } from "./lib/adapters.js";
import { getConfig } from "./config.js";
import { routes } from "./routes/index.js";
import { PlatformService } from "./services/platform-service.js";
import { RuntimeOrchestrator } from "./services/runtime.js";

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

  runtime.start();
  app.addHook("onClose", async () => {
    runtime.stop();
  });

  return app;
}
