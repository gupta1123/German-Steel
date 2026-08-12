# German Steels Backend Optimization Requirements

## Phase 2 implementation specification

**To:** Backend Engineering  
**From:** German Steels Web Engineering  
**Version:** 1.0  
**Date:** 12 August 2026  
**Backend base URL:** `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081`  
**Status:** Implementation requested

> **Decision requested.** Implement the P0 and P1 contracts in this document before the affected screens are considered production-ready at scale. P2 work should follow in the same release train if capacity permits. The endpoints already delivered in the earlier optimization audit remain valid and must not be removed.

## 1. Purpose

The first optimization phase addressed the highest-growth visit, dashboard, journey, employee-summary, mobile-home, and monthly-report flows. A second audit of the active German Steels web application found additional screens that still download large unbounded datasets, fan out one request per team or month, filter only the current page, or enforce role scope in the browser.

This document defines the backend changes required to remove those remaining bottlenecks. It is written as an implementation contract: endpoint names, parameters, response shapes, authorization rules, performance expectations, database guidance, rollout order, and acceptance criteria are included.

## 2. Scale assumption and objective

The working load assumption remains:

- Approximately 50 field employees.
- Approximately 10 visits per employee per day.
- Approximately 500 visits per day, 15,000 per month, and 180,000 per year.
- Store, task, expense, request, pricing, and meeting history will continue accumulating.

The objective is not to add computation for its own sake. The objective is to move filtering, authorization, aggregation, paging, and export to the database/backend where they can be executed once, close to the data, with bounded memory and predictable response sizes.

## 3. Scope and delivery priority

| Priority | Backend change | Primary risk removed | Recommended release |
|---|---|---|---|
| P0 | Extend paged customer search for multiple teams | Thousands of stores downloaded and re-filtered on every filter change | Release 1 |
| P0 | Add unified paged task search | One unbounded task call per team; manager date filter is incorrect | Release 1 |
| P0 | Add streaming visit CSV export | Hundreds of sequential page requests and browser memory growth | Release 1 |
| P1 | Add expense page, summary, and export APIs | Full month/year datasets grouped and exported in the browser | Release 2 |
| P1 | Add role-scoped paged approval request search | Global pending list may be exposed before client-side filtering | Release 2 |
| P1 | Add grouped sales-performance range API | One sequential request per month | Release 2 |
| P1 | Complete meeting filter semantics | Dealer/owner/search/budget filters apply only to the visible page | Release 2 |
| P2 | Add multi-team pricing comparison API | Two requests per team for current and previous day | Release 3 |
| P2 | Add atomic bulk attendance status update | One write request per selected employee/date | Release 3 |
| P2 | Add multi-employee daily salary breakdown | One verification request per employee | Release 3 |
| P3 | Optional attendance month grid | Repeated frontend scans become costly only at larger headcount | Conditional |

## 4. Common API contract

All new and extended endpoints in this document must follow the same rules.

### 4.1 Pagination

- `page` is zero-based.
- `size` defaults to 20 and is capped at 200 for interactive list endpoints.
- The response uses the existing Spring page envelope: `content`, `totalElements`, `totalPages`, `number`, `size`, `first`, `last`, `numberOfElements`, and `empty`.
- Filtering and authorization occur before the count query and before pagination.
- Sorting is deterministic. Append `id` as the final tie-breaker when the requested sort field is not unique.
- Sort fields are allow-listed. Invalid sort fields return `400`, not a raw SQL/JPA error.

### 4.2 Dates and text filters

- Date parameters use ISO `yyyy-MM-dd` and are inclusive at both ends.
- Date-only business rules use `LocalDate` in the configured business timezone. Do not convert an inclusive end date through UTC in a way that drops records.
- Text search is trimmed and case-insensitive.
- An omitted filter means “no filter.” Empty strings should be treated as omitted.
- Invalid ranges, including `startDate > endDate`, return `400` with a field-level error.

### 4.3 Authorization

- The authenticated identity and backend role mapping are authoritative.
- Admin/Owner/Developer receive only the scope already permitted by the current security policy.
- Managers receive only teams, cities, employees, stores, and records they are authorized to manage.
- Field Officers receive only their permitted records, normally their own data and any explicitly shared scope in the existing policy.
- Client-supplied `teamIds`, `employeeId`, `storeId`, or city values never expand access.
- For a mixed list of authorized and unauthorized team IDs, the preferred behavior is `403` with `unauthorizedTeamIds`. If backward compatibility requires intersection behavior, the response must never include unauthorized data and the behavior must be documented consistently.
- The same authorization predicate must be used by list, summary, and export endpoints.

### 4.4 Error envelope

Use one consistent error shape:

```json
{
  "timestamp": "2026-08-12T10:30:00Z",
  "status": 400,
  "code": "INVALID_DATE_RANGE",
  "message": "startDate must be on or before endDate",
  "fieldErrors": {
    "startDate": "must be on or before endDate"
  },
  "requestId": "7e46860d..."
}
```

## 5. P0 — Required for Release 1

## 5.1 Multi-team customer search and paging

### Current problem

The customer page calls `/store/getForTeam` once per accessible team with `size=1000`, downloads every remaining page for every team, de-duplicates the combined arrays, and then applies search, birthday, sorting, and pagination in the browser. The process repeats after a 300 ms filter debounce.

Frontend evidence: `app/dashboard/customers/page.tsx` (`TEAM_CUSTOMER_PAGE_SIZE`, `getAllStoresForTeam`, and `fetchFilteredCustomers`).

### Required change

Extend the existing endpoint rather than creating a parallel admin/manager implementation:

`GET /store/filteredValues`

Add these optional parameters while preserving current behavior when they are omitted:

- Repeated `teamIds`.
- `storeName`.
- `ownerName`, matched against the combined client first and last name.
- `primaryContact`, normalized to digits for partial matching.
- `city`.
- `state`.
- `clientType`.
- `employeeName`.
- `birthdayOn`, an ISO date whose month and day are matched against the customer date of birth regardless of birth year.
- `page`, `size`, and `sort`.

Supported sort fields must include: `storeName`, `ownerFirstName`, `primaryContact`, `city`, `state`, `clientType`, `employeeName`, `monthlySale`, `intent`, `visitCount`, and `lastVisitDate`.

Example:

```http
GET /store/filteredValues?teamIds=11&teamIds=12&city=Pune&birthdayOn=2026-08-12&page=0&size=20&sort=lastVisitDate,desc
```

Expected response:

```json
{
  "content": [
    {
      "storeId": 25,
      "storeName": "Example Dealer",
      "clientFirstName": "Asha",
      "clientLastName": "Patil",
      "primaryContact": 9876543210,
      "city": "Pune",
      "state": "Maharashtra",
      "clientType": "Dealer",
      "employeeId": 12,
      "employeeName": "Example Officer",
      "monthlySale": 120000,
      "intent": 4,
      "totalVisitCount": 18,
      "lastVisitDate": "2026-08-10",
      "dateOfBirth": "1985-08-12"
    }
  ],
  "totalElements": 83,
  "totalPages": 5,
  "number": 0,
  "size": 20,
  "first": true,
  "last": false,
  "numberOfElements": 20,
  "empty": false
}
```

### Implementation notes

- Return a DTO projection. Do not hydrate full visits or unrelated store relationships.
- Calculate `totalVisitCount` and `lastVisitDate` with grouped/subquery projections that do not create an N+1 query.
- De-duplicate stores in SQL before the count and page are produced when a store can be reached through more than one requested team.
- Preserve the current admin use of `/store/filteredValues` when `teamIds` is absent.

### Acceptance criteria

- One request returns the correctly authorized, filtered, sorted page across multiple teams.
- `totalElements` counts unique stores after all filters.
- Page boundaries contain no duplicate store IDs.
- Birthday matching works across different birth years.
- Unauthorized team IDs cannot reveal stores or counts.

## 5.2 Unified paged task search

### Current problem

The Requirements and Complaints pages call `/task/getByTeam?id=...` once per team, merge and de-duplicate unbounded arrays, then filter and paginate in the browser. For managers, the current frontend deliberately bypasses the selected due-date range, so the displayed results are both inefficient and potentially incorrect.

Frontend evidence: `app/dashboard/requirements/page.tsx` and `app/dashboard/complaints/page.tsx` (`fetchTasks` and `applyFilters`).

### Required endpoint

`GET /task/searchPaged`

Parameters:

- Repeated `teamIds`.
- `taskType`: `requirement` or `complaint` for these screens.
- `startDate` and `endDate`, applied to `dueDate` inclusively.
- Optional repeated `status` for exact matching.
- Optional `includeCompleted`, default `true`; the current “all active” UI will explicitly send `false`.
- `priority`.
- `employeeId` and/or `employeeName`.
- `storeId` and/or `storeName`.
- `search`, matched against title, description, store name, and assigned employee name.
- `page`, `size`, and `sort`.

Supported sort fields: `dueDate`, `status`, `priority`, `taskTitle`, `assignedToName`, `storeName`, and `id`.

Example:

```http
GET /task/searchPaged?teamIds=11&teamIds=12&taskType=requirement&startDate=2026-08-01&endDate=2026-08-31&includeCompleted=false&priority=high&search=roof&page=0&size=20&sort=dueDate,desc
```

Expected response:

```json
{
  "content": [
    {
      "id": 501,
      "taskTitle": "Confirm roofing steel quantity",
      "taskDescription": "Dealer requested a revised quotation",
      "dueDate": "2026-08-20",
      "assignedToId": 12,
      "assignedToName": "Example Officer",
      "assignedById": 3,
      "status": "Assigned",
      "priority": "high",
      "category": "Sales",
      "storeId": 25,
      "storeName": "Example Dealer",
      "storeCity": "Pune",
      "taskType": "requirement"
    }
  ],
  "totalElements": 47,
  "totalPages": 3,
  "number": 0,
  "size": 20,
  "first": true,
  "last": false,
  "numberOfElements": 20,
  "empty": false
}
```

### Compatibility note

Use the correctly spelled `taskDescription` in the new DTO. Keep legacy endpoints unchanged. The frontend already tolerates the legacy `taskDesciption` spelling during migration.

### Acceptance criteria

- Date filters apply to managers as well as admins.
- `taskType=requirement` never returns complaints, and vice versa.
- Search and all structured filters are applied before pagination.
- The count and page use the same authorization and filter predicate.
- A task reachable through two teams appears once.

## 5.3 Streaming visit CSV export

### Current problem

The visit list export downloads every page with `size=200` in a sequential loop and holds the full result in browser memory before creating a CSV. At the projected annual volume of 180,000 visits, a broad export can require roughly 900 HTTP requests.

Frontend evidence: `components/visits-table.tsx` (`handleExport`).

### Required endpoint

`GET /visit/export`

The endpoint must accept the same filter semantics as the paged visit screens:

- Repeated `teamIds` when applicable.
- `startDate` and `endDate`.
- `employeeId` and/or `employeeName`.
- `storeId` and/or `storeName`.
- `purpose`, `priority`, and `outcome`.
- `sort`, default `visitDate,desc`.

Example:

```http
GET /visit/export?teamIds=11&teamIds=12&startDate=2026-01-01&endDate=2026-12-31&purpose=dealer%20visit&sort=visitDate,desc
```

Response requirements:

```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=UTF-8
Content-Disposition: attachment; filename="visits_2026-01-01_2026-12-31.csv"
```

CSV columns must preserve the active frontend export: Customer, Executive, Date, Status, Purpose, Visit Start, Visit End, Intent, Last Updated, City, and State. Include a UTF-8 BOM only if required for reliable Excel display.

### Implementation notes

- Stream rows with `StreamingResponseBody`, JDBC fetch-size/cursor processing, or the equivalent. Do not load the entire export into a Java collection.
- Use a lightweight projection containing only export columns.
- Escape commas, quotes, and line breaks according to RFC 4180.
- Apply authorization in the export query itself.
- An asynchronous job is not required for the projected volume if streaming is stable. If a future hard threshold is introduced, return `202` with a job resource rather than silently truncating.

### Acceptance criteria

- One request produces the complete file for the selected scope.
- Exported row count and filters match the paged list for the same criteria.
- Server memory remains bounded as row count grows.
- Disconnect/cancellation stops database iteration and closes resources.

## 6. P1 — Required for Release 2

## 6.1 Expense search, summary, and export

### Current problem

The Expenses page downloads every expense for a selected month or an entire year from `/expense/getByDateRange`, groups the data by employee, calculates status totals, filters, and builds CSV in the browser. The “All Months” option makes the request unbounded for the selected year.

Frontend evidence: `app/dashboard/expenses/page.tsx` (`loadExpenses`, `transformExpenseData`, and `handleExport`).

### Endpoint A — paged rows

`GET /expense/searchPaged`

Parameters:

- `startDate`, `endDate`.
- `employeeId`, `employeeName`.
- Optional repeated `approvalStatus`.
- `type`, `subType`.
- `minAmount`, `maxAmount`.
- `search`, matched against employee name, type, subtype, and description.
- `page`, `size`, and `sort`.

Supported sort fields: `expenseDate`, `amount`, `approvalStatus`, `employeeName`, `type`, `subType`, and `id`.

```http
GET /expense/searchPaged?startDate=2026-01-01&endDate=2026-12-31&approvalStatus=Pending&page=0&size=50&sort=expenseDate,desc
```

Return the existing `ExpenseDto` fields inside the standard page envelope. Attachment binary data must not be embedded in list responses; return attachment metadata/download links only.

### Endpoint B — totals and employee cards

`GET /expense/summary`

Accept the same non-pagination filters as `searchPaged`.

```json
{
  "expenseCount": 421,
  "totalAmount": 845000.0,
  "byStatus": [
    {"status": "Approved", "count": 330, "amount": 670000.0},
    {"status": "Pending", "count": 71, "amount": 135000.0},
    {"status": "Rejected", "count": 20, "amount": 40000.0}
  ],
  "byEmployee": [
    {
      "employeeId": 12,
      "employeeName": "Example Officer",
      "expenseCount": 18,
      "totalAmount": 32000.0,
      "approvedAmount": 25000.0,
      "pendingAmount": 5000.0,
      "rejectedAmount": 2000.0
    }
  ]
}
```

### Endpoint C — CSV export

`GET /expense/export`

Accept the same filters as `searchPaged` and stream `text/csv`. Columns: Employee, Position if available, Date, Category, Description, Amount, and Status.

### Acceptance criteria

- Page, summary, and export use the exact same filter and authorization predicate.
- Summary totals reconcile with the full filtered result, not only the current page.
- List responses exclude attachment file bytes.
- A full-year export is one streaming request.

## 6.2 Role-scoped paged approval request search

### Current problem

The Approvals page calls `/request/getByStatus?status=pending`, receives a plain array, and then filters manager/team visibility in the browser. If the endpoint returns global pending requests, unauthorized data is already transmitted. The History tab also cannot work correctly when only pending records are loaded.

Frontend evidence: `app/dashboard/approvals/page.tsx` (`fetchRequests` and `processedRequests`).

### Required endpoint

`GET /request/searchPaged`

Parameters:

- Optional repeated `status`; the Pending tab sends `status=pending`, while History uses `excludeStatus=pending`.
- `employeeId` and `employeeName`.
- `startDate` and `endDate`, applied to `requestDate` inclusively.
- `requestedStatus`.
- `search`, matched against employee name and description.
- `page`, `size`, and `sort`.

Supported sort fields: `requestDate`, `employeeName`, `status`, `requestedStatus`, `actionDate`, and `id`.

```http
GET /request/searchPaged?status=pending&search=asha&page=0&size=20&sort=requestDate,desc
```

Expected row fields:

```json
{
  "id": 301,
  "employeeId": 12,
  "employeeName": "Example Officer",
  "requestDate": "2026-08-12",
  "requestedStatus": "half day",
  "logDate": "2026-08-12",
  "actionDate": null,
  "status": "pending",
  "description": "Medical appointment"
}
```

Also add an optional lightweight count endpoint if the header counts cannot be returned cheaply with the list:

`GET /request/summary?startDate=&endDate=`

It should return `total`, `pending`, `approved`, and `rejected` for the authenticated scope.

### Acceptance criteria

- Managers cannot receive request rows or counts for employees outside their scope.
- Field Officers cannot broaden scope by passing another `employeeId`.
- History returns non-pending records without downloading the pending list.
- Search and tab status filters are evaluated before pagination.

## 6.3 Grouped sales-performance range

### Current problem

The Sales Performance report iterates month by month and awaits `/report/getAvgValues` sequentially. A 24-month report therefore makes 24 serial requests and sends raw monthly-sale and intent logs to the browser only to calculate averages.

Frontend evidence: `components/SalesPerformanceReport.tsx` (`fetchMonthData` and `fetchReportData`).

### Required endpoint

`GET /report/getAvgValuesRange`

Parameters:

- Required `storeId`.
- Required `startDate`, `endDate`.
- `groupBy=month`; reserve the parameter for future `week` or `quarter` support, but only `month` is required now.

```http
GET /report/getAvgValuesRange?storeId=25&startDate=2025-01-01&endDate=2026-12-31&groupBy=month
```

Expected response:

```json
[
  {
    "period": "2026-07",
    "label": "July 2026",
    "avgMonthlySale": 118500.0,
    "avgIntent": 3.8,
    "totalVisitCount": 12
  },
  {
    "period": "2026-08",
    "label": "August 2026",
    "avgMonthlySale": 121000.0,
    "avgIntent": 4.1,
    "totalVisitCount": 7
  }
]
```

### Semantics

- Include each calendar month intersecting the requested range.
- Respect partial first and last months.
- Return zero values for months with no activity so chart ordering is stable.
- Calculate averages in SQL or a single grouped service query. Do not return raw logs.
- Authorize `storeId` before executing the aggregation.

### Acceptance criteria

- A 24-month range requires one HTTP request.
- Results match the existing month-by-month calculation for the same dates.
- Month ordering is ascending and has no gaps.

## 6.4 Complete meeting filter semantics

### Current problem

`/meeting/getAll/paged` already performs useful backend paging for date, status, type, city, and state. However, free-text search, dealer, owner, and over-budget filters are applied only to the current page in the browser. The visible result is therefore incomplete, `totalElements` is misleading, and export can differ from the list.

Frontend evidence: `components/meetings-list.tsx` (`backendFiltersFor`, `filteredMeetings`, and `exportCsv`).

### Required change

Extend both endpoints used by the screen:

- `GET /meeting/getAll/paged`
- `GET /meeting/report/export`

Add optional parameters:

- `search`, matched against meeting type, status label, stage label, city, state, location, store name, dealer name, creator name, and customer reference.
- `dealer`, matched against store name, dealer name, and customer reference.
- `owner`, matched against creator name; prefer an additional `ownerId` for exact filtering.
- `overBudget`: `true` or `false`.
- Existing `start`, `end`, `status`, `meetingType`, `city`, `state`, `page`, `size`, `sortBy`, and `sortDir` remain supported.

For `overBudget`, compare actual expense total with expected budget using the persisted aggregate if reliable; otherwise use a grouped expense sum. Avoid loading the expense collection for every meeting.

### Acceptance criteria

- All filters apply to the full authorized dataset before paging.
- `totalElements` represents the complete filtered result.
- Export and visible list reconcile for identical filters.
- The query count does not grow with page size.

## 7. P2 — Required for Release 3

## 7.1 Multi-team pricing comparison

### Current problem

For managers and field officers, the Pricing page calls `/brand/getByTeamAndDate` once per team for the selected day and once per team for the previous day. The request count is approximately `2 × team count`.

Frontend evidence: `app/dashboard/pricing/page.tsx` (`fetchBrandData` and `fetchPreviousDayData`).

### Required endpoint

`GET /brand/comparisonForTeams`

Parameters:

- Repeated `teamIds`.
- Required `date`.
- Optional `compareDate`; default to the previous calendar day.
- Optional `city`.
- Optional `employeeId` or `employeeName`.

```http
GET /brand/comparisonForTeams?teamIds=11&teamIds=12&date=2026-08-12&compareDate=2026-08-11
```

Expected response:

```json
{
  "date": "2026-08-12",
  "compareDate": "2026-08-11",
  "current": [
    {
      "id": 901,
      "brandName": "German Steels",
      "price": 61.5,
      "city": "Pune",
      "employeeId": 12,
      "employeeName": "Example Officer"
    }
  ],
  "previous": []
}
```

De-duplicate by brand record ID after applying authorized team scope. Because this is a daily dataset, pagination is optional initially; add it only if one day can exceed the 200-row interactive limit.

## 7.2 Atomic bulk attendance status update

### Current problem

The Daily Breakdown admin action sends one `PUT /attendance-log/admin/updateStatus` request for every selected employee/date row.

Frontend evidence: `components/DailyBreakdown.tsx` (`handleBulkUpdate`).

### Required endpoint

`PUT /attendance-log/admin/updateStatusBulk`

Request:

```json
{
  "updates": [
    {"employeeId": 12, "date": "2026-08-10", "status": "full day"},
    {"employeeId": 12, "date": "2026-08-11", "status": "half day"}
  ]
}
```

Success response:

```json
{
  "requested": 2,
  "updated": 2,
  "failed": 0,
  "updatedKeys": ["12|2026-08-10", "12|2026-08-11"]
}
```

Rules:

- Admin-authorized operation only, matching current policy.
- Maximum 500 updates per request.
- Normalize and validate status against the existing attendance enum.
- Validate the complete payload before writing, then apply it atomically in one transaction.
- On validation failure, return `422` with row indices and make no changes.
- Upsert must be idempotent for the unique employee/date pair.
- Record the acting user and timestamp in the existing audit mechanism.

## 7.3 Multi-employee daily salary breakdown

### Current problem

After distance recalculation, verification calls `/salary-calculation/daily-breakdown` once per selected employee and combines results in the browser.

Frontend evidence: `components/DistanceRecalculation.tsx` (`refreshVerification`).

### Required endpoint

`GET /salary-calculation/daily-breakdown-range`

Parameters:

- Repeated `employeeIds`.
- Required `startDate`, `endDate`.

```http
GET /salary-calculation/daily-breakdown-range?employeeIds=12&employeeIds=18&startDate=2026-08-01&endDate=2026-08-31
```

Return a flat array using the existing daily breakdown DTO fields: `date`, `employeeId`, `employeeName`, allowances, salary values, `dayType`, visit count, day-of-week flags, distance values, and attendance flags.

Rules:

- Cap the request at 100 employees and 366 days.
- Apply employee authorization before calculation.
- Batch-fetch visits, attendance, distance, and salary inputs. Do not invoke the existing single-employee service in a loop if that repeats database queries.
- Order by employee name, employee ID, then date.

## 8. P3 — Conditional, not required now

If headcount grows beyond roughly 150 field employees or a monthly attendance query regularly exceeds 10,000 rows, add:

`GET /attendance-log/month-grid?startDate=&endDate=&employeeIds=`

Return attendance grouped by employee plus per-employee totals. At the current estimated scale, the frontend should first index the existing monthly attendance array by employee ID once, instead of asking the backend team to build this immediately.

## 9. Database and query guidance

The following are index candidates, not blind migration instructions. Confirm actual table and column names, inspect existing indexes, and use `EXPLAIN ANALYZE` on the final queries before adding or removing indexes.

### Recommended index shapes

- Store/team search: the team-to-employee join key; `store(employee_id, id)`; selective store filters such as `city`, `state`, and `client_type` where cardinality supports them. For birthday lookups, consider generated/indexed `dob_month` and `dob_day` columns if the current function-based filter cannot use an index.
- Tasks: `(task_type, due_date, status)`, `(assigned_to_id, due_date, status)`, and `(store_id, due_date, task_type)` according to the chosen query plan.
- Expenses: `(expense_date, employee_id, approval_status)` and/or `(approval_status, expense_date, employee_id)` based on the most selective production filters.
- Requests: `(status, request_date, employee_id)`.
- Sales/intent logs: `(store_id, change_date)` on both monthly-sale and intent history tables.
- Meetings: `(meeting_date, status, meeting_type)` and `(city, state, meeting_date)`. Add full-text or normalized search support only after measuring `LIKE` performance.
- Brand/pricing: `(employee_id, pricing_date)` plus the actual team/employee join key used by authorization.
- Attendance: enforce a unique key on `(employee_id, attendance_date)` before using bulk upsert.

### Query rules

- Use DTO projections for list and export endpoints.
- Avoid entity graphs that hydrate attachments, visits, expenses, attendees, or audit collections for every row.
- Keep page query counts constant as page size grows; prevent N+1 behavior.
- Count distinct root IDs when authorization joins can duplicate rows.
- Reuse a shared specification/predicate builder so list, summary, and export cannot drift.
- Select only the columns required by each response.

## 10. Non-functional requirements

- Paged list p95 target: at or below 750 ms on production-like data after warm-up.
- Summary/aggregation p95 target: at or below 1 second for a one-year range at projected scale.
- Export first byte target: at or below 2 seconds when the database is healthy; total duration may scale with row count.
- Interactive responses should normally remain below 1 MB.
- Export memory usage must be approximately constant with row count.
- Every endpoint must emit request ID, duration, result row count, authenticated role, and failure code in structured logs. Do not log tokens or sensitive descriptions.
- Add metrics for latency, error rate, count-query latency, export duration, and export row count.
- Publish all contracts in OpenAPI/Swagger with query parameter examples and authorization notes.

## 11. Rollout and backward compatibility

1. Add the new endpoints and optional parameters without removing existing endpoints.
2. Deploy database indexes only after verifying write impact and query plans in staging.
3. Load-test with at least 180,000 visits and proportionate task/expense/store history.
4. Migrate one frontend screen at a time behind normal release controls.
5. Compare counts, totals, and CSV rows between the old and new paths for the same filters.
6. Monitor latency, errors, and authorization denials for at least one normal reporting cycle.
7. Deprecate legacy unbounded endpoints only after access logs show no active web/mobile consumer.

No endpoint from the earlier optimization phase should be renamed or removed. In particular, retain the optimized visit, dashboard summary, employee journey, employee dashboard summary, mobile home summary, and employee range report APIs already delivered.

## 12. Backend definition of done

- P0 and P1 contracts implemented with integration tests.
- Role matrix tests cover Admin/Owner/Developer, Manager, Field Officer, unauthorized team, unauthorized employee, and unauthorized store cases.
- Filters are applied before pagination; list totals match exports and summaries.
- Pagination tests verify stable sorting, no duplicates across pages, correct last page, and empty results.
- Date tests cover inclusive boundaries, leap day, month boundary, partial month, and invalid range.
- Search tests cover case-insensitive and trimmed input.
- Export tests cover commas, quotes, newlines, UTF-8 names, client disconnect, and large row counts.
- Bulk attendance tests cover duplicate employee/date keys, invalid status, payload limit, rollback, idempotency, and audit fields.
- `EXPLAIN ANALYZE` evidence is attached to the backend pull request for high-volume queries.
- OpenAPI documentation is updated.
- Old endpoints remain backward compatible.

## 13. Explicitly excluded from backend scope

The following findings should be fixed in the frontend and are not reasons to add backend APIs now:

- `components/NewCustomersReport.tsx` still uses the old month-by-month report flow even though `/report/getForEmployeeRange` already exists. Migrate the frontend.
- `components/customer-detail-page.tsx` issues the same `/task/getByStoreAndDate` request twice and then splits the result. Fetch once and reuse it.
- The same customer-detail component contains a hard-coded June 2024 task range. Correct the frontend date handling.
- `/employee/getAll` is requested by several screens, but the expected employee list is small. Use shared client caching/revalidation before asking for another backend endpoint.
- The current attendance month view repeatedly filters one array per employee. Index the array by employee ID in the frontend first.
- A composite customer dashboard endpoint is optional; first remove duplicate calls and defer modal-only reference lists until the modal opens.

## 14. Final implementation checklist

1. Extend `/store/filteredValues` for authorized multi-team filtering and birthday paging.
2. Implement `/task/searchPaged`.
3. Implement streaming `/visit/export`.
4. Implement `/expense/searchPaged`, `/expense/summary`, and `/expense/export`.
5. Implement `/request/searchPaged`; add `/request/summary` if header counts are not included elsewhere.
6. Implement `/report/getAvgValuesRange`.
7. Extend meeting paging and export with search, dealer, owner, and over-budget filters.
8. Implement `/brand/comparisonForTeams`.
9. Implement `/attendance-log/admin/updateStatusBulk`.
10. Implement `/salary-calculation/daily-breakdown-range`.
11. Validate query plans, indexes, authorization, metrics, and OpenAPI documentation.
