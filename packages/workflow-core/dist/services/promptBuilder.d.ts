import type { WorkflowType } from "../types/api";
import type { SceneOptions } from "../types/api";
import type { Product } from "../domain/product";
import type { BrandRules } from "../domain/brandRules";
import type { ReferenceImage } from "./referenceImageLoader";
import type { BuiltPrompt } from "../domain/prompt";
import type { BrandDna } from "./brandDnaLoader";
interface BuildPromptArgs {
    workflowType: WorkflowType;
    product: Product;
    brandRules: BrandRules | null;
    references: ReferenceImage[];
    /** For AMAZON_LIFESTYLE_SHOT */
    brandDna?: BrandDna | null;
    sceneOptions?: SceneOptions;
    useGoldenBackground?: boolean;
    creativeFreedom?: boolean;
    /** Describes which reference image types are included (order: product, background, model) */
    imageLayout?: {
        hasProductRefs: boolean;
        hasBackgroundRef: boolean;
        hasModelRefs: boolean;
    };
}
export declare function buildPrompt(args: BuildPromptArgs): BuiltPrompt;
export {};
//# sourceMappingURL=promptBuilder.d.ts.map