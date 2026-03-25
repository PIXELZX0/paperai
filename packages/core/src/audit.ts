import type { ActivityEvent, ActivityKind } from "@paperai/shared";

export interface AuditSeed {
  companyId: string;
  actorUserId?: string | null;
  actorAgentId?: string | null;
  kind: ActivityKind;
  targetType: string;
  targetId: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export function buildAuditEvent(seed: AuditSeed): ActivityEvent {
  return {
    id: crypto.randomUUID(),
    companyId: seed.companyId,
    actorUserId: seed.actorUserId ?? null,
    actorAgentId: seed.actorAgentId ?? null,
    kind: seed.kind,
    targetType: seed.targetType,
    targetId: seed.targetId,
    summary: seed.summary,
    payload: seed.payload ?? {},
    createdAt: new Date().toISOString(),
  };
}
