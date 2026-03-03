import { describe, it, expect } from "vitest";
/**
 * Unit tests: StatusBadge component
 * Freeze §5 "Component inventory", §6 A11y, §11 project structure.
 *
 * Verifies:
 *   - Correct Tailwind colour classes per status
 *   - Text label is always rendered (a11y — screen-reader accessible)
 *   - Unknown/fallback status renders muted classes without crashing
 *   - className prop is merged correctly
 */
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/StatusBadge";

describe("StatusBadge", () => {
  it('renders "Present" text for Present status', () => {
    render(<StatusBadge status="Present" />);
    expect(screen.getByText("Present")).toBeInTheDocument();
  });

  it('renders "Absent" text for Absent status', () => {
    render(<StatusBadge status="Absent" />);
    expect(screen.getByText("Absent")).toBeInTheDocument();
  });

  it('renders "Late" text for Late status', () => {
    render(<StatusBadge status="Late" />);
    expect(screen.getByText("Late")).toBeInTheDocument();
  });

  it("applies green classes for Present (Freeze §5 design system)", () => {
    const { container } = render(<StatusBadge status="Present" />);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("bg-green-100");
    expect(badge?.className).toContain("text-green-800");
  });

  it("applies red classes for Absent (Freeze §5 design system)", () => {
    const { container } = render(<StatusBadge status="Absent" />);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("bg-red-100");
    expect(badge?.className).toContain("text-red-800");
  });

  it("applies yellow classes for Late (Freeze §5 design system)", () => {
    const { container } = render(<StatusBadge status="Late" />);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("bg-yellow-100");
    expect(badge?.className).toContain("text-yellow-800");
  });

  it("renders muted fallback for unknown status without crashing", () => {
    render(<StatusBadge status="Unknown" />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    const { container } = render(<StatusBadge status="Unknown" />);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("bg-muted");
  });

  it("merges extra className prop", () => {
    const { container } = render(
      <StatusBadge status="Present" className="custom-class" />,
    );
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("custom-class");
  });

  it("text label is visible (a11y — Freeze §6 Screen Reader requirement)", () => {
    render(<StatusBadge status="Late" />);
    // Text must appear as an accessible text node, not hidden
    const el = screen.getByText("Late");
    expect(el).toBeVisible();
  });
});
