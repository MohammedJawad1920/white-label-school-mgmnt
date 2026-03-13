/**
 * Settings Controller (v5.0)
 *
 * GET /settings/grade-config — returns grade boundary configuration used by report cards.
 *
 * Phase 0 stub: returns the default Islamic-school grade boundaries.
 * Phase 1+ will allow customization per tenant (stored in a settings table).
 */

import { Request, Response } from "express";

// H-04: Field names changed to match GradeBoundary schema in OpenAPI (minPercentage/maxPercentage)
const DEFAULT_GRADE_BOUNDARIES = [
  { grade: "S", label: "Excellent", minPercentage: 85, maxPercentage: 100 },
  { grade: "A", label: "Very Good", minPercentage: 70, maxPercentage: 84 },
  { grade: "B", label: "Good", minPercentage: 60, maxPercentage: 69 },
  { grade: "C", label: "Average", minPercentage: 50, maxPercentage: 59 },
  { grade: "D", label: "Pass", minPercentage: 40, maxPercentage: 49 },
  { grade: "F", label: "Fail", minPercentage: 0, maxPercentage: 39 },
];

export async function getGradeConfig(
  _req: Request,
  res: Response,
): Promise<void> {
  // H-04: OpenAPI /settings/grade-config responds with { data: GradeBoundary[] }
  res.json({ data: DEFAULT_GRADE_BOUNDARIES });
}
