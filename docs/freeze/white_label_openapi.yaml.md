openapi: 3.1.0
info:
  title: White-Label School Management System
  version: 3.4.0
  description: >
    Multi-tenant school management API. Supports SuperAdmin (platform-level)
    and tenant-scoped Admin / Teacher / Student roles.
    v3.4.0 changes:
      - POST /super-admin/tenants requires admin block (BREAKING)
      - PUT /super-admin/tenants/{id}/reactivate (NEW)
      - Role enum expanded to include Student (BREAKING)
      - students.user_id linkage + PUT /students/{id}/link-account (NEW)
      - PUT /attendance/{recordId} correction endpoint (NEW)
      - AttendanceRecord schema extended with originalStatus/correctedBy/correctedAt (BREAKING)
      - PUT /users/{id}/roles: SELFROLECHANGEFORBIDDEN removed, LASTADMIN added (BREAKING)

servers:
  - url: http://localhost:3000/api
    description: Local development

security:
  - bearerAuth: []

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:

    ErrorResponse:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message, timestamp]
          properties:
            code:
              type: string
              example: INVALID_CREDENTIALS
            message:
              type: string
              example: Invalid credentials
            details:
              type: object
              additionalProperties: true
            timestamp:
              type: string
              format: date-time

    TenantUser:
      type: object
      required: [id, tenantId, name, email, roles, activeRole]
      properties:
        id:
          type: string
        tenantId:
          type: string
        name:
          type: string
        email:
          type: string
          format: email
        roles:
          type: array
          items:
            type: string
            enum: [Teacher, Admin, Student]
          minItems: 1
        activeRole:
          type: string
          enum: [Teacher, Admin, Student]

    SuperAdminProfile:
      type: object
      required: [id, name, email]
      properties:
        id:
          type: string
        name:
          type: string
        email:
          type: string
          format: email

    Tenant:
      type: object
      required: [id, name, slug, status, createdAt]
      properties:
        id:
          type: string
        name:
          type: string
        slug:
          type: string
        status:
          type: string
          enum: [active, inactive]
        deactivatedAt:
          type: string
          format: date-time
          nullable: true
        createdAt:
          type: string
          format: date-time

    Feature:
      type: object
      required: [key, name, enabled]
      properties:
        key:
          type: string
          enum: [timetable, attendance]
        name:
          type: string
        enabled:
          type: boolean
        enabledAt:
          type: string
          format: date-time
          nullable: true

    User:
      type: object
      required: [id, name, email, roles]
      properties:
        id:
          type: string
        name:
          type: string
        email:
          type: string
          format: email
        roles:
          type: array
          items:
            type: string
            enum: [Teacher, Admin, Student]
          minItems: 1

    Student:
      type: object
      required: [id, name, classId, batchId]
      properties:
        id:
          type: string
        name:
          type: string
        classId:
          type: string
        className:
          type: string
        batchId:
          type: string
        batchName:
          type: string
        userId:
          type: string
          nullable: true
          description: >
            Linked user account id. Null if student has no login account.
            Set via PUT /students/{id}/link-account.

    Batch:
      type: object
      required: [id, name, startYear, endYear, status]
      properties:
        id:
          type: string
        name:
          type: string
        startYear:
          type: integer
        endYear:
          type: integer
        status:
          type: string
          enum: [Active, Archived]

    Subject:
      type: object
      required: [id, name]
      properties:
        id:
          type: string
        name:
          type: string
        code:
          type: string
          nullable: true

    Class:
      type: object
      required: [id, name, batchId]
      properties:
        id:
          type: string
        name:
          type: string
        batchId:
          type: string
        batchName:
          type: string

    SchoolPeriod:
      type: object
      required: [id, periodNumber, startTime, endTime]
      properties:
        id:
          type: string
        periodNumber:
          type: integer
          minimum: 1
        label:
          type: string
          maxLength: 100
        startTime:
          type: string
          pattern: '^\d{2}:\d{2}$'
          example: "08:00"
        endTime:
          type: string
          pattern: '^\d{2}:\d{2}$'
          example: "08:45"

    TimeSlot:
      type: object
      required: [id, classId, subjectId, teacherId, dayOfWeek, periodNumber, effectiveFrom]
      properties:
        id:
          type: string
        classId:
          type: string
        className:
          type: string
        subjectId:
          type: string
        subjectName:
          type: string
        teacherId:
          type: string
        teacherName:
          type: string
        dayOfWeek:
          type: string
          enum: [Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday]
        periodNumber:
          type: integer
          minimum: 1
        label:
          type: string
          description: Period label derived from schoolperiods at query time
          example: Period 3
        startTime:
          type: string
          pattern: '^\d{2}:\d{2}$'
          description: Derived from schoolperiods at query time, not stored in timeslots
          example: "09:40"
        endTime:
          type: string
          pattern: '^\d{2}:\d{2}$'
          description: Derived from schoolperiods at query time, not stored in timeslots
          example: "10:25"
        effectiveFrom:
          type: string
          format: date
        effectiveTo:
          type: string
          format: date
          nullable: true

    AttendanceRecord:
      type: object
      required: [id, date, status, timeSlot, recordedBy, recordedAt]
      properties:
        id:
          type: string
        date:
          type: string
          format: date
        originalStatus:
          type: string
          enum: [Present, Absent, Late]
          description: >
            The status as originally recorded. Never mutated after insert.
        status:
          type: string
          enum: [Present, Absent, Late]
          description: >
            The effective status. Equals correctedStatus if a correction
            exists, otherwise equals originalStatus.
        correctedBy:
          type: string
          nullable: true
          description: userId of the user who last corrected this record
        correctedAt:
          type: string
          format: date-time
          nullable: true
        timeSlot:
          type: object
          properties:
            id:
              type: string
            subjectName:
              type: string
            periodNumber:
              type: integer
            dayOfWeek:
              type: string
        recordedBy:
          type: string
        recordedAt:
          type: string
          format: date-time

    BulkDeleteRequest:
      type: object
      required: [ids]
      properties:
        ids:
          type: array
          items:
            type: string
          minItems: 1
          maxItems: 100
          uniqueItems: true

    BulkDeleteResponse:
      type: object
      required: [deleted, failed]
      properties:
        deleted:
          type: array
          items:
            type: string
        failed:
          type: array
          items:
            type: object
            required: [id, reason, message]
            properties:
              id:
                type: string
              reason:
                type: string
                enum: [NOT_FOUND, HAS_REFERENCES]
              message:
                type: string

    Pagination:
      type: object
      required: [limit, offset, total]
      properties:
        limit:
          type: integer
        offset:
          type: integer
        total:
          type: integer

  responses:
    Unauthorized:
      description: Missing or invalid token
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: UNAUTHORIZED
              message: Missing or invalid token
              timestamp: "2026-03-02T01:00:00Z"

    Forbidden:
      description: Insufficient permissions
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error:
              code: FORBIDDEN
              message: Insufficient permissions
              timestamp: "2026-03-02T01:00:00Z"

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'

    Conflict:
      description: Conflict
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'

    BadRequest:
      description: Validation failure
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'

paths:

  # ─────────────────────────────────────────────
  # AUTH
  # ─────────────────────────────────────────────

  /auth/login:
    post:
      summary: Tenant user login
      operationId: tenantLogin
      security: []
      tags: [Auth]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password, tenantSlug]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
                tenantSlug:
                  type: string
                  minLength: 1
                  maxLength: 100
            examples:
              success:
                value:
                  email: admin@school1.com
                  password: password123
                  tenantSlug: school1
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                required: [token, user]
                properties:
                  token:
                    type: string
                  user:
                    $ref: '#/components/schemas/TenantUser'
              examples:
                success:
                  value:
                    token: eyJhbGciOiJIUzI1NiJ9.example
                    user:
                      id: U123
                      tenantId: T001
                      name: John Doe
                      email: admin@school1.com
                      roles: [Admin]
                      activeRole: Admin
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          description: Tenant is inactive
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: TENANT_INACTIVE
                  message: Tenant is inactive
                  timestamp: "2026-03-02T01:00:00Z"
        '404':
          $ref: '#/components/responses/NotFound'

  /auth/logout:
    post:
      summary: Tenant user logout
      operationId: tenantLogout
      tags: [Auth]
      responses:
        '204':
          description: Logged out
        '401':
          $ref: '#/components/responses/Unauthorized'

  /auth/switch-role:
    post:
      summary: Switch active role context (multi-role users only)
      operationId: switchRole
      tags: [Auth]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [role]
              properties:
                role:
                  type: string
                  enum: [Teacher, Admin, Student]
            examples:
              switchToTeacher:
                value:
                  role: Teacher
              switchToStudent:
                value:
                  role: Student
      responses:
        '200':
          description: Role switched, new JWT issued
          content:
            application/json:
              schema:
                type: object
                required: [token, user]
                properties:
                  token:
                    type: string
                  user:
                    $ref: '#/components/schemas/TenantUser'
              examples:
                success:
                  value:
                    token: eyJhbGciOiJIUzI1NiJ9.newtoken
                    user:
                      id: U123
                      roles: [Admin, Teacher]
                      activeRole: Teacher
        '400':
          description: Role not assigned to user
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: ROLE_NOT_ASSIGNED
                  message: Requested role is not assigned to this user
                  timestamp: "2026-03-02T01:00:00Z"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          description: User has only one role
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: SINGLE_ROLE_USER
                  message: User has only one role, switching not applicable
                  timestamp: "2026-03-02T01:00:00Z"

  # ─────────────────────────────────────────────
  # SUPER ADMIN AUTH
  # ─────────────────────────────────────────────

  /super-admin/auth/login:
    post:
      summary: SuperAdmin login
      operationId: superAdminLogin
      security: []
      tags: [SuperAdmin]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
            examples:
              success:
                value:
                  email: platform@admin.com
                  password: supersecret123
      responses:
        '200':
          description: SuperAdmin authenticated
          content:
            application/json:
              schema:
                type: object
                required: [token, superAdmin]
                properties:
                  token:
                    type: string
                  superAdmin:
                    $ref: '#/components/schemas/SuperAdminProfile'
              examples:
                success:
                  value:
                    token: eyJhbGciOiJIUzI1NiJ9.satoken
                    superAdmin:
                      id: SA001
                      name: Platform Admin
                      email: platform@admin.com
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'

  # ─────────────────────────────────────────────
  # SUPER ADMIN — TENANTS
  # ─────────────────────────────────────────────

  /super-admin/tenants:
    get:
      summary: List all tenants
      operationId: listTenants
      tags: [SuperAdmin]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [active, inactive]
        - name: search
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Tenant list
          content:
            application/json:
              schema:
                type: object
                required: [tenants]
                properties:
                  tenants:
                    type: array
                    items:
                      $ref: '#/components/schemas/Tenant'
              examples:
                success:
                  value:
                    tenants:
                      - id: T001
                        name: Sunrise School
                        slug: sunrise
                        status: active
                        deactivatedAt: null
                        createdAt: "2026-01-01T00:00:00Z"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

    post:
      summary: >
        Create new tenant — v3.4 BREAKING: admin block required.
        Atomically seeds tenant + 8 default schoolperiods + first Admin user.
      operationId: createTenant
      tags: [SuperAdmin]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [id, name, slug, admin]
              properties:
                id:
                  type: string
                  maxLength: 50
                  pattern: '^[a-z0-9-]+$'
                name:
                  type: string
                  maxLength: 255
                slug:
                  type: string
                  maxLength: 100
                  pattern: '^[a-z0-9-]+$'
                admin:
                  type: object
                  required: [name, email, password]
                  properties:
                    name:
                      type: string
                      maxLength: 255
                    email:
                      type: string
                      format: email
                    password:
                      type: string
                      minLength: 8
            examples:
              success:
                summary: Create tenant with first admin
                value:
                  id: T002
                  name: New School
                  slug: newschool
                  admin:
                    name: School Admin
                    email: admin@newschool.com
                    password: securepass1
              errorMissingAdmin:
                summary: Missing admin block
                value:
                  id: T002
                  name: New School
                  slug: newschool
      responses:
        '201':
          description: Tenant created with 8 default periods and first Admin user
          content:
            application/json:
              schema:
                type: object
                required: [tenant, admin]
                properties:
                  tenant:
                    $ref: '#/components/schemas/Tenant'
                  admin:
                    type: object
                    required: [id, name, email, roles]
                    properties:
                      id:
                        type: string
                      name:
                        type: string
                      email:
                        type: string
                        format: email
                      roles:
                        type: array
                        items:
                          type: string
              examples:
                success:
                  value:
                    tenant:
                      id: T002
                      name: New School
                      slug: newschool
                      status: active
                      deactivatedAt: null
                      createdAt: "2026-03-02T07:00:00Z"
                    admin:
                      id: U001
                      name: School Admin
                      email: admin@newschool.com
                      roles: [Admin]
        '400':
          description: Validation failure or missing admin block
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                missingAdmin:
                  summary: admin block missing
                  value:
                    error:
                      code: VALIDATION_ERROR
                      message: admin block is required
                      timestamp: "2026-03-02T07:00:00Z"
                weakPassword:
                  summary: admin password too short
                  value:
                    error:
                      code: VALIDATION_ERROR
                      message: admin.password must be at least 8 characters
                      timestamp: "2026-03-02T07:00:00Z"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          description: Tenant id/slug conflict or admin email taken
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                slugConflict:
                  value:
                    error:
                      code: CONFLICT
                      message: Tenant id or slug already exists
                      timestamp: "2026-03-02T07:00:00Z"
                adminEmailTaken:
                  value:
                    error:
                      code: ADMIN_EMAIL_TAKEN
                      message: admin.email already exists for this tenant
                      timestamp: "2026-03-02T07:00:00Z"

  /super-admin/tenants/{tenantId}:
    put:
      summary: Update tenant name or slug
      operationId: updateTenant
      tags: [SuperAdmin]
      parameters:
        - name: tenantId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              minProperties: 1
              properties:
                name:
                  type: string
                  maxLength: 255
                slug:
                  type: string
                  maxLength: 100
                  pattern: '^[a-z0-9-]+$'
            examples:
              success:
                value:
                  name: Updated School Name
      responses:
        '200':
          description: Tenant updated
          content:
            application/json:
              schema:
                type: object
                required: [tenant]
                properties:
                  tenant:
                    $ref: '#/components/schemas/Tenant'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'

  /super-admin/tenants/{tenantId}/deactivate:
    put:
      summary: Deactivate a tenant
      operationId: deactivateTenant
      tags: [SuperAdmin]
      parameters:
        - name: tenantId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Tenant deactivated
          content:
            application/json:
              schema:
                type: object
                required: [tenant]
                properties:
                  tenant:
                    $ref: '#/components/schemas/Tenant'
              examples:
                success:
                  value:
                    tenant:
                      id: T001
                      status: inactive
                      deactivatedAt: "2026-03-02T07:00:00Z"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          description: Tenant already inactive
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: ALREADY_INACTIVE
                  message: Tenant is already inactive
                  timestamp: "2026-03-02T07:00:00Z"

  /super-admin/tenants/{tenantId}/reactivate:
    put:
      summary: Reactivate an inactive tenant (v3.4 NEW)
      operationId: reactivateTenant
      tags: [SuperAdmin]
      parameters:
        - name: tenantId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Tenant reactivated
          content:
            application/json:
              schema:
                type: object
                required: [tenant]
                properties:
                  tenant:
                    $ref: '#/components/schemas/Tenant'
              examples:
                success:
                  value:
                    tenant:
                      id: T001
                      status: active
                      deactivatedAt: null
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          description: Tenant already active
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: ALREADY_ACTIVE
                  message: Tenant is already active
                  timestamp: "2026-03-02T07:00:00Z"

  /super-admin/tenants/{tenantId}/features:
    get:
      summary: Get feature flags for a tenant
      operationId: getSuperAdminTenantFeatures
      tags: [SuperAdmin]
      parameters:
        - name: tenantId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Feature list
          content:
            application/json:
              schema:
                type: object
                required: [features]
                properties:
                  features:
                    type: array
                    items:
                      $ref: '#/components/schemas/Feature'
              examples:
                success:
                  value:
                    features:
                      - key: timetable
                        name: Timetable Management
                        enabled: true
                        enabledAt: "2026-01-01T00:00:00Z"
                      - key: attendance
                        name: Attendance Tracking
                        enabled: false
                        enabledAt: null
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'

  /super-admin/tenants/{tenantId}/features/{featureKey}:
    put:
      summary: Enable or disable a feature for a tenant
      operationId: toggleTenantFeature
      tags: [SuperAdmin]
      parameters:
        - name: tenantId
          in: path
          required: true
          schema:
            type: string
        - name: featureKey
          in: path
          required: true
          schema:
            type: string
            enum: [timetable, attendance]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [enabled]
              properties:
                enabled:
                  type: boolean
            examples:
              enable:
                value:
                  enabled: true
              disable:
                value:
                  enabled: false
      responses:
        '200':
          description: Feature toggled
          content:
            application/json:
              schema:
                type: object
                required: [feature]
                properties:
                  feature:
                    $ref: '#/components/schemas/Feature'
              examples:
                success:
                  value:
                    feature:
                      key: attendance
                      enabled: true
                      enabledAt: "2026-03-02T07:00:00Z"
        '400':
          description: Attendance requires timetable
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: FEATURE_DEPENDENCY
                  message: Attendance module requires Timetable to be enabled first
                  timestamp: "2026-03-02T07:00:00Z"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'

  # ─────────────────────────────────────────────
  # FEATURES (tenant read-only)
  # ─────────────────────────────────────────────

  /features:
    get:
      summary: List enabled features for current tenant (Admin read-only)
      operationId: getTenantFeatures
      tags: [Features]
      responses:
        '200':
          description: Feature list
          content:
            application/json:
              schema:
                type: object
                required: [features]
                properties:
                  features:
                    type: array
                    items:
                      $ref: '#/components/schemas/Feature'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /features/{featureKey}:
    put:
      summary: REMOVED in v3.2 — returns 403 for all callers
      operationId: toggleFeatureDeprecated
      tags: [Features]
      parameters:
        - name: featureKey
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                enabled:
                  type: boolean
      responses:
        '403':
          description: Feature management restricted to SuperAdmin
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: FORBIDDEN
                  message: Feature management is restricted to platform administrators
                  timestamp: "2026-03-02T07:00:00Z"
        '401':
          $ref: '#/components/responses/Unauthorized'

  # ─────────────────────────────────────────────
  # SCHOOL PERIODS
  # ─────────────────────────────────────────────

  /school-periods:
    get:
      summary: List all periods configured for current tenant
      operationId: listSchoolPeriods
      tags: [SchoolPeriods]
      responses:
        '200':
          description: Period list ordered by periodNumber
          content:
            application/json:
              schema:
                type: object
                required: [periods]
                properties:
                  periods:
                    type: array
                    items:
                      $ref: '#/components/schemas/SchoolPeriod'
              examples:
                success:
                  value:
                    periods:
                      - id: SP001
                        periodNumber: 1
                        label: Period 1
                        startTime: "08:00"
                        endTime: "08:45"
                      - id: SP002
                        periodNumber: 2
                        label: Period 2
                        startTime: "08:50"
                        endTime: "09:35"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          description: Timetable feature not enabled
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: FEATURE_DISABLED
                  message: Timetable feature is not enabled for this tenant
                  timestamp: "2026-03-02T07:00:00Z"

    post:
      summary: Create a new period for current tenant (Admin only)
      operationId: createSchoolPeriod
      tags: [SchoolPeriods]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [periodNumber, startTime, endTime]
              properties:
                periodNumber:
                  type: integer
                  minimum: 1
                label:
                  type: string
                  maxLength: 100
                  default: ''
                startTime:
                  type: string
                  pattern: '^\d{2}:\d{2}$'
                endTime:
                  type: string
                  pattern: '^\d{2}:\d{2}$'
            examples:
              success:
                summary: Add Period 9
                value:
                  periodNumber: 9
                  label: Period 9
                  startTime: "15:30"
                  endTime: "16:15"
              errorTimeInvalid:
                summary: Invalid time range
                value:
                  periodNumber: 9
                  startTime: "16:15"
                  endTime: "15:30"
      responses:
        '201':
          description: Period created
          content:
            application/json:
              schema:
                type: object
                required: [period]
                properties:
                  period:
                    $ref: '#/components/schemas/SchoolPeriod'
              examples:
                success:
                  value:
                    period:
                      id: SP009
                      periodNumber: 9
                      label: Period 9
                      startTime: "15:30"
                      endTime: "16:15"
        '400':
          description: Validation failure including startTime >= endTime
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                timeInvalid:
                  value:
                    error:
                      code: PERIOD_TIME_INVALID
                      message: startTime must be before endTime
                      timestamp: "2026-03-02T07:00:00Z"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          description: Admin required or timetable feature not enabled
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '409':
          description: periodNumber already exists for this tenant
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: CONFLICT
                  message: Period number 9 already exists for this school
                  timestamp: "2026-03-02T07:00:00Z"

  /school-periods/{id}:
    put:
      summary: Update period label or times (periodNumber is immutable)
      operationId: updateSchoolPeriod
      tags: [SchoolPeriods]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              minProperties: 1
              properties:
                label:
                  type: string
                  maxLength: 100
                startTime:
                  type: string
                  pattern: '^\d{2}:\d{2}$'
                endTime:
                  type: string
                  pattern: '^\d{2}:\d{2}$'
            examples:
              updateLabel:
                value:
                  label: Zero Period
              updateTimes:
                value:
                  startTime: "07:45"
                  endTime: "08:30"
      responses:
        '200':
          description: Period updated
          content:
            application/json:
              schema:
                type: object
                required: [period]
                properties:
                  period:
                    $ref: '#/components/schemas/SchoolPeriod'
        '400':
          description: Validation failure
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: PERIOD_TIME_INVALID
                  message: startTime must be before endTime
                  timestamp: "2026-03-02T07:00:00Z"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          description: Admin required or timetable feature not enabled
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          $ref: '#/components/responses/NotFound'

    delete:
      summary: Delete a period (blocked if active timeslots reference it)
      operationId: deleteSchoolPeriod
      tags: [SchoolPeriods]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Period deleted
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          description: Admin required or timetable feature not enabled
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          description: Active timeslots reference this period
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: HAS_REFERENCES
                  message: Cannot delete period — active timeslots reference it
                  timestamp: "2026-03-02T07:00:00Z"

  # ─────────────────────────────────────────────
  # TIMETABLE
  # ─────────────────────────────────────────────

  /timetable:
    get:
      summary: Query timetable
      operationId: getTimetable
      tags: [Timetable]
      parameters:
        - name: date
          in: query
          schema:
            type: string
            format: date
        - name: dayOfWeek
          in: query
          schema:
            type: string
            enum: [Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday]
        - name: teacherId
          in: query
          schema:
            type: string
        - name: classId
          in: query
          schema:
            type: string
        - name: status
          in: query
          schema:
            type: string
            enum: [Active, All]
            default: Active
      responses:
        '200':
          description: Timetable entries — startTime/endTime/label derived from schoolperiods
          content:
            application/json:
              schema:
                type: object
                required: [timetable]
                properties:
                  timetable:
                    type: array
                    items:
                      $ref: '#/components/schemas/TimeSlot'
              examples:
                success:
                  value:
                    timetable:
                      - id: TS001
                        classId: C001
                        className: Grade 10A
                        subjectId: SUB001
                        subjectName: Mathematics
                        teacherId: U123
                        teacherName: John Doe
                        dayOfWeek: Monday
                        periodNumber: 3
                        label: Period 3
                        startTime: "09:40"
                        endTime: "10:25"
                        effectiveFrom: "2026-01-01"
                        effectiveTo: null
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          description: Timetable feature not enabled
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: FEATURE_DISABLED
                  message: Timetable feature is not enabled for this tenant
                  timestamp: "2026-03-02T07:00:00Z"

    post:
      summary: Create timetable entry (Admin only) — v3.3 startTime/endTime removed from request
      operationId: createTimeSlot
      tags: [Timetable]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [classId, subjectId, teacherId, dayOfWeek, periodNumber, effectiveFrom]
              properties:
                classId:
                  type: string
                subjectId:
                  type: string
                teacherId:
                  type: string
                dayOfWeek:
                  type: string
                  enum: [Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday]
                periodNumber:
                  type: integer
                  minimum: 1
                effectiveFrom:
                  type: string
                  format: date
            examples:
              success:
                summary: Create Monday Period 3 slot
                value:
                  classId: C001
                  subjectId: SUB001
                  teacherId: U123
                  dayOfWeek: Monday
                  periodNumber: 3
                  effectiveFrom: "2026-03-01"
              errorPeriodNotConfigured:
                summary: Unknown period number
                value:
                  classId: C001
                  subjectId: SUB001
                  teacherId: U123
                  dayOfWeek: Monday
                  periodNumber: 99
                  effectiveFrom: "2026-03-01"
      responses:
        '201':
          description: TimeSlot created — startTime/endTime/label populated from schoolperiods
          content:
            application/json:
              schema:
                type: object
                required: [timeSlot]
                properties:
                  timeSlot:
                    $ref: '#/components/schemas/TimeSlot'
              examples:
                success:
                  value:
                    timeSlot:
                      id: TS002
                      classId: C001
                      className: Grade 10A
                      subjectId: SUB001
                      subjectName: Mathematics
                      teacherId: U123
                      teacherName: John Doe
                      dayOfWeek: Monday
                      periodNumber: 3
                      label: Period 3
                      startTime: "09:40"
                      endTime: "10:25"
                      effectiveFrom: "2026-03-01"
                      effectiveTo: null
        '400':
          description: Validation failure or period not configured
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                periodNotConfigured:
                  value:
                    error:
                      code: PERIOD_NOT_CONFIGURED
                      message: Period 99 is not configured for this school
                      timestamp: "2026-03-02T07:00:00Z"
                teacherRoleMissing:
                  value:
                    error:
                      code: INVALID_TEACHER
                      message: The specified user does not have the Teacher role
                      timestamp: "2026-03-02T07:00:00Z"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          description: Slot already occupied
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: CONFLICT
                  message: This period slot is already occupied for the given class and day
                  timestamp: "2026-03-02T07:00:00Z"

  /timetable/{timeSlotId}/end:
    put:
      summary: End a timetable assignment (Admin only)
      operationId: endTimeSlot
      tags: [Timetable]
      parameters:
        - name: timeSlotId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [effectiveTo]
              properties:
                effectiveTo:
                  type: string
                  format: date
      responses:
        '200':
          description: TimeSlot ended
          content:
            application/json:
              schema:
                type: object
                required: [timeSlot]
                properties:
                  timeSlot:
                    type: object
                    properties:
                      id:
                        type: string
                      effectiveTo:
                        type: string
                        format: date
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'

  # ─────────────────────────────────────────────
  # USERS
  # ─────────────────────────────────────────────

  /users:
    get:
      summary: List users (Admin only)
      operationId: listUsers
      tags: [Users]
      parameters:
        - name: role
          in: query
          schema:
            type: string
            enum: [Teacher, Admin, Student]
        - name: search
          in: query
          schema:
            type: string
      responses:
        '200':
          description: User list
          content:
            application/json:
              schema:
                type: object
                required: [users]
                properties:
                  users:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
              examples:
                success:
                  value:
                    users:
                      - id: U123
                        name: John Doe
                        email: john@school1.com
                        roles: [Teacher]
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

    post:
      summary: Create user (Admin only)
      operationId: createUser
      tags: [Users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, email, password, roles]
              properties:
                name:
                  type: string
                  maxLength: 255
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
                roles:
                  type: array
                  items:
                    type: string
                    enum: [Teacher, Admin, Student]
                  minItems: 1
                  uniqueItems: true
            examples:
              createTeacher:
                value:
                  name: Jane Smith
                  email: jane@school1.com
                  password: securepass1
                  roles: [Teacher]
              createStudent:
                value:
                  name: Alice Student
                  email: alice@school1.com
                  password: securepass1
                  roles: [Student]
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                type: object
                required: [user]
                properties:
                  user:
                    $ref: '#/components/schemas/User'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          $ref: '#/components/responses/Conflict'

  /users/bulk:
    delete:
      summary: Bulk soft-delete users (Admin only)
      operationId: bulkDeleteUsers
      tags: [Users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BulkDeleteRequest'
            examples:
              success:
                value:
                  ids: [U001, U002, U003]
      responses:
        '200':
          description: Bulk delete result (partial success allowed)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BulkDeleteResponse'
              examples:
                partial:
                  value:
                    deleted: [U001, U002]
                    failed:
                      - id: U003
                        reason: HAS_REFERENCES
                        message: Cannot delete user — has active timeslot assignments or attendance records
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /users/{id}:
    delete:
      summary: Soft-delete a user (Admin only)
      operationId: deleteUser
      tags: [Users]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Deleted
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'

  /users/{id}/roles:
    put:
      summary: >
        Update user roles (Admin only).
        v3.4 BREAKING: Admin may now target self.
        SELFROLECHANGEFORBIDDEN removed.
        LASTADMIN guard added: cannot remove own Admin role if last admin.
      operationId: updateUserRoles
      tags: [Users]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [roles]
              properties:
                roles:
                  type: array
                  items:
                    type: string
                    enum: [Teacher, Admin, Student]
                  minItems: 1
                  uniqueItems: true
            examples:
              addTeacherToSelf:
                summary: Admin adds Teacher role to self
                value:
                  roles: [Admin, Teacher]
              removeOwnAdmin:
                summary: Admin removing own Admin (fails if last admin)
                value:
                  roles: [Teacher]
      responses:
        '200':
          description: Roles updated
          content:
            application/json:
              schema:
                type: object
                required: [user]
                properties:
                  user:
                    $ref: '#/components/schemas/User'
              examples:
                success:
                  value:
                    user:
                      id: U124
                      name: John Doe
                      email: john@school1.com
                      roles: [Admin, Teacher]
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          description: Not Admin, or last-admin guard triggered
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                lastAdmin:
                  summary: Caller is the last admin
                  value:
                    error:
                      code: LAST_ADMIN
                      message: Cannot remove Admin role — you are the last admin of this tenant
                      timestamp: "2026-03-02T07:00:00Z"
        '404':
          $ref: '#/components/responses/NotFound'

  # ─────────────────────────────────────────────
  # STUDENTS
  # ─────────────────────────────────────────────

  /students:
    get:
      summary: List students
      operationId: listStudents
      tags: [Students]
      parameters:
        - name: classId
          in: query
          schema:
            type: string
        - name: batchId
          in: query
          schema:
            type: string
        - name: search
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
            minimum: 1
            maximum: 200
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
            minimum: 0
      responses:
        '200':
          description: Student list
          content:
            application/json:
              schema:
                type: object
                required: [students, pagination]
                properties:
                  students:
                    type: array
                    items:
                      $ref: '#/components/schemas/Student'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

    post:
      summary: Create student (Admin only)
      operationId: createStudent
      tags: [Students]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, classId, batchId]
              properties:
                name:
                  type: string
                  maxLength: 255
                classId:
                  type: string
                batchId:
                  type: string
            examples:
              success:
                value:
                  name: Alice Smith
                  classId: C001
                  batchId: B001
      responses:
        '201':
          description: Student created
          content:
            application/json:
              schema:
                type: object
                required: [student]
                properties:
                  student:
                    $ref: '#/components/schemas/Student'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /students/bulk:
    delete:
      summary: Bulk soft-delete students (Admin only)
      operationId: bulkDeleteStudents
      tags: [Students]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BulkDeleteRequest'
      responses:
        '200':
          description: Bulk delete result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BulkDeleteResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /students/{id}:
    delete:
      summary: Soft-delete a student (Admin only)
      operationId: deleteStudent
      tags: [Students]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Deleted
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'

  /students/{studentId}/link-account:
    put:
      summary: >
        Link or unlink a user account to a student enrollment record (Admin only).
        v3.4 NEW. Pass userId: null to unlink.
      operationId: linkStudentAccount
      tags: [Students]
      parameters:
        - name: studentId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [userId]
              properties:
                userId:
                  type: string
                  nullable: true
            examples:
              link:
                summary: Link a user account
                value:
                  userId: U456
              unlink:
                summary: Unlink user account
                value:
                  userId: null
      responses:
        '200':
          description: Student account linked or unlinked
          content:
            application/json:
              schema:
                type: object
                required: [student]
                properties:
                  student:
                    $ref: '#/components/schemas/Student'
              examples:
                linked:
                  value:
                    student:
                      id: S001
                      name: Alice Smith
                      classId: C001
                      className: Grade 10A
                      batchId: B001
                      batchName: "2025-26"
                      userId: U456
                unlinked:
                  value:
                    student:
                      id: S001
                      name: Alice Smith
                      classId: C001
                      className: Grade 10A
                      batchId: B001
                      batchName: "2025-26"
                      userId: null
        '400':
          description: User not found or lacks Student role
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                invalidUser:
                  value:
                    error:
                      code: INVALID_USER
                      message: User not found or does not have the Student role
                      timestamp: "2026-03-02T07:00:00Z"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          description: userId already linked to another student
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: USER_ALREADY_LINKED
                  message: This user is already linked to a different student record
                  timestamp: "2026-03-02T07:00:00Z"

  /students/{studentId}/attendance:
    get:
      summary: >
        Get student attendance history.
        Admin: any student. Teacher: own-class students only.
        Student role: own record only (where students.user_id = caller's userId) — else 403 STUDENT_ACCESS_DENIED.
      operationId: getStudentAttendance
      tags: [Attendance]
      parameters:
        - name: studentId
          in: path
          required: true
          schema:
            type: string
        - name: from
          in: query
          schema:
            type: string
            format: date
        - name: to
          in: query
          schema:
            type: string
            format: date
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
            minimum: 1
            maximum: 200
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
            minimum: 0
      responses:
        '200':
          description: Attendance history — status is effective (correctedStatus ?? originalStatus)
          content:
            application/json:
              schema:
                type: object
                required: [student, records, summary, pagination]
                properties:
                  student:
                    $ref: '#/components/schemas/Student'
                  records:
                    type: array
                    items:
                      $ref: '#/components/schemas/AttendanceRecord'
                  summary:
                    type: object
                    properties:
                      totalRecords:
                        type: integer
                      present:
                        type: integer
                      absent:
                        type: integer
                      late:
                        type: integer
                      attendanceRate:
                        type: number
                        format: float
                  pagination:
                    $ref: '#/components/schemas/Pagination'
              examples:
                success:
                  value:
                    student:
                      id: S001
                      name: Alice Smith
                      classId: C001
                      className: Grade 10A
                      batchId: B001
                      batchName: "2025-26"
                      userId: U456
                    records:
                      - id: AR001
                        date: "2026-02-26"
                        originalStatus: Absent
                        status: Present
                        correctedBy: U123
                        correctedAt: "2026-03-02T07:30:00Z"
                        timeSlot:
                          id: TS001
                          subjectName: Mathematics
                          periodNumber: 1
                          dayOfWeek: Monday
                        recordedBy: U123
                        recordedAt: "2026-02-26T09:00:00Z"
                    summary:
                      totalRecords: 120
                      present: 110
                      absent: 8
                      late: 2
                      attendanceRate: 91.67
                    pagination:
                      limit: 50
                      offset: 0
                      total: 120
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          description: Attendance feature not enabled or student access denied
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                featureDisabled:
                  value:
                    error:
                      code: FEATURE_DISABLED
                      message: Attendance feature is not enabled for this tenant
                      timestamp: "2026-03-02T07:00:00Z"
                studentAccessDenied:
                  value:
                    error:
                      code: STUDENT_ACCESS_DENIED
                      message: You can only view your own attendance record
                      timestamp: "2026-03-02T07:00:00Z"
        '404':
          $ref: '#/components/responses/NotFound'

  # ─────────────────────────────────────────────
  # ATTENDANCE
  # ─────────────────────────────────────────────

  /attendance/record-class:
    post:
      summary: Record attendance for entire class
      operationId: recordClassAttendance
      tags: [Attendance]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [timeSlotId, date, defaultStatus]
              properties:
                timeSlotId:
                  type: string
                date:
                  type: string
                  format: date
                defaultStatus:
                  type: string
                  enum: [Present, Absent, Late]
                exceptions:
                  type: array
                  items:
                    type: object
                    required: [studentId, status]
                    properties:
                      studentId:
                        type: string
                      status:
                        type: string
                        enum: [Present, Absent, Late]
            examples:
              success:
                value:
                  timeSlotId: TS001
                  date: "2026-03-01"
                  defaultStatus: Present
                  exceptions:
                    - studentId: S005
                      status: Absent
      responses:
        '201':
          description: Attendance recorded
          content:
            application/json:
              schema:
                type: object
                required: [recorded, present, absent, late, date, timeSlot]
                properties:
                  recorded:
                    type: integer
                  present:
                    type: integer
                  absent:
                    type: integer
                  late:
                    type: integer
                  date:
                    type: string
                    format: date
                  timeSlot:
                    type: object
                    properties:
                      id:
                        type: string
                      className:
                        type: string
                      subjectName:
                        type: string
                      periodNumber:
                        type: integer
              examples:
                success:
                  value:
                    recorded: 30
                    present: 28
                    absent: 1
                    late: 1
                    date: "2026-03-01"
                    timeSlot:
                      id: TS001
                      className: Grade 10A
                      subjectName: Mathematics
                      periodNumber: 1
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          description: Attendance already recorded for this class/date/timeslot
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: CONFLICT
                  message: Attendance already recorded for this class, date, and timeslot
                  timestamp: "2026-03-02T07:00:00Z"

  /attendance/{recordId}:
    put:
      summary: >
        Correct an attendance record (v3.4 NEW).
        Original status is never mutated — preserved as originalStatus.
        Teacher: own-class records only. Admin: any record in tenant.
      operationId: correctAttendance
      tags: [Attendance]
      parameters:
        - name: recordId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [status]
              properties:
                status:
                  type: string
                  enum: [Present, Absent, Late]
            examples:
              correctToPresent:
                summary: Correct Absent → Present
                value:
                  status: Present
      responses:
        '200':
          description: Attendance corrected
          content:
            application/json:
              schema:
                type: object
                required: [record]
                properties:
                  record:
                    type: object
                    required: [id, date, originalStatus, status, correctedBy, correctedAt, timeSlot]
                    properties:
                      id:
                        type: string
                      date:
                        type: string
                        format: date
                      originalStatus:
                        type: string
                        enum: [Present, Absent, Late]
                      status:
                        type: string
                        enum: [Present, Absent, Late]
                        description: Effective status after correction
                      correctedBy:
                        type: string
                      correctedAt:
                        type: string
                        format: date-time
                      timeSlot:
                        type: object
                        properties:
                          id:
                            type: string
                          subjectName:
                            type: string
                          periodNumber:
                            type: integer
                          dayOfWeek:
                            type: string
              examples:
                success:
                  value:
                    record:
                      id: AR001
                      date: "2026-03-01"
                      originalStatus: Absent
                      status: Present
                      correctedBy: U123
                      correctedAt: "2026-03-02T07:30:00Z"
                      timeSlot:
                        id: TS001
                        subjectName: Mathematics
                        periodNumber: 3
                        dayOfWeek: Monday
        '400':
          description: Future date or same status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                futureDate:
                  value:
                    error:
                      code: FUTURE_DATE
                      message: Cannot correct attendance for a future date
                      timestamp: "2026-03-02T07:00:00Z"
                sameStatus:
                  value:
                    error:
                      code: SAME_STATUS
                      message: Correction status is identical to current effective status
                      timestamp: "2026-03-02T07:00:00Z"
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          description: Teacher not assigned to this timeslot
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              example:
                error:
                  code: FORBIDDEN
                  message: You are not assigned to this timeslot
                  timestamp: "2026-03-02T07:00:00Z"
        '404':
          $ref: '#/components/responses/NotFound'

  /attendance/summary:
    get:
      summary: Get aggregated attendance summary
      operationId: getAttendanceSummary
      tags: [Attendance]
      parameters:
        - name: classId
          in: query
          schema:
            type: string
        - name: from
          in: query
          required: true
          schema:
            type: string
            format: date
        - name: to
          in: query
          required: true
          schema:
            type: string
            format: date
      responses:
        '200':
          description: Attendance summary — uses effective status (corrected where applicable)
          content:
            application/json:
              schema:
                type: object
                properties:
                  class:
                    type: object
                    properties:
                      id:
                        type: string
                      name:
                        type: string
                      studentCount:
                        type: integer
                  period:
                    type: object
                    properties:
                      from:
                        type: string
                        format: date
                      to:
                        type: string
                        format: date
                      days:
                        type: integer
                  summary:
                    type: object
                    properties:
                      totalRecords:
                        type: integer
                      present:
                        type: integer
                      absent:
                        type: integer
                      late:
                        type: integer
                      attendanceRate:
                        type: number
                  byStudent:
                    type: array
                    items:
                      type: object
                      properties:
                        studentId:
                          type: string
                        studentName:
                          type: string
                        present:
                          type: integer
                        absent:
                          type: integer
                        late:
                          type: integer
                        attendanceRate:
                          type: number
              examples:
                success:
                  value:
                    class:
                      id: C001
                      name: Grade 10A
                      studentCount: 30
                    period:
                      from: "2026-02-01"
                      to: "2026-02-28"
                      days: 28
                    summary:
                      totalRecords: 840
                      present: 780
                      absent: 50
                      late: 10
                      attendanceRate: 92.86
                    byStudent:
                      - studentId: S001
                        studentName: Alice Smith
                        present: 26
                        absent: 2
                        late: 0
                        attendanceRate: 92.86
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  # ─────────────────────────────────────────────
  # BATCHES
  # ─────────────────────────────────────────────

  /batches:
    get:
      summary: List batches
      operationId: listBatches
      tags: [Batches]
      responses:
        '200':
          description: Batch list
          content:
            application/json:
              schema:
                type: object
                required: [batches]
                properties:
                  batches:
                    type: array
                    items:
                      $ref: '#/components/schemas/Batch'
        '401':
          $ref: '#/components/responses/Unauthorized'

    post:
      summary: Create batch (Admin only)
      operationId: createBatch
      tags: [Batches]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, startYear, endYear]
              properties:
                name:
                  type: string
                startYear:
                  type: integer
                endYear:
                  type: integer
      responses:
        '201':
          description: Batch created
          content:
            application/json:
              schema:
                type: object
                required: [batch]
                properties:
                  batch:
                    $ref: '#/components/schemas/Batch'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /batches/bulk:
    delete:
      summary: Bulk soft-delete batches (Admin only)
      operationId: bulkDeleteBatches
      tags: [Batches]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BulkDeleteRequest'
      responses:
        '200':
          description: Bulk delete result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BulkDeleteResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /batches/{id}:
    put:
      summary: Update batch (Admin only)
      operationId: updateBatch
      tags: [Batches]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                status:
                  type: string
                  enum: [Active, Archived]
      responses:
        '200':
          description: Batch updated
          content:
            application/json:
              schema:
                type: object
                required: [batch]
                properties:
                  batch:
                    $ref: '#/components/schemas/Batch'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'

    delete:
      summary: Soft-delete a batch (Admin only)
      operationId: deleteBatch
      tags: [Batches]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Deleted
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'

  # ─────────────────────────────────────────────
  # SUBJECTS
  # ─────────────────────────────────────────────

  /subjects:
    get:
      summary: List subjects
      operationId: listSubjects
      tags: [Subjects]
      responses:
        '200':
          description: Subject list
          content:
            application/json:
              schema:
                type: object
                required: [subjects]
                properties:
                  subjects:
                    type: array
                    items:
                      $ref: '#/components/schemas/Subject'
        '401':
          $ref: '#/components/responses/Unauthorized'

    post:
      summary: Create subject (Admin only)
      operationId: createSubject
      tags: [Subjects]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name:
                  type: string
                  maxLength: 255
                code:
                  type: string
                  maxLength: 50
      responses:
        '201':
          description: Subject created
          content:
            application/json:
              schema:
                type: object
                required: [subject]
                properties:
                  subject:
                    $ref: '#/components/schemas/Subject'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /subjects/bulk:
    delete:
      summary: Bulk soft-delete subjects (Admin only)
      operationId: bulkDeleteSubjects
      tags: [Subjects]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BulkDeleteRequest'
      responses:
        '200':
          description: Bulk delete result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BulkDeleteResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /subjects/{id}:
    put:
      summary: Update subject (Admin only)
      operationId: updateSubject
      tags: [Subjects]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                code:
                  type: string
      responses:
        '200':
          description: Subject updated
          content:
            application/json:
              schema:
                type: object
                required: [subject]
                properties:
                  subject:
                    $ref: '#/components/schemas/Subject'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'

    delete:
      summary: Soft-delete a subject (Admin only)
      operationId: deleteSubject
      tags: [Subjects]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Deleted
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'

  # ─────────────────────────────────────────────
  # CLASSES
  # ─────────────────────────────────────────────

  /classes:
    get:
      summary: List classes
      operationId: listClasses
      tags: [Classes]
      responses:
        '200':
          description: Class list
          content:
            application/json:
              schema:
                type: object
                required: [classes]
                properties:
                  classes:
                    type: array
                    items:
                      $ref: '#/components/schemas/Class'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

    post:
      summary: Create class (Admin only)
      operationId: createClass
      tags: [Classes]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name, batchId]
              properties:
                name:
                  type: string
                  maxLength: 255
                batchId:
                  type: string
      responses:
        '201':
          description: Class created
          content:
            application/json:
              schema:
                type: object
                required: [class]
                properties:
                  class:
                    $ref: '#/components/schemas/Class'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /classes/bulk:
    delete:
      summary: Bulk soft-delete classes (Admin only)
      operationId: bulkDeleteClasses
      tags: [Classes]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BulkDeleteRequest'
      responses:
        '200':
          description: Bulk delete result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BulkDeleteResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /classes/{id}:
    put:
      summary: Update class (Admin only)
      operationId: updateClass
      tags: [Classes]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
      responses:
        '200':
          description: Class updated
          content:
            application/json:
              schema:
                type: object
                required: [class]
                properties:
                  class:
                    $ref: '#/components/schemas/Class'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'

    delete:
      summary: Soft-delete a class (Admin only)
      operationId: deleteClass
      tags: [Classes]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Deleted
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '404':
          $ref: '#/components/responses/NotFound'
        '409':
          $ref: '#/components/responses/Conflict'
