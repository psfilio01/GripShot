import type { WorkflowType } from "../types/api";
import type { Product } from "../domain/product";
import type { BrandRules } from "../domain/brandRules";
import type { ReferenceImage } from "./referenceImageLoader";
import type { BuiltPrompt } from "../domain/prompt";
interface BuildPromptArgs {
    workflowType: WorkflowType;
    product: Product;
    brandRules: BrandRules | null;
    references: ReferenceImage[];
}
export declare function buildPrompt(args: BuildPromptArgs): BuiltPrompt;
export {};
//# sourceMappingURL=promptBuilder.d.ts.map