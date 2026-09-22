import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const modalSource = read('components/AddProjectModal.tsx');
const projectsApi = read('lib/projects-api.ts');
const listPage = read('app/dashboard/projects/page.tsx');

describe('Project create', () => {
  it('lib exposes createProject and ProjectCreatePayload type', () => {
    assert.ok(projectsApi.includes('createProject'), 'lib has createProject method');
    assert.ok(projectsApi.includes('ProjectCreatePayload'), 'lib exports ProjectCreatePayload');
  });

  it('lib uses POST /api/projects via documented endpoint', () => {
    assert.ok(
      /await\s+request\('\/api\/projects',\s*token,\s*\{\s*method:\s*'POST'/.test(projectsApi),
      'createProject calls POST /api/projects'
    );
    assert.ok(!/\/project\/create|\/project\/add|\/projects\/create/.test(projectsApi), 'no legacy create routes');
  });

  it('modal uses ProjectsAPI.createProject', () => {
    assert.ok(/ProjectsAPI\.createProject/.test(modalSource), 'modal calls ProjectsAPI.createProject');
    assert.ok(!/\/project\/create|\/project\/add/.test(modalSource), 'no legacy create routes in modal');
  });

  it('modal imports from projects-api, not retail-api for project types', () => {
    assert.ok(
      /import\s*\{[^}]*ProjectsAPI[^}]*\}\s*from\s+['"]@\/lib\/projects-api['"]/.test(modalSource),
      'modal imports ProjectsAPI from projects-api'
    );
  });

  it('modal validates required fields (projectName, locationText, state)', () => {
    assert.ok(modalSource.includes("draft.projectName.trim())") && modalSource.includes("'Project name is required.'"), 'validates projectName');
    assert.ok(modalSource.includes("draft.locationText.trim())") && modalSource.includes("'Location is required.'"), 'validates locationText');
    assert.ok(modalSource.includes("draft.state.trim())") && modalSource.includes("'State is required.'"), 'validates state');
  });

  it('modal validates at least one contractor/consultant', () => {
    assert.ok(
      /At least one contractor or consultant is required/.test(modalSource),
      'validates minimum one contractor/consultant'
    );
  });

  it('modal validates duplicate contractor names', () => {
    assert.ok(/Duplicate contractor\/consultant names/.test(modalSource), 'validates duplicate contractor names');
  });

  it('modal validates coordinate ranges (latitude -90..90, longitude -180..180)', () => {
    assert.ok(/Latitude must be between -90 and 90/.test(modalSource), 'validates latitude range');
    assert.ok(/Longitude must be between -180 and 180/.test(modalSource), 'validates longitude range');
  });

  it('modal validates completion date not before start date', () => {
    assert.ok(/Completion date cannot be before start date/.test(modalSource), 'validates date order');
  });

  it('modal includes all 8 project lifecycle stages', () => {
    assert.ok(/NOT_STARTED/.test(modalSource), 'stage NOT_STARTED');
    assert.ok(/CREDENTIALS_SUBMITTED_TO_CONTRACTOR/.test(modalSource), 'stage CREDENTIALS_SUBMITTED_TO_CONTRACTOR');
    assert.ok(/FORWARDED_TO_CONSULTANT/.test(modalSource), 'stage FORWARDED_TO_CONSULTANT');
    assert.ok(/UNDER_REVIEW/.test(modalSource), 'stage UNDER_REVIEW');
    assert.ok(/TECHNICAL_VISIT_SCHEDULED/.test(modalSource), 'stage TECHNICAL_VISIT_SCHEDULED');
    assert.ok(/SOURCE_APPROVED/.test(modalSource), 'stage SOURCE_APPROVED');
    assert.ok(/PROJECT_COMPLETED/.test(modalSource), 'stage PROJECT_COMPLETED');
    assert.ok(/REJECTED/.test(modalSource), 'stage REJECTED');
  });

  it('modal includes all 7 project types', () => {
    assert.ok(/ROAD_HIGHWAY/.test(modalSource), 'type ROAD_HIGHWAY');
    assert.ok(/BRIDGE/.test(modalSource), 'type BRIDGE');
    assert.ok(/BUILDING/.test(modalSource), 'type BUILDING');
    assert.ok(/INFRASTRUCTURE/.test(modalSource), 'type INFRASTRUCTURE');
    assert.ok(/INDUSTRIAL/.test(modalSource), 'type INDUSTRIAL');
    assert.ok(/RESIDENTIAL/.test(modalSource), 'type RESIDENTIAL');
    assert.ok(/OTHER/.test(modalSource), 'type OTHER');
  });

  it('modal supports multiple contractors with add/remove', () => {
    assert.ok(/addContractor/.test(modalSource), 'has addContractor function');
    assert.ok(/removeContractor/.test(modalSource), 'has removeContractor function');
    assert.ok(/CONTRACTOR.*CONSULTANT/.test(modalSource), 'role selector has both options');
  });

  it('modal generates fresh unique session ID on each open', () => {
    assert.ok(/formSessionIdRef/.test(modalSource), 'has formSessionIdRef');
    assert.ok(/crypto.*randomUUID|Date\.now\(\)/.test(modalSource), 'generates unique session ID');
  });

  it('modal opens with empty/blank fields (no demo defaults)', () => {
    assert.ok(/createEmptyDraft/.test(modalSource), 'has createEmptyDraft factory');
    assert.ok(/projectName:\s*'',/.test(modalSource), 'projectName starts empty');
    assert.ok(/locationText:\s*'',/.test(modalSource), 'locationText starts empty');
  });

  it('modal uses unsaved-changes guard', () => {
    assert.ok(/useUnsavedChanges/.test(modalSource), 'modal uses useUnsavedChanges');
  });

  it('modal navigates to detail page after creation', () => {
    assert.ok(/\/dashboard\/projects\/\$\{id\}/.test(modalSource), 'navigates to detail route with id');
    assert.ok(/router\.push/.test(modalSource), 'uses router.push for navigation');
  });

  it('list page enables Create button and imports AddProjectModal', () => {
    assert.ok(
      /import\s+AddProjectModal\s+from\s+['"]@\/components\/AddProjectModal['"]/.test(listPage),
      'list imports AddProjectModal'
    );
    assert.ok(
      /onClick=\{\(\)\s*=>\s*setAddOpen\(true\)\}/.test(listPage),
      'Create button wires to setAddOpen'
    );
    assert.ok(!/disabled.*Create flow out of scope/.test(listPage), 'Create button is no longer disabled');
  });

  it('list page links to detail route /dashboard/projects/${id}', () => {
    assert.ok(/\/dashboard\/projects\/\$\{/.test(listPage), 'list constructs detail links');
  });

  it('list page renders lifecycle stage vocabulary in table', () => {
    assert.ok(/PROJECT_STATUSES/.test(listPage), 'has PROJECT_STATUSES constant');
    assert.ok(/sourceApprovalStatus/.test(listPage), 'renders sourceApprovalStatus');
  });

  it('modal payload matches documented contract fields', () => {
    assert.ok(/projectName/.test(modalSource), 'payload has projectName');
    assert.ok(/locationText/.test(modalSource), 'payload has locationText');
    assert.ok(/locationLatitude/.test(modalSource), 'payload has locationLatitude');
    assert.ok(/locationLongitude/.test(modalSource), 'payload has locationLongitude');
    assert.ok(/projectType/.test(modalSource), 'payload has projectType');
    assert.ok(/estimatedTmtMt/.test(modalSource), 'payload has estimatedTmtMt');
    assert.ok(/startDate/.test(modalSource), 'payload has startDate');
    assert.ok(/completionDate/.test(modalSource), 'payload has completionDate');
    assert.ok(/sourceApprovalStatus/.test(modalSource), 'payload has sourceApprovalStatus');
    assert.ok(/approvalLetterReference/.test(modalSource), 'payload has approvalLetterReference');
    assert.ok(/assignedEmployeeId/.test(modalSource), 'payload has assignedEmployeeId');
  });
});
