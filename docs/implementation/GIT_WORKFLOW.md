# Git & Deployment Workflow

## Repository
GitHub:
https://github.com/sisigitadi/tepisawah

## Branch model
For MVP:
- main = production
- feature/* = feature work

Examples:
feature/public-website
feature/customer-order
feature/cashier
feature/kitchen
feature/waiter

## Local workflow

git pull origin main

git checkout -b feature/customer-order

Implement
Test
Review

git add .
git commit -m "feat: implement customer ordering cart"
git push -u origin feature/customer-order

Then merge after validation.

## Commit convention
feat:
fix:
refactor:
docs:
style:
test:
chore:

## Deployment
Vercel should be the primary application deployment target if the selected stack is Vercel-compatible.

Production domain:
https://tepisawah.id

Potential subdomains:
https://order.tepisawah.id
https://pos.tepisawah.id

DNS configuration should be finalized in the domain/hosting control panel after Vercel project configuration is confirmed.

## DirectAdmin
Use DirectAdmin for services that actually require it, such as email or other hosting services. Avoid maintaining two competing production deployments for the same frontend.
