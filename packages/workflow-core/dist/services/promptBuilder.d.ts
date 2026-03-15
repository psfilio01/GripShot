import type { WorkflowType } from "../types/api";
import type { SceneOptions } from "../types/api";
import type { Product } from "../domain/product";
import type { BrandRules } from "../domain/brandRules";
import type { ReferenceImage } from "./referenceImageLoader";
import type { BuiltPrompt } from "../domain/prompt";
import type { BrandDna } from "./brandDnaLoader";
import type { RuntimeInput } from "./runtimeInputLoader";
import type { HardRules } from "./hardRulesLoader";
export interface BuildPromptArgs {
    workflowType: WorkflowType;
    product: Product;
    brandRules: BrandRules | null;
    references: ReferenceImage[];
    brandDna?: BrandDna | null;
    sceneOptions?: SceneOptions;
    useGoldenBackground?: boolean;
    creativeFreedom?: boolean;
    imageLayout?: {
        hasProductRefs: boolean;
        hasBackgroundRef: boolean;
        hasModelRefs: boolean;
    };
    /** Runtime creative input from OpenClaw / run_input.json. */
    runtimeInput?: RuntimeInput | null;
    /** Global brand hard rules. */
    globalHardRules?: HardRules | null;
    /** Product-specific hard rules. */
    productHardRules?: HardRules | null;
}
export declare function buildPrompt(args: BuildPromptArgs): BuiltPrompt;
//# sourceMappingURL=promptBuilder.d.ts.map