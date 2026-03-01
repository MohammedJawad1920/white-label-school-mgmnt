import { describe, it, expect } from "vitest";
import { hasRole, isAdmin, isTeacher, isMultiRole } from "@/utils/roles";
import type { TenantUser } from "@/types/api";

const teacher: TenantUser = {
  id: "u1",
  tenantId: "t1",
  name: "Alice",
  email: "alice@school.com",
  roles: ["Teacher"],
  activeRole: "Teacher",
};

const admin: TenantUser = {
  id: "u2",
  tenantId: "t1",
  name: "Bob",
  email: "bob@school.com",
  roles: ["Admin"],
  activeRole: "Admin",
};

const multiRole: TenantUser = {
  id: "u3",
  tenantId: "t1",
  name: "Carol",
  email: "carol@school.com",
  roles: ["Teacher", "Admin"],
  activeRole: "Teacher",
};

describe("hasRole", () => {
  it("returns true when user has the role", () => {
    expect(hasRole(teacher, "Teacher")).toBe(true);
  });

  it("returns false when user lacks the role", () => {
    expect(hasRole(teacher, "Admin")).toBe(false);
  });

  it("returns false for null user", () => {
    expect(hasRole(null, "Admin")).toBe(false);
  });
});

describe("isAdmin", () => {
  it("returns true for Admin user", () => {
    expect(isAdmin(admin)).toBe(true);
  });

  it("returns false for Teacher-only user", () => {
    expect(isAdmin(teacher)).toBe(false);
  });

  it("returns true for multi-role user", () => {
    expect(isAdmin(multiRole)).toBe(true);
  });
});

describe("isTeacher", () => {
  it("returns true for Teacher user", () => {
    expect(isTeacher(teacher)).toBe(true);
  });

  it("returns false for Admin-only user", () => {
    expect(isTeacher(admin)).toBe(false);
  });
});

describe("isMultiRole", () => {
  it("returns true for user with 2+ roles", () => {
    expect(isMultiRole(multiRole)).toBe(true);
  });

  it("returns false for single-role user", () => {
    expect(isMultiRole(teacher)).toBe(false);
  });

  it("returns false for null user", () => {
    expect(isMultiRole(null)).toBe(false);
  });
});
