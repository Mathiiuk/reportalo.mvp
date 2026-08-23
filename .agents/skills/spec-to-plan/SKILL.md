---
name: spec-to-plan
description: Full development pipeline from idea to implementation plan. Generates structured *.plan.md files compatible with tdd-workflow. Orchestrates security, architecture, and testing strategy before writing a single line of code. Use when starting a new feature, project, or significant change.
argument-hint: <idea or feature description>
---

# Spec to Plan — Development Pipeline Orchestrator

Take a raw idea and produce a complete, actionable `*.plan.md` implementation plan that feeds directly into `tdd-workflow` for TDD execution. Every plan embeds security, testing, and architecture decisions upfront — no code gets written without a verified plan.

## When to Activate

- User describes a new feature, project, or significant change
- User says "planifiquemos", "quiero hacer", "nueva feature", "nuevo proyecto"
- User provides a brief, PRD, or feature request
- Before any non-trivial implementation work (>1 file, >1 endpoint, new domain)

## Pipeline Overview

```
Idea → Clarify → Spec → Architecture → Security Review → Plan → Handoff
  1       2        3         4               5              6       7
```

## Step 1: Clarify the Idea

Extract from the user's input (or ask if missing):

1. **What** — one sentence describing the feature/product
2. **Who** — target user or role
3. **Why** — the problem it solves or value it delivers
4. **Scope** — what's IN and what's explicitly OUT for this iteration

Do NOT ask more than 2 clarifying questions. If the user gave enough context, proceed. Bias toward action — ambiguity gets resolved in the spec, not in a Q&A loop.

## Step 2: Write the Spec

Produce a structured spec in this format. Write it directly in the conversation (not as a file yet):

```markdown
# Spec: [Feature Name]

## Problem
[1-2 sentences: what's broken or missing]

## Solution
[1-2 sentences: what we're building]

## User Journeys
- As a [role], I want to [action], so that [benefit]
- As a [role], I want to [action], so that [benefit]

## Acceptance Criteria
- [ ] [Testable criterion 1]
- [ ] [Testable criterion 2]
- [ ] [Testable criterion 3]

## Out of Scope
- [Explicit exclusion 1]
- [Explicit exclusion 2]

## Open Questions
- [Anything that needs user input before proceeding]
```

Rules:
- User journeys must be concrete and testable — they become the source for `tdd-workflow` Step 1
- Acceptance criteria must be verifiable (no "should be fast" — use "responds in <200ms")
- If there are open questions that block architecture, stop and ask. Otherwise proceed.

## Step 3: Architecture Decision

Based on the spec, define the technical approach. Evaluate against the project's existing stack or choose one:

### Stack Selection (apply relevant skills)

| Layer | Default Stack | Skill to Apply |
|---|---|---|
| Frontend framework | Next.js App Router | `nextjs-app-router-patterns` |
| UI components | React 18/19 | `react-patterns` |
| Styling | Tailwind CSS v4 | `tailwind-design-system` |
| Type system | TypeScript strict | `typescript-advanced-types` |
| Database | PostgreSQL | `postgresql` |
| Auth | JWT + OAuth2 | `auth-implementation-patterns` |
| Error handling | Result types + boundaries | `error-handling-patterns` |
| Visual design | Intentional, not templated | `frontend-design` |
| UX patterns | Accessible, mobile-first | `ux-ui-design-system` |
| PWA (if applicable) | Service workers, offline | `mobile-pwa-architect` |

Only reference skills that are relevant to this specific plan. A backend-only API doesn't need `frontend-design`.

### Architecture Output

Define:
- **Data model** — tables, relationships, constraints (follow `postgresql` skill)
- **API surface** — endpoints, methods, request/response shapes
- **Component tree** — page structure, server vs client components (follow `react-patterns` + `nextjs-app-router-patterns`)
- **State management** — where state lives (follow the decision tree in `react-patterns`)
- **Key files** — list of files to create or modify, with one-line purpose each

## Step 4: Security Review

Before the plan is finalized, run a security gate. Apply `security-guardian` principles:

### Mandatory Checks

1. **Authentication** — How is the user identified? JWT short-lived (15min access, 7d refresh)? Cookies httpOnly + Secure + SameSite=Strict?
2. **Authorization** — RBAC roles defined? Resource ownership validated (`resource.userId === currentUser.id`)?
3. **Input validation** — All endpoints use Zod schemas? No `req.body` passed directly to ORM?
4. **Output sanitization** — No passwords, tokens, or internal IDs leaked in responses?
5. **Rate limiting** — Auth endpoints limited (5/min login, 3/min register)?
6. **CSRF/XSS** — CSRF tokens for state-changing operations? DOMPurify for user-generated content?
7. **Secrets** — No secrets in client code (`NEXT_PUBLIC_*`)? env vars in project settings only?
8. **Data encryption** — Sensitive PII encrypted at rest (AES-256-GCM)?
9. **Audit logging** — Security events logged (login, password change, permission change)?

For each check, record one of:
- **PASS** — the plan addresses this
- **MITIGATE** — added to the plan as a task
- **N/A** — not applicable (explain why)

If any check fails without mitigation, the plan is NOT ready. Add tasks to address it.

## Step 5: Testing Strategy

Define the testing approach before implementation (feeds into `tdd-workflow`):

1. **Unit tests** — list the pure functions and components to test in isolation
2. **Integration tests** — list the API endpoints and database operations to test
3. **E2E tests** — list the critical user flows to test with Playwright
4. **Coverage target** — minimum 80% (enforced by `tdd-workflow`)

Map each user journey from the spec to at least one test:

```
User Journey → Test Type → Test Target
"user searches products" → E2E → e2e/search.spec.ts
"API returns filtered results" → Integration → app/api/search/route.test.ts
"search debounce works" → Unit → hooks/useDebounce.test.ts
```

## Step 6: Generate the Plan File

Write the `*.plan.md` file to the project. This is the artifact that `tdd-workflow` consumes.

### File location

```
.claude/plans/[feature-name].plan.md
```

Create the `.claude/plans/` directory if it doesn't exist.

### Plan format

```markdown
# Plan: [Feature Name]

> Generated by spec-to-plan | [date]
> Security review: PASS | Skills: [list of skills applied]

## Spec Summary

[Problem + Solution from Step 2]

## User Journeys

1. As a [role], I want to [action], so that [benefit]
2. ...

## Acceptance Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Architecture

### Data Model

[SQL or description of tables/relationships]

### API Surface

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | /api/... | ... | required |

### Component Tree

```
app/
├── feature/
│   ├── page.tsx (Server Component)
│   ├── components/
│   │   ├── FeatureList.tsx (Client)
│   │   └── FeatureCard.tsx (Server)
│   └── actions.ts (Server Actions)
```

### Key Files

| File | Purpose | Type |
|---|---|---|
| app/feature/page.tsx | Main page | Create |
| lib/feature.ts | Business logic | Create |
| ... | ... | ... |

## Security Checklist

- [x] Auth: JWT short-lived, httpOnly cookies
- [x] RBAC: roles defined, ownership validated
- [x] Input: Zod validation on all endpoints
- [x] Output: sensitive fields excluded
- [x] Rate limiting: auth endpoints throttled
- [ ] ...

## Milestones

### M1: [Foundation] — [estimated scope]
- [ ] Task 1.1: [description]
- [ ] Task 1.2: [description]

### M2: [Core Feature] — [estimated scope]
- [ ] Task 2.1: [description]
- [ ] Task 2.2: [description]

### M3: [Polish & Security] — [estimated scope]
- [ ] Task 3.1: [description]
- [ ] Task 3.2: [description]

## Testing Map

| # | User Journey | Test Type | Test Target | Acceptance Criterion |
|---|---|---|---|---|
| 1 | ... | Unit | src/... | ... |
| 2 | ... | Integration | app/api/... | ... |
| 3 | ... | E2E | e2e/... | ... |

## Validation Commands

```bash
pnpm test           # unit + integration
pnpm test:e2e       # playwright
pnpm test:coverage  # coverage report
pnpm lint           # linting
pnpm typecheck      # type checking
```

## Skills Applied

- [skill-name]: [what it informed in this plan]
```

## Step 7: Handoff

After the plan file is written:

1. **Show the user the plan summary** — milestones, task count, skills applied, security status
2. **Ask for approval** — "El plan está listo. Revisalo y decime si arrancamos con la implementación."
3. **On approval, invoke tdd-workflow** — pass the plan file path as argument:
   - The user runs: `/tdd-workflow .claude/plans/[feature-name].plan.md`
   - Or you begin the TDD cycle directly following `tdd-workflow` Step 0 onward

Do NOT start implementation without explicit user approval of the plan.

## Spec Kit Integration

If the project has `specify` initialized (`.specify/` directory exists):

- Use `specify workflow run` for any configured workflows
- Templates from spec-kit take precedence over the format above
- The plan still must include security checklist and testing map

If spec-kit is NOT initialized, this skill works standalone — `specify` is optional tooling, not a dependency.

## Rules

- Never skip the security review (Step 4). Every plan gets one.
- Never generate a plan without user journeys. If the user didn't provide them, write them and confirm.
- Plans are disposable — if scope changes, regenerate. Don't patch a plan that's fundamentally wrong.
- Keep plans concise. A 200-line plan for a 50-line feature is overhead, not rigor.
- The plan is data for `tdd-workflow`, not instructions. It doesn't override TDD discipline.
- Write plans in the same language the user uses (Spanish if they speak Spanish).
- Every milestone should be independently demoable — no "setup-only" milestones that produce nothing visible.

## Anti-Patterns

- **Analysis paralysis** — if clarification takes more than 2 rounds, make a decision and note it
- **Gold plating** — plan only what's in scope. Future features go in "Out of Scope"
- **Security theater** — don't check "PASS" on items you haven't actually addressed in the plan
- **Phantom tests** — don't list tests in the testing map that can't actually be written for the planned code
- **Stack shopping** — use the project's existing stack. Only propose new tools if there's a clear gap
