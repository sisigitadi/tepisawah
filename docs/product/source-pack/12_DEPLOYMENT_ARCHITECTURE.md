# Deployment Architecture v1

## Current assets
- Domain: tepisawah.id
- Hosting: DirectAdmin
- GitHub: sisigitadi/tepisawah
- Vercel project: tepisawah

## Recommended topology

tepisawah.id
→ Public website

order.tepisawah.id
→ Customer ordering

pos.tepisawah.id
→ Internal POS

All application interfaces should consume a controlled backend/API and trusted data source.

## Environment separation

Local
→ Development

Vercel Preview
→ Feature/PR validation

Production
→ tepisawah.id and production subdomains

## Environment variables

Local:
.env.local

Production:
Vercel Environment Variables

Never put secrets into:
- source code
- GitHub repository
- client-side JavaScript
- screenshots
- documentation

## Backend decision
Do not lock the project to Google Sheets/Apps Script merely because it is convenient. Evaluate:
- concurrent users
- realtime requirements
- transaction integrity
- authentication
- cost
- backup
- developer experience
- future multi-branch needs

## Initial deployment objective
Deploy public website first, then customer ordering, then internal POS modules.
