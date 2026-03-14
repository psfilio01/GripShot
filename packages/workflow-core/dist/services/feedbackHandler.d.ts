import type { FeedbackEvent } from "../types/api";
import type { ImageVariant } from "../domain/imageVariant";
interface HandleFeedbackInternalResult {
    updatedVariant: ImageVariant | null;
    newJobIds: string[];
}
export declare function handleFeedbackInternal(event: FeedbackEvent): Promise<HandleFeedbackInternalResult>;
export {};
//# sourceMappingURL=feedbackHandler.d.ts.map