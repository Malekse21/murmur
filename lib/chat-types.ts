import type { BloubMascotConfig } from "@/lib/mascot-config";

export const CHAT_EXPRESSIONS = [
  "neutre", "attentif", "surpris", "excite", "heureux", "hilare", "colere", "triste",
  "effraye", "mefiant", "confus", "curieux", "fier", "timide", "blase", "somnolent",
] as const satisfies readonly BloubMascotConfig["expression"][];

