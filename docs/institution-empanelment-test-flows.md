# Institution Empanelment — Flow Test Notes

Covers Rev02 §3.1 (Institution), §3.4 (Pipeline), §3.5 (NC), §3.6 (Documents), §4 (Visits).
Backend: `EmpanelmentService` transition map + `stage-actions` authority.
Test org: **#10 Pune Municipal Corporation - Water Supply Dept** (created 2026-09-16 via fixed create flow).

## Already covered ✓

- [x] Create (NOT_STARTED forced, 4 backend types, region/assignee dropdowns, no fake statuses)
- [x] Advance payload fix (`nextStage/responsibleEmployeeId/entryDate/outcomeComment`)
- [x] Responsible employee required + prefilled
- [x] NOT_STARTED → CREDENTIALS_SUBMITTED with embedded contact + credentials file + app date (#10 live)
- [x] Pipeline timeline compact + `empanelmentStage` parse fix
- [x] Contacts master join, notes parentType fix, documents list + upload sheet
- [x] CREDENTIALS_SUBMITTED → UNDER_REVIEW (#10 live)

## To test — from UNDER_REVIEW

### Path A — More docs loop (stay UNDER_REVIEW, no stage click)
1. Dept asks for missing doc → Documents → Upload (new Credentials file) → verify versioned list grows.
2. Notes → Add (`asked X, sent Y`) → verify appears without reload flicker.
3. Tasks → Add follow-up with due date → verify targeted reload.
4. Advance sheet → Target stays UNDER_REVIEW → confirm backend rejects same-stage (expected error, no crash).

### Path B — Technical visit
1. Advance UNDER_REVIEW → TECHNICAL_VISIT_SCHEDULED (remarks = visit date + team).
2. Visits → Plan visit → verify timeline row appears.
3. Confirm Raise NC is now enabled (was gated before).

### Path C — NC loop
1. Raise NC (desc + raised-by + target date) → verify OPEN row + open-NC banner + strip message.
2. Mark Submitted → verify status flips (targeted reload, no full refresh).
3. Advance NC_RAISED → NC_CLOSURE_SUBMITTED only (verify other targets rejected client-side).
4. NC_CLOSURE_SUBMITTED → UNDER_REVIEW (re-review) and → NC_RAISED (rework) both accepted.

### Path D — Direct approval (papers suffice)
1. Upload approval letter scan + confirm zero open NCs → checklist in Advance shows both ✓.
2. Advance → APPROVED → verify validity auto-created, dates set, strip switches to renewal tracking.

### Path E — Rejection + restart
1. Advance → REJECTED with reason → verify terminal messaging.
2. Restart REJECTED → CREDENTIALS_SUBMITTED → verify new cycle behavior.

### Path F — Renewal / expiry (after any APPROVED)
1. Set short expiry + lead days → expect RENEWAL_DUE alert/scheduler flip.
2. Renewal file (Renewal application doc) → re-approve → verify second validity version.
3. Let expiry pass → EXPIRED → restart credentials accepted.
