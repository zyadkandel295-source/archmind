import type { PlatformState } from "../platform-types";
import type { AssistantRecord, AuthUser } from "../types";

export interface PlatformStateStore {
  getPlatformState(): PlatformState | Promise<PlatformState>;
  savePlatformState(state: PlatformState): void | Promise<void>;
  ensurePlatformPrincipal?(user: AuthUser, assistant?: AssistantRecord): void | Promise<void>;
}
