import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthTokenPayload } from "@paperai/shared";
import type { DomainEventBus } from "@paperai/core";
import type { PlatformService } from "./services/platform-service.js";
import type { RuntimeOrchestrator } from "./services/runtime.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    platformService: PlatformService;
    eventBus: DomainEventBus;
    runtime: RuntimeOrchestrator;
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  interface FastifyRequest {
    user: AuthTokenPayload;
  }
}
