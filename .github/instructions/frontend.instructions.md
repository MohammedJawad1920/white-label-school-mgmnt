---
name: "Frontend Rules"
description: "Production rules for apps/** — Freeze compliant"
applyTo: "apps/**"
---

# Frontend Instructions

Must match Frontend Freeze exactly.
Read the freeze doc before implementing anything.

---

## STACK (locked — do not upgrade or swap)

| Concern | Library | Version |
|---|---|---|
| Framework | React | 18.x |
| Build | Vite | 5.x |
| Language | TypeScript | strict mode |
| Routing | React Router | v6 |
| Server state | TanStack Query | v5 |
| HTTP client | axios | typed client layer |
| Forms | React Hook Form + Zod | — |
| Styling | Tailwind CSS | v3 |
| UI primitives | Radix UI | — |
| Testing | Vitest + Testing Library | — |
| API mocking | MSW | v2 |

---

## APP ISOLATION (critical)

The two apps are completely isolated. Never share code, tokens, or state between them.

| | `tenant-app` | `superadmin-app` |
|---|---|---|
| Port | 5173 | 5174 |
| localStorage key | `auth` | `sa-auth` |
| axios instance | `apiClient` | `saApiClient` |
| Auth context | `AuthContext` | `SAAuthContext` |
| Protected route | `ProtectedRoute` | `SAProtectedRoute` |

---

## DIRECTORY STRUCTURE (per app)

```
apps/<app>/src/
├── api/
│   ├── client.ts          ← axios instance + interceptors (auth header, 401 handler)
│   └── <feature>.ts       ← typed API functions for one domain
├── app/
│   ├── App.tsx            ← router setup, QueryClientProvider, AuthProvider
│   ├── ProtectedRoute.tsx ← redirects to login if unauthenticated
│   ├── FeatureGate.tsx    ← hides/blocks UI if feature disabled (tenant-app only)
│   ├── RoleGate.tsx       ← hides/blocks UI by role (tenant-app only)
│   └── SessionExpiredModal.tsx
├── components/            ← shared, reusable, stateless UI components
├── config/
│   └── nav.ts             ← navigation items (label, path, icon, roles, featureKey)
├── features/
│   └── <feature>/
│       └── <Feature>Page.tsx   ← page-level component
├── hooks/                 ← custom hooks (useAuth, useFeatureFlag, useBulkSelect, etc.)
├── types/
│   └── api.ts             ← TypeScript types mirroring OpenAPI schemas
└── utils/
    ├── cn.ts              ← Tailwind class merge helper
    ├── errors.ts          ← API error parsing
    ├── queryKeys.ts       ← TanStack Query key factory
    └── roles.ts           ← role constants and helpers
```

---

## API CLIENT LAYER

Every API call goes through the typed client — never call `fetch` or `axios` directly in components.

```typescript
// api/client.ts
import axios, { type InternalAxiosRequestConfig } from "axios";

const AUTH_KEY = "auth"; // "sa-auth" for superadmin-app

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT on every request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const raw = localStorage.getItem(AUTH_KEY);
  if (raw) {
    try {
      const { token } = JSON.parse(raw) as { token?: string };
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch { /* malformed — skip */ }
  }
  return config;
});

// Handle 401 globally — trigger session expired modal
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem(AUTH_KEY);
      window.dispatchEvent(new Event("session-expired"));
    }
    return Promise.reject(error);
  }
);
```

```typescript
// api/students.ts — typed API function example
import { apiClient } from "./client";
import type { Student, CreateStudentPayload, ApiListResponse } from "../types/api";

export const studentsApi = {
  list: (params?: { status?: string }) =>
    apiClient.get<ApiListResponse<Student>>("/students", { params }).then(r => r.data),

  create: (payload: CreateStudentPayload) =>
    apiClient.post<Student>("/students", payload).then(r => r.data),

  update: (id: string, payload: Partial<CreateStudentPayload>) =>
    apiClient.patch<Student>(`/students/${id}`, payload).then(r => r.data),

  delete: (ids: string[]) =>
    apiClient.delete("/students", { data: { ids } }).then(r => r.data),
};
```

---

## QUERY KEYS

Always use the query key factory — never write inline query keys:

```typescript
// utils/queryKeys.ts
export const queryKeys = {
  students: {
    all: ["students"] as const,
    list: (filters?: object) => ["students", "list", filters] as const,
    detail: (id: string) => ["students", "detail", id] as const,
  },
  // add per domain
};
```

---

## TANSTACK QUERY PATTERNS

```typescript
// List query
const { data, isLoading, isError } = useQuery({
  queryKey: queryKeys.students.list(),
  queryFn: studentsApi.list,
});

// Mutation with optimistic invalidation
const { mutate, isPending } = useMutation({
  mutationFn: studentsApi.create,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
    toast.success("Student created");
  },
  onError: (err) => {
    toast.error(parseApiError(err)); // use errors.ts helper
  },
});
```

---

## FEATURE FLAG + ROLE GATING

### Backend enforces, frontend reflects — never trust frontend gates alone.

```typescript
// Wrapping a page route in App.tsx
<Route
  path="/timetable"
  element={
    <ProtectedRoute>
      <FeatureGate featureKey="timetable">
        <RoleGate roles={["Admin", "Teacher"]}>
          <TimetablePage />
        </RoleGate>
      </FeatureGate>
    </ProtectedRoute>
  }
/>
```

```typescript
// Hiding a nav item
// config/nav.ts
export const navItems = [
  {
    label: "Timetable",
    path: "/timetable",
    icon: CalendarIcon,
    roles: ["Admin", "Teacher"],
    featureKey: "timetable",  // undefined = always show
  },
];
```

```typescript
// Programmatic check inside a component
const { hasFeature } = useFeatureFlag();
if (!hasFeature("timetable")) return null;
```

---

## FORM PATTERN

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
});

type FormValues = z.infer<typeof schema>;

const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
  resolver: zodResolver(schema),
});
```

---

## ERROR DISPLAY

```typescript
// utils/errors.ts
import axios from "axios";

export function parseApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message ?? "An unexpected error occurred";
  }
  return "An unexpected error occurred";
}
```

Always show field-level errors from backend `details` where forms are involved.
Never swallow errors silently — log to logger or show toast at minimum.

---

## COMPONENT RULES

- No `dangerouslySetInnerHTML`.
- No inline styles — Tailwind classes only.
- No hardcoded API base URLs — always `import.meta.env.VITE_API_BASE_URL`.
- No direct `localStorage` access outside `api/client.ts` and auth context.
- No Redux or Zustand — server state via TanStack Query, auth via Context.
- Components accept typed props — no untyped prop drilling.
- Loading and error states are required for every data-fetching component.

---

## TESTING

### Component tests
```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../__tests__/server"; // MSW server

test("shows student list", async () => {
  server.use(
    http.get("/api/students", () =>
      HttpResponse.json({ data: [{ id: "1", name: "Alice" }] })
    )
  );
  render(<StudentsPage />, { wrapper: AppProviders });
  expect(await screen.findByText("Alice")).toBeInTheDocument();
});

test("shows error state on API failure", async () => {
  server.use(
    http.get("/api/students", () => HttpResponse.error())
  );
  render(<StudentsPage />, { wrapper: AppProviders });
  expect(await screen.findByText(/error/i)).toBeInTheDocument();
});
```

Required test cases for every page:
- Renders loading state
- Renders data on success
- Renders error state on API failure
- User interactions (submit form, click delete, etc.)
- Role/feature gate hides content when unauthorized

### AppProviders wrapper (set up once)
```typescript
// __tests__/utils.tsx
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
```

---

## ACCESSIBILITY (minimum bar)

- All interactive elements have accessible labels (`aria-label` or visible text).
- Form inputs linked to labels via `htmlFor`/`id`.
- Error messages linked to inputs via `aria-describedby`.
- Focus management on modal open/close.
- Color contrast meets WCAG AA minimum.
