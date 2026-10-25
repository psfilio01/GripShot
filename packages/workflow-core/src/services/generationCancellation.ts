export interface GenerationControl {
  signal?: AbortSignal;
  isCancelled?: () => boolean | Promise<boolean>;
}

export class GenerationCancelledError extends Error {
  constructor() {
    super("Generation cancelled");
    this.name = "GenerationCancelledError";
  }
}

export async function throwIfGenerationCancelled(
  control?: GenerationControl,
): Promise<void> {
  if (control?.signal?.aborted || (await control?.isCancelled?.())) {
    throw new GenerationCancelledError();
  }
}

export function isGenerationCancelledError(error: unknown): boolean {
  return (
    error instanceof GenerationCancelledError ||
    (error instanceof Error &&
      (error.name === "CanceledError" || error.name === "AbortError"))
  );
}
