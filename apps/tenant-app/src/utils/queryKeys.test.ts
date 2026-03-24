import { describe, expect, it } from "vitest";
import { QUERY_KEYS } from "./queryKeys";

describe("QUERY_KEYS", () => {
  it("custom returns raw tuple", () => {
    expect(QUERY_KEYS.custom("a", 1)).toEqual(["a", 1]);
  });

  it("timetableToday key", () => {
    expect(QUERY_KEYS.timetableToday("2026-03-23")).toEqual([
      "timetable",
      "today",
      "2026-03-23",
    ]);
  });

  it("timetable without params", () => {
    expect(QUERY_KEYS.timetable()).toEqual(["timetable"]);
  });

  it("timetable with params", () => {
    expect(QUERY_KEYS.timetable({ dayOfWeek: "Monday" })).toEqual([
      "timetable",
      { dayOfWeek: "Monday" },
    ]);
  });

  it("schoolPeriods key", () => {
    expect(QUERY_KEYS.schoolPeriods()).toEqual(["school-periods"]);
  });

  it("classes key", () => {
    expect(QUERY_KEYS.classes()).toEqual(["classes"]);
  });

  it("batches key", () => {
    expect(QUERY_KEYS.batches()).toEqual(["batches"]);
  });

  it("subjects key", () => {
    expect(QUERY_KEYS.subjects()).toEqual(["subjects"]);
  });

  it("users key", () => {
    expect(QUERY_KEYS.users()).toEqual(["users"]);
  });

  it("user detail key", () => {
    expect(QUERY_KEYS.user("u1")).toEqual(["users", "u1"]);
  });

  it("students key", () => {
    expect(QUERY_KEYS.students()).toEqual(["students"]);
  });

  it("student detail key", () => {
    expect(QUERY_KEYS.student("s1")).toEqual(["students", "s1"]);
  });

  it("attendanceSummary key", () => {
    expect(QUERY_KEYS.attendanceSummary("slot1")).toEqual([
      "attendance-summary",
      "slot1",
    ]);
  });

  it("studentAttendancePaged key", () => {
    expect(
      QUERY_KEYS.studentAttendancePaged("s1", "2026-03-01", "2026-03-31", 2),
    ).toEqual(["student-attendance", "s1", "2026-03-01", "2026-03-31", 2]);
  });

  it("studentAttendance key", () => {
    expect(
      QUERY_KEYS.studentAttendance("s1", "2026-03-01", "2026-03-31"),
    ).toEqual(["student-attendance", "s1", "2026-03-01", "2026-03-31"]);
  });

  it("studentAttendanceSummary key", () => {
    expect(QUERY_KEYS.studentAttendanceSummary("s1", 2026, 3)).toEqual([
      "student-attendance-summary",
      "s1",
      2026,
      3,
    ]);
  });

  it("attendanceStreaks key", () => {
    expect(QUERY_KEYS.attendanceStreaks("slot1")).toEqual([
      "attendance-streaks",
      "slot1",
    ]);
  });

  it("attendanceDailySummary key", () => {
    expect(QUERY_KEYS.attendanceDailySummary("c1", "2026-03-23")).toEqual([
      "attendance",
      "daily-summary",
      "c1",
      "2026-03-23",
    ]);
  });

  it("attendanceMonthlySheet key", () => {
    expect(QUERY_KEYS.attendanceMonthlySheet("c1", "sub1", 2026, 3)).toEqual([
      "attendance-monthly-sheet",
      "c1",
      "sub1",
      2026,
      3,
    ]);
  });

  it("attendanceToppers key", () => {
    expect(
      QUERY_KEYS.attendanceToppers("c1", "2026-03-01", "2026-03-31", 10),
    ).toEqual(["attendance-toppers", "c1", "2026-03-01", "2026-03-31", 10]);
  });

  it("absentees key", () => {
    expect(QUERY_KEYS.absentees("slot1", "2026-03-23")).toEqual([
      "attendance",
      "absentees",
      "slot1",
      "2026-03-23",
    ]);
  });

  it("events key", () => {
    expect(QUERY_KEYS.events("2026-03-01", "2026-03-31")).toEqual([
      "events",
      "2026-03-01",
      "2026-03-31",
    ]);
  });

  it("eventsCurrentMonth key", () => {
    expect(QUERY_KEYS.eventsCurrentMonth()).toEqual([
      "events",
      "current-month",
    ]);
  });

  it("features key", () => {
    expect(QUERY_KEYS.features()).toEqual(["features"]);
  });

  it("sessions key", () => {
    expect(QUERY_KEYS.sessions()).toEqual(["sessions"]);
  });

  it("sessionsList without filters", () => {
    expect(QUERY_KEYS.sessionsList()).toEqual(["sessions", "list"]);
  });

  it("sessionsList with filters", () => {
    expect(QUERY_KEYS.sessionsList({ status: "ACTIVE" })).toEqual([
      "sessions",
      "list",
      { status: "ACTIVE" },
    ]);
  });

  it("sessionCurrent key", () => {
    expect(QUERY_KEYS.sessionCurrent()).toEqual(["sessions", "current"]);
  });

  it("sessionDetail key", () => {
    expect(QUERY_KEYS.sessionDetail("sess1")).toEqual(["sessions", "sess1"]);
  });

  it("schoolProfile key", () => {
    expect(QUERY_KEYS.schoolProfile()).toEqual(["school-profile"]);
  });

  it("leave all key", () => {
    expect(QUERY_KEYS.leave.all()).toEqual(["leave"]);
  });

  it("leave list key", () => {
    expect(QUERY_KEYS.leave.list({ status: "PENDING" })).toEqual([
      "leave",
      "list",
      { status: "PENDING" },
    ]);
  });

  it("leave detail key", () => {
    expect(QUERY_KEYS.leave.detail("l1")).toEqual(["leave", "l1"]);
  });

  it("leave onCampus key", () => {
    expect(QUERY_KEYS.leave.onCampus()).toEqual(["leave", "on-campus"]);
  });

  it("exams all key", () => {
    expect(QUERY_KEYS.exams.all()).toEqual(["exams"]);
  });

  it("exams list key", () => {
    expect(QUERY_KEYS.exams.list({ classId: "c1" })).toEqual([
      "exams",
      "list",
      { classId: "c1" },
    ]);
  });

  it("exams detail key", () => {
    expect(QUERY_KEYS.exams.detail("e1")).toEqual(["exams", "e1"]);
  });

  it("exams results key", () => {
    expect(QUERY_KEYS.exams.results("e1")).toEqual(["exams", "e1", "results"]);
  });

  it("exams marks key", () => {
    expect(QUERY_KEYS.exams.marks("e1", "sub1")).toEqual([
      "exams",
      "e1",
      "subjects",
      "sub1",
      "marks",
    ]);
  });

  it("exams report card key", () => {
    expect(QUERY_KEYS.exams.reportCard("e1", "s1")).toEqual([
      "exams",
      "e1",
      "report-card",
      "s1",
    ]);
  });

  it("fees charges key", () => {
    expect(QUERY_KEYS.fees.charges({ classId: "c1" })).toEqual([
      "fees",
      "charges",
      { classId: "c1" },
    ]);
  });

  it("fees summary key", () => {
    expect(QUERY_KEYS.fees.summary({ sessionId: "sess1" })).toEqual([
      "fees",
      "summary",
      { sessionId: "sess1" },
    ]);
  });

  it("announcements list key", () => {
    expect(QUERY_KEYS.announcements.list({ limit: 10 })).toEqual([
      "announcements",
      "list",
      { limit: 10 },
    ]);
  });

  it("assignments detail key", () => {
    expect(QUERY_KEYS.assignments.detail("a1")).toEqual(["assignments", "a1"]);
  });

  it("assignments submissions key", () => {
    expect(QUERY_KEYS.assignments.submissions("a1")).toEqual([
      "assignments",
      "a1",
      "submissions",
    ]);
  });

  it("import history key", () => {
    expect(QUERY_KEYS.importJobs.history()).toEqual(["import", "history"]);
  });

  it("notifications unread count key", () => {
    expect(QUERY_KEYS.notifications.unreadCount()).toEqual([
      "notifications",
      "unread-count",
    ]);
  });

  it("guardian children key", () => {
    expect(QUERY_KEYS.guardianPortal.children()).toEqual([
      "guardian-portal",
      "children",
    ]);
  });

  it("guardian attendance key", () => {
    expect(QUERY_KEYS.guardianPortal.attendance("s1", "2026-03")).toEqual([
      "guardian-portal",
      "s1",
      "attendance",
      "2026-03",
    ]);
  });

  it("guardians list key", () => {
    expect(QUERY_KEYS.guardians.list("s1")).toEqual([
      "guardians",
      "student",
      "s1",
    ]);
  });
});
