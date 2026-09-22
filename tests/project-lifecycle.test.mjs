import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const projectsApi = read('lib/projects-api.ts');
const detailPage = read('app/dashboard/projects/[id]/page.tsx');
const listPage = read('app/dashboard/projects/page.tsx');
const modalSource = read('components/AddProjectModal.tsx');

describe('Project lifecycle - API contracts', () => {
  it('VALID_STAGE_TRANSITIONS defines all 10 statuses', () => {
    const statuses = [
      'NOT_STARTED', 'CREDENTIALS_SUBMITTED_TO_CONTRACTOR', 'FORWARDED_TO_CONSULTANT',
      'UNDER_REVIEW', 'TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'NC_CLOSURE_SUBMITTED',
      'SOURCE_APPROVED', 'PROJECT_COMPLETED', 'REJECTED',
    ];
    for (const s of statuses) {
      assert.ok(
        new RegExp(`${s}:\\s*\\[`).test(projectsApi),
        `VALID_STAGE_TRANSITIONS has key ${s}`
      );
    }
  });

  it('VALID_STAGE_TRANSITIONS enforces correct flow', () => {
    assert.ok(
      /NOT_STARTED:\s*\['CREDENTIALS_SUBMITTED_TO_CONTRACTOR',\s*'FORWARDED_TO_CONSULTANT',\s*'REJECTED'\]/.test(projectsApi),
      'NOT_STARTED allows CREDENTIALS_SUBMITTED_TO_CONTRACTOR, FORWARDED_TO_CONSULTANT, REJECTED'
    );
    assert.ok(
      /NC_RAISED:\s*\['NC_CLOSURE_SUBMITTED'\]/.test(projectsApi),
      'NC_RAISED only allows NC_CLOSURE_SUBMITTED'
    );
    assert.ok(
      /SOURCE_APPROVED:\s*\['PROJECT_COMPLETED'\]/.test(projectsApi),
      'SOURCE_APPROVED only allows PROJECT_COMPLETED'
    );
    assert.ok(
      /PROJECT_COMPLETED:\s*\[\]/.test(projectsApi),
      'PROJECT_COMPLETED is terminal'
    );
    assert.ok(
      /REJECTED:\s*\['NOT_STARTED'\]/.test(projectsApi),
      'REJECTED can restart to NOT_STARTED'
    );
  });

  it('ProjectStage includes NC_RAISED and NC_CLOSURE_SUBMITTED', () => {
    assert.ok(projectsApi.includes("'NC_RAISED'"), 'ProjectStage includes NC_RAISED');
    assert.ok(projectsApi.includes("'NC_CLOSURE_SUBMITTED'"), 'ProjectStage includes NC_CLOSURE_SUBMITTED');
  });

  it('CRUD endpoints use documented paths', () => {
    assert.ok(/\/api\/projects/.test(projectsApi), 'list/create uses /api/projects');
    assert.ok(/\/api\/projects\/\$\{id\}/.test(projectsApi), 'GET/PUT/DELETE uses /api/projects/{id}');
    assert.ok(/method:\s*'DELETE'/.test(projectsApi), 'DELETE method used for deactivation');
    assert.ok(/\/api\/projects\/\$\{id\}\/advance-stage/.test(projectsApi), 'advance-stage endpoint exists');
  });

  it('NC endpoints use documented paths', () => {
    assert.ok(/\/api\/projects\/nc/.test(projectsApi), 'NC create uses /api/projects/nc');
    assert.ok(/\/api\/projects\/nc\/\$\{ncId\}/.test(projectsApi), 'NC update uses /api/projects/nc/{ncId}');
    assert.ok(/\/api\/projects\/\$\{projectId\}\/nc/.test(projectsApi), 'NC list uses /api/projects/{projectId}/nc');
  });

  it('sub-resource endpoints use documented paths', () => {
    assert.ok(/\/api\/projects\/\$\{projectId\}\/parties/.test(projectsApi), 'parties endpoint');
    assert.ok(/\/api\/projects\/\$\{projectId\}\/pipeline/.test(projectsApi), 'pipeline endpoint');
    assert.ok(/\/api\/projects\/\$\{projectId\}\/approval-history/.test(projectsApi), 'approval-history endpoint');
    assert.ok(/\/api\/projects\/\$\{projectId\}\/contacts/.test(projectsApi), 'contacts endpoint');
    assert.ok(/\/api\/common\/projects\/\$\{projectId\}\/notes/.test(projectsApi), 'notes endpoint');
    assert.ok(/\/api\/common\/projects\/\$\{projectId\}\/documents/.test(projectsApi), 'documents endpoint');
    assert.ok(/\/api\/tasks/.test(projectsApi), 'tasks endpoint');
  });

  it('notes use parentType PROJECT', () => {
    assert.ok(/parentType:\s*'PROJECT'/.test(projectsApi), 'notes payload includes parentType PROJECT');
  });

  it('tasks are fetched per employee with status deduplication', () => {
    assert.ok(
      /assignedEmployeeId=\$\{employeeId\}&status=\$\{status\}/.test(projectsApi),
      'tasks filtered by employeeId and status'
    );
    assert.ok(
      /new Map\(tasks\.map\(.*\[task\.id,\s*task\]\)/.test(projectsApi),
      'tasks deduplicated by id'
    );
  });

  it('getProjectById uses optimistic direct GET with paginated fallback', () => {
    assert.ok(
      /\/api\/projects\/\$\{id\}/.test(projectsApi),
      'tries direct GET first'
    );
    assert.ok(
      /getProjects\(token,\s*\{\s*page:\s*0,\s*size:\s*500\s*\}\)/.test(projectsApi),
      'falls back to paginated scan'
    );
  });
});

describe('Project lifecycle - detail page guards', () => {
  it('blocks approval when open NCs exist', () => {
    assert.ok(
      /hasOpenNc.*Cannot approve|Cannot approve.*hasOpenNc/s.test(detailPage),
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
    assert.ok(/TabsTrigger.*value="parties"/.test(detailPage), 'Parties tab');
    assert.ok(/TabsTrigger.*value="contacts"/.test(detailPage), 'Contacts tab');
    assert.ok(/TabsTrigger.*value="notes"/.test(detailPage), 'Notes tab');
    assert.ok(/TabsTrigger.*value="documents"/.test(detailPage), 'Documents tab');
    assert.ok(/TabsTrigger.*value="tasks"/.test(detailPage), 'Tasks tab');
  });

  it('edit dialog uses string-typed draft with number conversion on save', () => {
    assert.ok(
      /ProjectEditDraft/.test(detailPage),
      'defines ProjectEditDraft type for form state'
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
    assert.ok(/Edit project/.test(detailPage), 'edit dialog title');
    assert.ok(/Deactivate this project/.test(detailPage), 'deactivate dialog title');
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

describe('Project lifecycle - list page status coverage', () => {
  it('list page status filter covers all 10 statuses', () => {
    const statuses = [
      'NOT_STARTED', 'CREDENTIALS_SUBMITTED_TO_CONTRACTOR', 'FORWARDED_TO_CONSULTANT',
      'UNDER_REVIEW', 'TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'NC_CLOSURE_SUBMITTED',
      'SOURCE_APPROVED', 'PROJECT_COMPLETED', 'REJECTED',
    ];
    for (const s of statuses) {
      assert.ok(
        listPage.includes(`'${s}'`),
        `list page includes status filter for ${s}`
      );
    }
  });

  it('list page status badge styling covers all statuses', () => {
    assert.ok(/SOURCE_APPROVED.*emerald|emerald.*SOURCE_APPROVED/.test(listPage), 'SOURCE_APPROVED uses emerald styling');
    assert.ok(/NC_RAISED.*orange|orange.*NC_RAISED/.test(listPage), 'NC_RAISED uses orange styling');
    assert.ok(/REJECTED.*rose|rose.*REJECTED/.test(listPage), 'REJECTED uses rose styling');
    assert.ok(/stageClassName/.test(listPage), 'has stageClassName helper');
  });
});

describe('Project lifecycle - modal create flow', () => {
  it('create modal includes all 10 project stages', () => {
    const stages = [
      'NOT_STARTED', 'CREDENTIALS_SUBMITTED_TO_CONTRACTOR', 'FORWARDED_TO_CONSULTANT',
      'UNDER_REVIEW', 'TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'NC_CLOSURE_SUBMITTED',
      'SOURCE_APPROVED', 'PROJECT_COMPLETED', 'REJECTED',
    ];
    for (const s of stages) {
      assert.ok(
        modalSource.includes(`'${s}'`),
        `modal includes stage option ${s}`
      );
    }
  });

  it('create modal navigates to detail page after success', () => {
    assert.ok(
      /router\.push\(`\/dashboard\/projects\/\$\{id\}`\)/.test(modalSource),
      'navigates to /dashboard/projects/{id}'
    );
  });

  it('create modal validates required fields', () => {
    assert.ok(/projectName.*required/.test(modalSource), 'validates projectName');
    assert.ok(/locationText.*required/.test(modalSource), 'validates locationText');
    assert.ok(/state.*required/.test(modalSource), 'validates state');
  });

  it('create modal uses unsaved-changes guard', () => {
    assert.ok(/useUnsavedChanges/.test(modalSource), 'uses useUnsavedChanges hook');
  });
});
