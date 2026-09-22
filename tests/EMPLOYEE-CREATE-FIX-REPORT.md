# Employee Create Form Fix — Implementation Report

**Date:** 2026-09-10  
**Files modified:** `components/employee-form-wizard.tsx`  
**Files created:** `tests/employee-create.test.mjs`

---

## Problem

The employee create form at `/dashboard/employees/add` had several issues:
1. **Wrong payload fields** — sent `primaryContact`, `secondaryContact`, `departmentName`, `employeeId` instead of documented `mobile`, `secondaryMobile`, `department`
2. **Wrong role mapping** — mapped roles to `Office Manager` instead of documented `MANAGER`/`RETAIL_FE`
3. **Missing navigation** — navigated to list (`/dashboard/employees`) after create instead of detail page (`/dashboard/employees/{id}`)
4. **Employee ID suggestion** — tried to auto-suggest employee IDs, but the API generates them
5. **Unused imports/functions** — `employeeIdExists`, `suggestEmployeeId`, `syncAssignedCities` were dead code

---

## Changes Made

### `components/employee-form-wizard.tsx`

**State interface** (`NewEmployeeState`):
- Removed `employeeId: string` (API generates this)
- Renamed `primaryContact` → `mobile`
- Renamed `secondaryContact` → `secondaryMobile`
- Renamed `departmentName` → `department`

**Initial state** (`initialNewEmployeeState`):
- Updated to match new field names
- Removed `employeeId: ""`

**`mapEmployeeDtoToState`**:
- Updated to map `employee.primaryContact` → `mobile`, `employee.secondaryContact` → `secondaryMobile`, `employee.departmentName` → `department`

**Removed dead code**:
- Removed `employeeIdExists` import
- Removed `suggestEmployeeId` import
- Removed employee ID suggestion `useEffect` (API generates IDs)
- Removed `syncAssignedCities` function (city assignment now uses `regionIds` via PUT update)
- Removed `isSuggestingId` state variable

**Validation**:
- Renamed `primaryContactError` → `mobileError`
- Renamed `secondaryContactError` → `secondaryMobileError`
- Updated `formIsValid` to check `newEmployee.mobile.length === 10` and `!mobileError`

**Submit handler** (`handleSubmit`):
- **Create payload** now uses documented fields: `firstName`, `lastName`, `mobile`, `secondaryMobile`, `department`, `email`, `role`, `username`, `password`, `userRole`
- **Role mapping**: `Field Officer` → `RETAIL_FE`, `Manager`/`Regional Manager` → `MANAGER`
- **userRole**: `MANAGER` → `MANAGER`, others → `EMPLOYEE`
- **Navigation after create**: `router.push('/dashboard/employees/${createdId}')` (detail page)
- Removed employee ID existence check (API handles uniqueness)
- Removed `syncAssignedCities` call from create flow

**Form inputs**:
- Updated `name` attributes: `mobile`, `secondaryMobile`
- Updated `id` attributes: `mobile`, `secondaryMobile`
- Updated labels: "Mobile", "Secondary Mobile"
- Department `<Select>` now uses `newEmployee.department`

### `tests/employee-create.test.mjs` (new, 22 tests)

Tests covering:
- Documented contract compliance (`POST /api/auth/employees-with-credentials`)
- Payload field mapping (`mobile`, `secondaryMobile`, `department`)
- Role values (`RETAIL_FE`, `MANAGER`)
- Navigation to detail page after success
- State interface alignment with form inputs
- Mobile validation (10 digits)
- Fresh defaults on each mount
- No legacy endpoints or dead imports
- Error/loading/success states
- Add page route renders correctly

---

## Verification

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | Clean |
| ESLint | Clean |
| Employee create tests (22) | All pass |
| Employee edit legacy tests (3) | All pass |
| Full test suite (263) | All pass |

---

## What's Not Covered (Backend Gaps)

- **Employee detail GET** — `GET /api/common/employees/{id}` is not documented; form uses filtered lookup as workaround
- **City assignment** — legacy `/employee/assignCity` removed; new contract uses `regionIds` via PUT update
- **Credentials update** — `PUT /api/auth/users/{userId}/credentials` requires `userId` which may differ from `employeeId`
- **Optional payload fields** — `managerId`, `teamId`, `designationId`, `regionIds`, `houseLatitude`, `houseLongitude`, `officeManager`, `travelAllowance`, `dearnessAllowance`, `fullMonthSalary` are not in the current form (documented but not implemented yet)
