import type { ExpressionId } from "@/lib/bloub/expressions";
import type { ShapeId } from "@/lib/bloub/skins";
import type { StateId } from "@/lib/bloub/states";

export type BloubMascotConfig = {
  shape: ShapeId;
  color: string;
  expression: ExpressionId;
  state: StateId;
};

export const DEFAULT_BLOUB: BloubMascotConfig = {
  shape: "cercle",
  color: "#ededed",
  expression: "neutre",
  state: "idle",
};
