# German Steels Sales Dashboard

German Steels is a Next.js field-sales dashboard for visits, customers, employees, attendance, expenses, requirements, complaints, pricing, reports, and live locations.

## Backend configuration

All browser requests use the same-origin `/api/proxy` route. Local development and deployed builds both use:

```text
http://ec2-18-211-58-135.compute-1.amazonaws.com:8081
```

The upstream is fixed in `lib/backend-origin.ts`. Browser requests remain same-origin through `/api/proxy`, so no public backend environment variable is needed.

## Run locally

```bash
npm ci
npm run dev -- --port 3000
```

Open [http://localhost:3000](http://localhost:3000).

## Production checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The high-growth visit, dashboard, journey, store-history, multi-team, employee-summary, and monthly-report screens use the paged/summary endpoints documented in `docs/endpoint-optimization-audit.md`.
