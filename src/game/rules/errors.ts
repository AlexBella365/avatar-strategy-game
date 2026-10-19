// Terse ActionError factory shared by the rule modules (validation failures).
import type { ActionError } from "../types";

export function err(code: string, message: string): ActionError {
  return { code, message };
}
