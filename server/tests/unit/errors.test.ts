import {
  sendError,
  send400,
  send401,
  send403,
  send404,
  send409,
  send500,
} from "../../src/utils/errors";

// Minimal mock for Express Response
function mockRes() {
  const res: any = {
    statusCode: 0,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(obj: unknown) {
      res.body = obj;
      return res;
    },
  };
  return res;
}

describe("sendError", () => {
  it("produces correct error shape with timestamp inside error", () => {
    const res = mockRes();
    sendError(res, {
      code: "TEST_CODE",
      message: "something went wrong",
      status: 422,
      details: { foo: "bar" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatchObject({
      code: "TEST_CODE",
      message: "something went wrong",
      details: { foo: "bar" },
    });
    // timestamp must be inside error, NOT a sibling
    expect(res.body.error).toHaveProperty("timestamp");
    expect(res.body).not.toHaveProperty("timestamp");
    // timestamp must be an ISO string
    expect(() => new Date(res.body.error.timestamp)).not.toThrow();
  });

  it("defaults details to empty object when omitted", () => {
    const res = mockRes();
    sendError(res, { code: "X", message: "m", status: 400 });
    expect(res.body.error.details).toEqual({});
  });
});

describe("send400", () => {
  it("sends 400 with VALIDATION_ERROR code by default", () => {
    const res = mockRes();
    send400(res, "bad input");
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe("bad input");
  });

  it("accepts a custom code", () => {
    const res = mockRes();
    send400(res, "bad time", "PERIOD_TIME_INVALID");
    expect(res.body.error.code).toBe("PERIOD_TIME_INVALID");
  });
});

describe("send401", () => {
  it("sends 401 UNAUTHORIZED with default message", () => {
    const res = mockRes();
    send401(res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toBe("Unauthorized");
  });
});

describe("send403", () => {
  it("sends 403 FORBIDDEN by default", () => {
    const res = mockRes();
    send403(res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("accepts custom message and code", () => {
    const res = mockRes();
    send403(res, "Feature off", "FEATURE_DISABLED");
    expect(res.body.error.code).toBe("FEATURE_DISABLED");
    expect(res.body.error.message).toBe("Feature off");
  });
});

describe("send404", () => {
  it("sends 404 NOT_FOUND", () => {
    const res = mockRes();
    send404(res, "Student not found");
    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toBe("Student not found");
  });
});

describe("send409", () => {
  it("sends 409 CONFLICT by default", () => {
    const res = mockRes();
    send409(res, "Duplicate entry");
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });
});

describe("send500", () => {
  it("sends 500 INTERNAL_ERROR", () => {
    const res = mockRes();
    send500(res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.body.error).toHaveProperty("timestamp");
  });
});
