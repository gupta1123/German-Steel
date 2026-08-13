# German Steels Sales Dashboard

German Steels is a Next.js field-sales dashboard for visits, customers, employees, attendance, expenses, requirements, complaints, pricing, reports, and live locations.

## Backend configuration

All browser requests call the German Steels backend directly. Local development and deployed builds both use:

```text
http://ec2-18-211-58-135.compute-1.amazonaws.com:8081
```

The origin is fixed in the frontend API clients and screen-level requests, so no environment variable or Next.js proxy route is used.

> Netlify serves the frontend over HTTPS. The backend must also expose HTTPS for
> production browsers to permit these direct requests; an HTTP API is treated as
> blocked mixed content by modern browsers.

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
