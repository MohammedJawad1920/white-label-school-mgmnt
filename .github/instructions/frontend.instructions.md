---
name: "Frontend Freeze Rules"
description: "Hard rules for apps/** to stay Freeze compliant"
applyTo: "apps/**"
---

Must match Frontend Freeze exactly. [file:2]

- React 18 + Vite 5.x + TS strict + React Router v6 + TanStack Query v5 + axios + Tailwind v3. [file:2]
- No Redux/Zustand; server state via TanStack Query; auth via Context only. [file:2]
- No `dangerouslySetInnerHTML`; Tailwind classes only (no inline styles). [file:2]
- No direct fetch outside typed API client layer.
- Never hardcode API base URLs; use env vars.
