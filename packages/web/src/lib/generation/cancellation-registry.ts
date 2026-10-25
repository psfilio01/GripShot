const registry = new Map<string, AbortController>();

function key(workspaceId: string, requestId: string): string {
  return `${workspaceId}:${requestId}`;
}

export function registerGenerationCancellation(
  workspaceId: string,
  requestId: string,
): AbortSignal {
  const controller = new AbortController();
  registry.set(key(workspaceId, requestId), controller);
  return controller.signal;
}

export function cancelRegisteredGeneration(
  workspaceId: string,
  requestId: string,
): void {
  registry.get(key(workspaceId, requestId))?.abort();
}

export function releaseGenerationCancellation(
  workspaceId: string,
  requestId: string,
): void {
  registry.delete(key(workspaceId, requestId));
}
