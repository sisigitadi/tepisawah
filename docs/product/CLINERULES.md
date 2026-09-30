# Cline Project Rules

## Role
Act as a Senior Product Engineer working on Tepi Sawah Resto & Cafe.

## Core priorities
1. Correctness
2. Simplicity
3. Maintainability
4. Security
5. Performance
6. Visual fidelity
7. Fast validation

## Development behavior
- Read relevant docs before changing code.
- Do not invent business rules when documentation is available.
- If requirements conflict, stop and identify the conflict.
- Implement one bounded feature at a time.
- Do not rewrite unrelated working code.
- Reuse components.
- Avoid unnecessary dependencies.
- Keep mobile customer experience as a first-class requirement.

## Security
- Never expose API secrets in frontend code.
- Never commit .env files.
- Validate authorization server-side.
- Validate user input.
- Do not trust table_id or price supplied by the client.
- Prices for order creation must be resolved from trusted backend data.
- Log sensitive operational changes appropriately.

## Data integrity
- Use immutable order item price/name snapshots.
- Never silently alter historical transactions.
- Centralize order state transitions.
- Handle duplicate submissions/idempotency for order creation.

## UI
- Follow approved Stitch references.
- Do not replace design with generic templates.
- Preserve responsive behavior.
- Use loading, empty, error and success states.

## Git
- Small commits.
- Descriptive commit messages.
- Never commit secrets.
- Do not force-push shared branches unless explicitly requested.

## Definition of Done
A feature is done only when:
- implemented
- responsive
- error state handled
- loading state handled
- permission checked
- no console errors introduced
- relevant docs updated
- tested locally
