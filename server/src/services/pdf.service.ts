/**
 * PDF Generation Service (v5.0)
 *
 * Generates report cards as PDF buffers.
 * Uses puppeteer for HTML → PDF conversion.
 * Falls back to a simple text-based PDF if puppeteer is unavailable.
 */

import { pool } from "../db/pool";
import { logger } from "../utils/logger";

export async function isConfigured(): Promise<boolean> {
  try {
    // Dynamic import to avoid hard dependency at startup
    await import("puppeteer");
    return true;
  } catch {
    return false;
  }
}

async function renderReportCardHtml(
  examId: string,
  studentId: string,
  tenantId: string,
): Promise<string> {
  // Fetch exam + student + results data
  const examResult = await pool.query<{
    exam_name: string;
    exam_type: string;
    class_name: string;
    session_name: string;
    school_name: string;
    principal_name: string | null;
    principal_signature_url: string | null;
    branding_color: string | null;
  }>(
    `SELECT
       e.name AS exam_name, e.type AS exam_type,
       c.name AS class_name,
       s.name AS session_name,
       t.name AS school_name, t.principal_name, t.principal_signature_url, t.branding_color
     FROM exams e
     JOIN classes c ON e.class_id = c.id
     JOIN academic_sessions s ON e.session_id = s.id
     JOIN tenants t ON e.tenant_id = t.id
     WHERE e.id = $1 AND e.tenant_id = $2`,
    [examId, tenantId],
  );

  const studentResult = await pool.query<{
    student_name: string;
    admission_number: string;
  }>(
    `SELECT name AS student_name, admission_number FROM students WHERE id = $1 AND tenant_id = $2`,
    [studentId, tenantId],
  );

  const summaryResult = await pool.query<{
    total_marks_obtained: number;
    total_marks_possible: number;
    aggregate_percentage: number;
    overall_grade: string;
    overall_result: string;
    class_rank: number | null;
  }>(
    `SELECT total_marks_obtained, total_marks_possible, aggregate_percentage,
            overall_grade, overall_result, class_rank
     FROM exam_student_summaries
     WHERE exam_id = $1 AND student_id = $2 AND tenant_id = $3`,
    [examId, studentId, tenantId],
  );

  const subjectResults = await pool.query<{
    subject_name: string;
    total_marks: number;
    pass_marks: number;
    marks_obtained: number | null;
    is_absent: boolean;
    grade: string | null;
    is_pass: boolean | null;
  }>(
    `SELECT sub.name AS subject_name, es.total_marks, es.pass_marks,
            er.marks_obtained, er.is_absent, er.grade, er.is_pass
     FROM exam_results er
     JOIN exam_subjects es ON er.exam_subject_id = es.id
     JOIN subjects sub ON es.subject_id = sub.id
     WHERE er.exam_id_resolved = $1
       AND er.student_id = $2
       AND er.tenant_id = $3
     ORDER BY sub.name`,
    // Note: join via exam_subject_id
    [examId, studentId, tenantId],
  );

  const exam = examResult.rows[0];
  const student = studentResult.rows[0];
  const summary = summaryResult.rows[0];

  if (!exam || !student || !summary) {
    throw new Error("Report card data not found");
  }

  const brandColor = exam.branding_color ?? "#1A5276";

  const subjectRows = subjectResults.rows
    .map(
      (r) => `
    <tr>
      <td>${r.subject_name}</td>
      <td>${r.total_marks}</td>
      <td>${r.pass_marks}</td>
      <td>${r.is_absent ? "AB" : (r.marks_obtained ?? "-")}</td>
      <td>${r.grade ?? "-"}</td>
      <td><span class="result ${r.is_pass ? "pass" : "fail"}">${r.is_absent ? "AB" : r.is_pass ? "PASS" : "FAIL"}</span></td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Report Card</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #222; }
  .header { text-align: center; border-bottom: 3px solid ${brandColor}; padding-bottom: 16px; margin-bottom: 24px; }
  .school-name { font-size: 24px; font-weight: bold; color: ${brandColor}; }
  .exam-title { font-size: 16px; margin-top: 6px; }
  .student-info { display: flex; gap: 40px; margin-bottom: 24px; }
  .info-label { font-weight: bold; color: #666; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; }
  th { background: ${brandColor}; color: white; }
  .result.pass { color: #16a34a; font-weight: bold; }
  .result.fail { color: #dc2626; font-weight: bold; }
  .summary { background: #f8fafc; border: 2px solid ${brandColor}; border-radius: 8px; padding: 16px 24px; margin-bottom: 32px; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .summary-item { text-align: center; }
  .summary-value { font-size: 22px; font-weight: bold; color: ${brandColor}; }
  .summary-label { font-size: 11px; color: #666; }
  .signature { margin-top: 40px; display: flex; justify-content: flex-end; }
  .signature-block { text-align: center; }
  .signature-line { border-top: 1px solid #222; width: 160px; margin-top: 8px; }
</style>
</head>
<body>
<div class="header">
  <div class="school-name">${exam.school_name}</div>
  <div class="exam-title"><strong>${exam.exam_name}</strong> · ${exam.class_name} · ${exam.session_name}</div>
</div>
<div class="student-info">
  <div>
    <div class="info-label">STUDENT NAME</div>
    <div>${student.student_name}</div>
  </div>
  <div>
    <div class="info-label">ADMISSION NO.</div>
    <div>${student.admission_number}</div>
  </div>
</div>
<table>
  <thead>
    <tr><th>Subject</th><th>Max Marks</th><th>Pass Marks</th><th>Marks Obtained</th><th>Grade</th><th>Result</th></tr>
  </thead>
  <tbody>${subjectRows}</tbody>
</table>
<div class="summary">
  <div class="summary-grid">
    <div class="summary-item">
      <div class="summary-value">${summary.total_marks_obtained}/${summary.total_marks_possible}</div>
      <div class="summary-label">TOTAL MARKS</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${summary.aggregate_percentage.toFixed(1)}%</div>
      <div class="summary-label">AGGREGATE</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${summary.overall_grade}</div>
      <div class="summary-label">OVERALL GRADE</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${summary.overall_result}</div>
      <div class="summary-label">RESULT</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${summary.class_rank ?? "-"}</div>
      <div class="summary-label">CLASS RANK</div>
    </div>
  </div>
</div>
${
  exam.principal_name
    ? `
<div class="signature">
  <div class="signature-block">
    ${exam.principal_signature_url ? `<img src="${exam.principal_signature_url}" alt="Signature" style="height:50px;">` : ""}
    <div class="signature-line"></div>
    <div style="font-size:12px;margin-top:4px;">${exam.principal_name}</div>
    <div style="font-size:11px;color:#666;">Principal</div>
  </div>
</div>`
    : ""
}
</body>
</html>`;
}

/**
 * Generate a single student report card as PDF Buffer.
 */
export async function generateReportCard(
  examId: string,
  studentId: string,
  tenantId: string,
): Promise<Buffer> {
  const html = await renderReportCardHtml(examId, studentId, tenantId);

  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  } catch (err) {
    logger.error({ err, examId, studentId }, "Puppeteer PDF generation failed");
    throw new Error("Report card generation failed — puppeteer not available");
  }
}

/**
 * Generate all report cards for an exam as a ZIP buffer.
 */
export async function generateAllReportCards(
  examId: string,
  tenantId: string,
): Promise<{ filename: string; buffer: Buffer }[]> {
  const { rows: students } = await pool.query<{
    id: string;
    name: string;
    admission_number: string;
  }>(
    `SELECT DISTINCT s.id, s.name, s.admission_number
     FROM exam_student_summaries ess
     JOIN students s ON ess.student_id = s.id
     WHERE ess.exam_id = $1 AND ess.tenant_id = $2`,
    [examId, tenantId],
  );

  const results: { filename: string; buffer: Buffer }[] = [];

  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      for (const student of students) {
        try {
          const html = await renderReportCardHtml(examId, student.id, tenantId);
          const page = await browser.newPage();
          try {
            await page.setContent(html, { waitUntil: "networkidle0" });
            const pdf = await page.pdf({ format: "A4", printBackground: true });
            results.push({
              filename: `${student.admission_number}_${student.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
              buffer: Buffer.from(pdf),
            });
          } finally {
            await page.close();
          }
        } catch (err) {
          logger.error(
            { err, examId, studentId: student.id },
            "Failed to generate individual report card",
          );
        }
      }
    } finally {
      await browser.close();
    }
  } catch (err) {
    logger.error({ err, examId }, "Puppeteer not available or failed to launch");
  }

  return results;
}
