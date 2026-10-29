# Admin removal handoff

Updated 29 October 2026 after the backend team supplied the new contracts.
The new routes are local backend changes and **are not deployed yet**, according to the supplied note. Frontend integration does not deploy the backend.

Tester-facing instructions are in [the release notes](German-Steels-Delete-Release-Notes-2026-10-29.txt). A copy is saved in the user's Downloads folder.

## New contracts connected

All nine mutations below use `POST`, `Authorization: Bearer <admin-token>`, `Content-Type: application/json`, and a required JSON body:

```json
{"reason":"Duplicate or incorrect entry"}
```

The reason must contain non-whitespace text and be at most 500 characters. The UI blocks blank reasons and repeated submissions. Requests are not automatically retried or redirected to older removal endpoints. All successful mutations return HTTP 200 according to the backend contract.

| Route | Web entry points | Important behavior |
| --- | --- | --- |
| `/api/admin/visits/{visitId}/cancel` | Visits list, Visit Details | Cancel linked tasks; active linked HR expenses must be archived first. The backend regenerates a completed visit's daily report. |
| `/api/admin/pricing/{pricingId}/remove` | Pricing | Refresh recorded prices and price summary after success. |
| `/api/admin/notes/{noteId}/remove` | Retail Customer, Institution, Project and Visit notes | Use the actual shared note ID. Keep edit history. |
| `/api/admin/project-sales/{saleId}/void` | Project Details > Sales | Refresh active sales and totals; backend excludes removed sales from achievements. |
| `/api/admin/files/{fileId}/remove` | Visit attachment manager, document file manager, note attachments, task images, expense receipts | Use the individual file ID. Accepted decision evidence is protected; the last active document file also deactivates its document version. |
| `/api/admin/retail-brands/{brandUsageId}/remove` | Customer Details > Relationship; retail Visit Details > Brands > Retail account brands | Use the actual account-brand usage ID. Removal affects the whole account, not only a visit's remarks. The legacy local-only visit-insight delete button was removed. |
| `/api/admin/meetings/{meetingId}/attendees/{attendeeId}/remove` | Meeting Details > Manage meeting items; saved attendee rows | Active gifts linked to the attendee must be removed first. |
| `/api/admin/meetings/{meetingId}/expenses/{expenseId}/remove` | Meeting Details > Manage meeting items; saved expense rows | Refresh active expenses and meeting totals. |
| `/api/admin/meetings/{meetingId}/gifts/{giftId}/remove` | Meeting Details > Manage meeting items; saved gift rows | Refresh active gifts and gift total. |

These endpoints require the actual `ADMIN`/`ROLE_ADMIN` role. Setup access such as OWNER, DEVELOPER, HO_ADMIN or broad scopes alone is not treated as authorization for these routes. HO_ADMIN with a separate ROLE_ADMIN authority is supported. The backend remains authoritative.

## History calls connected

- `GET /api/admin/removals/{recordType}/{recordId}`: the Removal history button on dashboard pages lets admins choose a type and ID. Successful actions also add browser-session shortcuts for the removed record. The view shows reason, actor employee ID and removal time. The snapshot is retained by the API; raw JSON is not shown to testers.
- `GET /api/admin/meetings/{meetingId}/items/history`: Manage meeting items shows active and inactive attendees, expenses and gifts. Individual history buttons use the removal-history endpoint. Inactive items cannot be removed again from this view.

Supported history types: VISIT, PRICING, NOTE, PROJECT_SALE, FILE, RETAIL_BRAND_USAGE, MEETING_ATTENDEE, MEETING_EXPENSE, MEETING_GIFT.

The meeting detail reader now prefers `GET /api/meetings/{id}`, normalizes the current DTO's attendee and employee fields, and updates counts/totals using active items. A read-only fallback to the legacy meeting detail route is retained for 404/405 responses. Authorization failures do not trigger this fallback. Existing unrelated meeting write routes have not been migrated in this change.

## Existing controls retained

Customer/group/institution/project/employee archives; expense/document/closed-NC archives; complaint/requirement cancellations; attendance reset and pending correction cancellation; region/PIN/district deactivation; team/member removal; target deactivation; attendance-rule deactivation; retail/institution sale voiding; meeting cancellation.

These older contracts retain their existing rules and do not all write events into the new admin removal-history system. In particular, reimbursed expenses, accepted approval evidence, unresolved NCs and completed tasks remain protected.

## Remaining separate backend questions

- There is no new delete contract for visit-only pros and cons. The supplied brand endpoint removes the whole account-brand usage. It must not be called with a locally generated insight ID.
- The legacy meeting configuration APIs (meeting types, gift items, expense heads) still need confirmation if those catalogs remain editable.
- The Enquiries screen's `/enquiry/filtered` service and deletion semantics remain unconfirmed.
- Deployment of the supplied 11 routes remains backend-team work. Live verification is pending that deployment.

## Validation approach

- Automated requests and browser checks use mocked backend responses; no production records are removed.
- Contract tests cover all nine POST paths, the exact reason body, bearer headers, the 500-character limit, permission rules, both history GET routes, backend errors without fallback/retry, and normalization of active meeting items/totals.
- Browser checks exercise reason confirmation, dismissing without mutation, linked-record errors, refreshes, role visibility and history views.
- The repository already has unrelated legacy test failures and `no-explicit-any` lint errors. Compare against the unchanged base rather than treating those as failures introduced by this feature.
