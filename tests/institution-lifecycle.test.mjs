import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const institutionsApi = read('lib/institutions-api.ts');
const detailPage = read('app/dashboard/institutions/[id]/page.tsx');
const listPage = read('app/dashboard/institutions/page.tsx');
const modalSource = read('components/AddInstitutionModal.tsx');

describe('Institution lifecycle - API contracts', () => {
  it('VALID_STAGE_TRANSITIONS defines all 12 statuses', () => {
    const statuses = [
      'NOT_STARTED', 'CREDENTIALS_SUBMITTED', 'DOCUMENTS_SUBMITTED', 'UNDER_REVIEW',
      'TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'NC_CLOSURE_SUBMITTED',
      'APPROVED', 'RENEWAL_DUE', 'EXPIRED', 'REJECTED', 'SUSPENDED',
    ];
    for (const s of statuses) {
      assert.ok(
        new RegExp(`${s}:\\s*\\[`).test(institutionsApi),
        `VALID_STAGE_TRANSITIONS has key ${s}`
      );
    }
  });

  it('VALID_STAGE_TRANSITIONS rejects invalid transitions', () => {
    assert.ok(
      /NOT_STARTED:\s*\['CREDENTIALS_SUBMITTED',\s*'DOCUMENTS_SUBMITTED'\]/.test(institutionsApi),
      'NOT_STARTED only allows CREDENTIALS_SUBMITTED and DOCUMENTS_SUBMITTED'
    );
    assert.ok(
      /NC_RAISED:\s*\['NC_CLOSURE_SUBMITTED'\]/.test(institutionsApi),
      'NC_RAISED only allows NC_CLOSURE_SUBMITTED'
    );
    assert.ok(
      /APPROVED:\s*\['RENEWAL_DUE'\]/.test(institutionsApi),
      'APPROVED only allows RENEWAL_DUE'
    );
  });

  it('EmpanelmentStatus includes all 12 statuses', () => {
    const statuses = [
      'NOT_STARTED', 'CREDENTIALS_SUBMITTED', 'DOCUMENTS_SUBMITTED', 'UNDER_REVIEW',
      'TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'NC_CLOSURE_SUBMITTED',
      'APPROVED', 'RENEWAL_DUE', 'EXPIRED', 'REJECTED', 'SUSPENDED',
    ];
    for (const s of statuses) {
      assert.ok(institutionsApi.includes(`'${s}'`), `EmpanelmentStatus includes ${s}`);
    }
  });

  it('CRUD endpoints use documented paths', () => {
    assert.ok(/\/api\/empanelment\/institutions/.test(institutionsApi), 'list/create uses /api/empanelment/institutions');
    assert.ok(/\/api\/empanelment\/institutions\/\$\{id\}/.test(institutionsApi), 'GET/PUT/DELETE uses /api/empanelment/institutions/{id}');
    assert.ok(/method:\s*'DELETE'/.test(institutionsApi), 'DELETE method used for deactivation');
    assert.ok(/\/api\/empanelment\/institutions\/\$\{id\}\/advance-stage/.test(institutionsApi), 'advance-stage endpoint exists');
  });

  it('sub-resource endpoints use documented paths', () => {
    assert.ok(/\/api\/empanelment\/institutions\/\$\{id\}\/pipeline/.test(institutionsApi), 'pipeline endpoint');
    assert.ok(/\/api\/empanelment\/institutions\/\$\{id\}\/approval-history/.test(institutionsApi), 'approval-history endpoint');
    assert.ok(/\/api\/empanelment\/institutions\/\$\{id\}\/contacts/.test(institutionsApi), 'contacts endpoint');
    assert.ok(/\/api\/empanelment\/institutions\/\$\{id\}\/nc/.test(institutionsApi), 'nc endpoint');
    assert.ok(/\/api\/empanelment\/nc/.test(institutionsApi), 'NC create/update uses /api/empanelment/nc');
    assert.ok(/\/api\/common\/institutions\/\$\{institutionId\}\/notes/.test(institutionsApi), 'notes endpoint');
    assert.ok(/\/api\/common\/notes/.test(institutionsApi), 'notes create/update uses /api/common/notes');
    assert.ok(/\/api\/tasks/.test(institutionsApi), 'tasks endpoint');
  });

  it('getInstitutionById uses optimistic direct GET with paginated fallback', () => {
    assert.ok(
      /\/api\/empanelment\/institutions\/\$\{id\}/.test(institutionsApi),
      'tries direct GET first'
    );
    assert.ok(
      /getInstitutions\(token,\s*\{\s*page:\s*0,\s*size:\s*500\s*\}\)/.test(institutionsApi),
      'falls back to paginated scan'
    );
    assert.ok(
      /for\s*\(\s*let\s+page\s*=\s*1/.test(institutionsApi),
      'iterates remaining pages'
    );
  });

  it('NC register has status transitions: OPEN -> SUBMITTED -> CLOSED', () => {
    assert.ok(
      /nc\.status === 'OPEN'.*Mark Submitted|Mark Submitted.*nc\.status === 'OPEN'/s.test(detailPage),
      'OPEN NC shows Mark Submitted button'
    );
    assert.ok(
      /nc\.status === 'SUBMITTED'.*Mark Closed|Mark Closed.*nc\.status === 'SUBMITTED'/s.test(detailPage),
      'SUBMITTED NC shows Mark Closed button'
    );
  });
});

describe('Institution lifecycle - detail page guards', () => {
  it('blocks approval when open NCs exist', () => {
    assert.ok(
      /hasOpenNc.*Cannot approve with open NCs|Cannot approve with open NCs.*hasOpenNc/s.test(detailPage),
      'error message for approval with open NCs'
    );
    assert.ok(
      /openNcCount.*block approval|block approval.*openNcCount/s.test(detailPage),
      'warning banner mentions open NCs blocking approval'
    );
  });

  it('enforces NC_RAISED -> NC_CLOSURE_SUBMITTED transition', () => {
    assert.ok(
      /NC_RAISED.*NC_CLOSURE_SUBMITTED|After NC_RAISED.*NC_CLOSURE_SUBMITTED/s.test(detailPage),
      'NC_RAISED requires NC_CLOSURE_SUBMITTED next'
    );
  });

  it('validates allowed transitions against VALID_STAGE_TRANSITIONS', () => {
    assert.ok(
      /allowedNextStatuses/.test(detailPage),
      'computes allowed next statuses from VALID_STAGE_TRANSITIONS'
    );
    assert.ok(
      /Invalid transition from/.test(detailPage),
      'shows error for invalid transitions'
    );
  });

  it('has tabs for all sub-resources', () => {
    assert.ok(/TabsTrigger.*value="overview"/.test(detailPage), 'Overview tab');
    assert.ok(/TabsTrigger.*value="pipeline"/.test(detailPage), 'Pipeline tab');
    assert.ok(/TabsTrigger.*value="nc"/.test(detailPage), 'NC Register tab');
    assert.ok(/TabsTrigger.*value="contacts"/.test(detailPage), 'Contacts tab');
    assert.ok(/TabsTrigger.*value="notes"/.test(detailPage), 'Notes tab');
    assert.ok(/TabsTrigger.*value="tasks"/.test(detailPage), 'Tasks tab');
  });

  it('edit dialog uses string-typed draft with number conversion on save', () => {
    assert.ok(
      /InstitutionEditDraft/.test(detailPage),
      'defines InstitutionEditDraft type for form state'
    );
    assert.ok(
      /toNum/.test(detailPage),
      'has toNum helper for converting string form values to number'
    );
  });

  it('implements advance-stage, edit, and deactivate dialogs', () => {
    assert.ok(/advanceOpen/.test(detailPage), 'has advance stage dialog state');
    assert.ok(/editOpen/.test(detailPage), 'has edit dialog state');
    assert.ok(/deleteOpen/.test(detailPage), 'has deactivate dialog state');
    assert.ok(/Advance stage/.test(detailPage), 'advance stage dialog title');
    assert.ok(/Edit institution/.test(detailPage), 'edit dialog title');
    assert.ok(/Deactivate this institution/.test(detailPage), 'deactivate dialog title');
  });

  it('notes use common notes API with parentType INSTITUTION', () => {
    assert.ok(
      /parentType:\s*'INSTITUTION'/.test(institutionsApi),
      'notes payload includes parentType INSTITUTION'
    );
  });

  it('tasks are fetched per employee with status deduplication', () => {
    assert.ok(
      /assignedEmployeeId=\$\{employeeId\}&status=\$\{status\}/.test(institutionsApi),
      'tasks filtered by employeeId and status'
    );
    assert.ok(
      /new Map\(tasks\.map\(.*\[task\.id,\s*task\]\)/.test(institutionsApi),
      'tasks deduplicated by id'
    );
  });
});

describe('Institution lifecycle - list page status coverage', () => {
  it('list page status filter covers all 12 statuses', () => {
    const statuses = [
      'NOT_STARTED', 'CREDENTIALS_SUBMITTED', 'DOCUMENTS_SUBMITTED', 'UNDER_REVIEW',
      'TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'NC_CLOSURE_SUBMITTED',
      'APPROVED', 'RENEWAL_DUE', 'EXPIRED', 'REJECTED', 'SUSPENDED',
    ];
    for (const s of statuses) {
      assert.ok(
        listPage.includes(`'${s}'`),
        `list page includes status filter for ${s}`
      );
    }
  });

  it('list page status badge styling covers all statuses', () => {
    assert.ok(/APPROVED.*emerald|emerald.*APPROVED/.test(listPage), 'APPROVED uses emerald styling');
    assert.ok(/REJECTED.*rose|rose.*REJECTED/.test(listPage), 'REJECTED uses rose styling');
    assert.ok(/NC_RAISED.*orange|orange.*NC_RAISED/.test(listPage), 'NC_RAISED uses orange styling');
    assert.ok(/statusClassName/.test(listPage), 'has statusClassName helper');
  });
});

describe('Institution lifecycle - modal create flow', () => {
  it('create modal includes all 12 empanelment statuses', () => {
    const statuses = [
      'NOT_STARTED', 'CREDENTIALS_SUBMITTED', 'DOCUMENTS_SUBMITTED', 'UNDER_REVIEW',
      'TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'NC_CLOSURE_SUBMITTED',
      'APPROVED', 'RENEWAL_DUE', 'EXPIRED', 'REJECTED', 'SUSPENDED',
    ];
    for (const s of statuses) {
      assert.ok(
        modalSource.includes(`'${s}'`),
        `modal includes status option ${s}`
      );
    }
  });

  it('create modal navigates to detail page after success', () => {
    assert.ok(
      /router\.push\(`\/dashboard\/institutions\/\$\{id\}`\)/.test(modalSource),
      'navigates to /dashboard/institutions/{id}'
    );
  });

  it('create modal validates required fields', () => {
    assert.ok(/institutionName.*required/.test(modalSource), 'validates institutionName');
    assert.ok(/jurisdiction.*required/.test(modalSource), 'validates jurisdiction');
    assert.ok(/state.*required/.test(modalSource), 'validates state');
  });

  it('create modal uses unsaved-changes guard', () => {
    assert.ok(/useUnsavedChanges/.test(modalSource), 'uses useUnsavedChanges hook');
  });
});
