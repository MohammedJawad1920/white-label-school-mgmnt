import { describe, it, expect } from "vitest";
import { cn } from "@/utils/cn";

describe("cn", () => {
  it("merges class strings", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});
