# FanFrame Totem Documentation Index

## Canonical Entry Points

| Doc | Status | Purpose |
| --- | --- | --- |
| `docs/HANDOFF.md` | Canonical | First document for new developers |
| `AGENTS.md` | Canonical | Rules for Codex and agentic development |
| `docs/architecture/INDEX.md` | Canonical | Router for flow-specific technical context |
| `docs/DEVELOPMENT.md` | Canonical | Local setup and validation |
| `docs/OPERATIONS.md` | Canonical | Production operations and incident response |
| `docs/ACCESS.md` | Canonical | Access matrix without secrets |
| `docs/ONBOARDING_CHECKLIST.md` | Canonical | New developer readiness checklist |

## Architecture Docs

| Doc | Use For |
| --- | --- |
| `docs/architecture/kiosk-flow.md` | Kiosk screens, steps, session state |
| `docs/architecture/payment-flow.md` | PIX, PagBank, CPF, paid-session contracts |
| `docs/architecture/generation-flow.md` | Replicate, queue, webhook, failure handling |
| `docs/architecture/delivery-flow.md` | QR code, delivery links, photo recovery |
| `docs/architecture/admin-publish-flow.md` | Admin config publishing and preview |
| `docs/architecture/data-model.md` | Tables, RLS, schema contracts |

## Operational Docs

| Doc | Use For |
| --- | --- |
| `docs/release-automation.md` | Windows release process |
| `docs/kiosk-totem.md` | Kiosk operation |
| `docs/kiosk-installation-owner-guide.md` | Owner/operator install guide |
| `docs/go-live-checklist.md` | Production readiness |
| `docs/windows-kiosk-release.md` | Windows kiosk release notes/process |
| `docs/security-production-review.md` | Production security review context |
| `docs/replicate-integration.md` | Replicate integration details |
| `docs/design-system.md` | Visual/design system guidance |

## Historical Or Planning Docs

| Path | Status |
| --- | --- |
| `docs/DOCUMENTATION.md` | Historical. Contains older app context and encoding artifacts. Prefer the canonical docs above. |
| `docs/superpowers/specs/` | Historical specs. Use only when investigating why a feature was designed. |
| `docs/superpowers/plans/` | Historical execution plans. Use only when tracing implementation history. |

## Rule For New Docs

Add new docs only when they become a reusable source of truth. Link them from this index and from `docs/HANDOFF.md` if they affect onboarding.
