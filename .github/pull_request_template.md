## Summary

What changed and why.

## Phase scope

- [ ] This change stays inside the current phase boundary.
- [ ] No business logic leaked into apps (§34, §35).
- [ ] No new dependency added without an ADR-level justification.

## Validation

- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run test`

## Notes

Security-sensitive changes (RLS, auth, payments) attach a reviewer-approved
threat model.
