import { describe, it, expect } from "vitest";
/**
 * Unit tests: useBulkSelect hook
 * Freeze §11 project structure — shared hooks.
 *
 * Verifies:
 *   - toggleOne selects / deselects individual items
 *   - toggleAll selects all when none selected; clears when all selected
 *   - clearSelection Resets to empty
 *   - isAllSelected / isSomeSelected computed flags
 *   - selectedIdsArray contains correct ids
 */
import { renderHook, act } from "@testing-library/react";
import { useBulkSelect } from "@/hooks/useBulkSelect";

type Item = { id: string; name: string };

const ITEMS: Item[] = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
  { id: "c", name: "Gamma" },
];

describe("useBulkSelect", () => {
  it("starts with empty selection", () => {
    const { result } = renderHook(() => useBulkSelect(ITEMS));
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isSomeSelected).toBe(false);
  });

  it("toggleOne adds an id to the set", () => {
    const { result } = renderHook(() => useBulkSelect(ITEMS));
    act(() => result.current.toggleOne("a"));
    expect(result.current.selectedIds.has("a")).toBe(true);
    expect(result.current.selectedCount).toBe(1);
  });

  it("toggleOne removes an already-selected id", () => {
    const { result } = renderHook(() => useBulkSelect(ITEMS));
    act(() => result.current.toggleOne("b"));
    act(() => result.current.toggleOne("b"));
    expect(result.current.selectedIds.has("b")).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it("toggleAll selects all items when none selected", () => {
    const { result } = renderHook(() => useBulkSelect(ITEMS));
    act(() => result.current.toggleAll());
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.selectedCount).toBe(ITEMS.length);
    ITEMS.forEach((item) =>
      expect(result.current.selectedIds.has(item.id)).toBe(true),
    );
  });

  it("toggleAll clears all when all items are selected", () => {
    const { result } = renderHook(() => useBulkSelect(ITEMS));
    act(() => result.current.toggleAll());
    act(() => result.current.toggleAll());
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it("isSomeSelected is true when partial selection", () => {
    const { result } = renderHook(() => useBulkSelect(ITEMS));
    act(() => result.current.toggleOne("a"));
    expect(result.current.isSomeSelected).toBe(true);
    expect(result.current.isAllSelected).toBe(false);
  });

  it("clearSelection resets to empty", () => {
    const { result } = renderHook(() => useBulkSelect(ITEMS));
    act(() => result.current.toggleAll());
    act(() => result.current.clearSelection());
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it("selectedIdsArray returns array of selected ids", () => {
    const { result } = renderHook(() => useBulkSelect(ITEMS));
    act(() => result.current.toggleOne("a"));
    act(() => result.current.toggleOne("c"));
    expect(result.current.selectedIdsArray).toEqual(
      expect.arrayContaining(["a", "c"]),
    );
    expect(result.current.selectedIdsArray.length).toBe(2);
  });

  it("isAllSelected and isSomeSelected are false on empty items list", () => {
    const { result } = renderHook(() => useBulkSelect([]));
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isSomeSelected).toBe(false);
  });
});
