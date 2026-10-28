# Admin removal controls — frontend handoff

Implemented against the backend checkout at `fcb948e` (28 October 2026).
No backend code or production records were changed.

## Pages changed

| Web page | Changes |
| --- | --- |
| `/dashboard/customers` | Existing archive control is restricted to admin web accounts. |
| `/dashboard/customers/[id]` | Added confirmed retail sale voiding with a required correction reason, secondary-assignment removal, and store-image removal. Contact, brand, and task removals use confirmation modals. Voided sales are excluded from active sale totals. |
| `/dashboard/groups` | Existing group archive control is restricted to admins; its confirmation remains. |
| `/dashboard/institutions` | Added archive directly to each list row. |
| `/dashboard/institutions/[id]` | Added document archiving, contact-link removal, and closed-NC archiving. Task cancellations use the shared modal. Existing institution archive and sale-void actions are restricted to admins. |
| `/dashboard/projects` | Added archive directly to each list row. |
| `/dashboard/projects/[id]` | Added document and closed-NC archiving. Party removal and task cancellation use the shared modal; existing project/contact removals are restricted to admins. |
| `/dashboard/expenses` | Added confirmed expense archiving in card and table views. Reimbursed claims are disabled; server errors remain visible. |
| `/dashboard/documents` | Added document archive confirmation. Backend protects accepted decision evidence. |
| `/dashboard/nc-register` | Added archive for closed issues, with the correct institution/project endpoint. Active-record queries prevent archived issues from reappearing. |
| `/dashboard/approvals` | Added confirmed cancellation of pending attendance correction requests. |
| `/dashboard/attendance` | Added reset-to-absent confirmation inside the selected day's dialog. Approved corrections are protected. |
| `/dashboard/complaints` | Existing delete now opens a modal and is labelled Cancel. Completed/cancelled items cannot be cancelled again. |
| `/dashboard/requirements` | Same cancellation behavior as Complaints. |
| `/dashboard/visits/[id]` | Added cancellation with confirmation for linked complaints/requirements. This does not delete the visit. |
| `/dashboard/employees` | Existing employee archive is restricted to admins, with corrected confirmation wording. Removed the preceding team mutation so failed archival cannot partially unassign an employee. |
| `/dashboard/regions` | Region/PIN removals are restricted to admins. Added confirmed district deactivation inside Region Details. |
| `/dashboard/settings` → Teams | Existing team/member removal confirmations are restricted to admins. |
| `/dashboard/settings` → Working Days | Deactivating an attendance rule requires confirmation. Managers can still edit counts, but cannot deactivate rules. |
| `/dashboard/settings` → Targets and `/dashboard/settings/target` | Target deactivation uses a modal; clearing saved monthly targets also requires confirmation. |
| `/dashboard/meetings/[id]` | Existing cancellation confirmation is admin-only; cancellation now uses `POST /api/meetings/{id}/cancel`. Other legacy meeting API integration remains separate work. |

Shared new actions wait for confirmation, block repeat submission, include the bearer token, keep backend errors visible, and refresh affected data after success. They do not automatically retry destructive requests. The backend remains responsible for enforcing authorization; several current backend endpoints also permit managers.

## New backend calls still required

The following endpoint names are proposals to agree with the backend team, not implemented contracts:

| Proposed contract | Used by | Required behavior |
| --- | --- | --- |
| `DELETE /api/common/visits/{visitId}` (or an agreed cancel/invalidate action) | Visit list/details; customer, institution, project and employee visit history | Preserve execution evidence; define planned cancellation versus completed-visit invalidation and effects on attendance, allowances, expenses, targets and reports. |
| `DELETE /api/retail/pricing/{pricingId}` | Pricing | Mark the observation inactive and exclude it from current averages/summaries. |
| `DELETE /api/common/notes/{noteId}` | Visit/customer/institution/project notes and other supported note parents | Archive the note while preserving revisions and relationships. The existing visit-note delete button currently targets this missing contract. |
| `POST /api/projects/sales/{saleId}/void` | Project Details → Sales | Match retail/institution sale voiding; require `correctionReason`, record actor/time, and exclude voided sales from relevant totals. |

## Additional contracts requiring agreement

- **Individual attachments:** propose `DELETE /api/hr/files/{fileId}` if admins must remove visit photos, task attachments, receipts or note files individually. Define protected evidence and physical-file retention. Document archive already exists separately.
- **Visit brands/pros and cons:** agree the supported record model and persisted removal route. The legacy visit-brand deletion only changes local screen state; do not treat it as a completed server deletion.
- **Meeting attendees/gifts/expense lines:** the new backend supports list replacement during draft/execution/report operations, while the web still contains older per-item `/meeting/.../delete` calls. Agree whether to migrate to list replacement or add dedicated item endpoints; do not invent additional DELETE calls unnecessarily.
- **Meeting configuration:** legacy web calls exist for deleting meeting types, gift items and expense heads; equivalent configuration controllers are absent from this checkout. Confirm whether those catalogs are still required.
- **Enquiries:** the web uses `/enquiry/filtered`, which is absent from this backend. Identify the owning service and whether rows are stored enquiries or calculated summaries before defining deletion.

Existing expense/document/NC/task/attendance protections remain in force. Removing reimbursed expenses, accepted approval evidence, unresolved NCs or completed tasks would require a separately agreed correction workflow, not merely another frontend button.

## Validation

- TypeScript check and production build passed.
- Focused authentication, removal, expense-review and approval tests: 20 passed.
- Mocked browser checks: modal dismissal issues no request; protected-record errors remain visible; successful archive refreshes; sale voiding requires a reason; managers cannot see new controls; mobile modal fits the viewport.
- Full suite: 327 passed, 41 failed. An unchanged checkout of HEAD has the same 41 failures (322 passed before the five new tests).
- Full lint: 46 existing `no-explicit-any` errors, reproduced on unchanged HEAD. No additional lint errors were introduced.
- Browser tests intercepted backend requests; no production records were deleted.
