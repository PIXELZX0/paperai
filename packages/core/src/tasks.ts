import type { TaskLifecycleStatus } from "@paperai/shared";

const TRANSITIONS: Record<TaskLifecycleStatus, TaskLifecycleStatus[]> = {
  backlog: ["todo", "cancelled"],
  todo: ["in_progress", "blocked", "cancelled"],
  in_progress: ["in_review", "blocked", "done", "cancelled"],
  in_review: ["todo", "done", "blocked", "cancelled"],
  blocked: ["todo", "in_progress", "cancelled"],
  done: [],
  cancelled: [],
};

export function canTransitionTaskStatus(from: TaskLifecycleStatus, to: TaskLifecycleStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
