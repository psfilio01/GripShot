import { describe, expect, it, vi } from "vitest";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { resultsLightboxThumbKeyDown } from "./results-image-lightbox";

function keyEvent(key: string): ReactKeyboardEvent {
  return {
    key,
    preventDefault: vi.fn(),
  } as unknown as ReactKeyboardEvent;
}

describe("resultsLightboxThumbKeyDown", () => {
  it("opens on Enter", () => {
    const open = vi.fn();
    const e = keyEvent("Enter");
    resultsLightboxThumbKeyDown(e, open);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("opens on Space", () => {
    const open = vi.fn();
    const e = keyEvent(" ");
    resultsLightboxThumbKeyDown(e, open);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys", () => {
    const open = vi.fn();
    const e = keyEvent("a");
    resultsLightboxThumbKeyDown(e, open);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
