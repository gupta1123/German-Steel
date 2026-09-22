import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const institutionsPage = read('app/dashboard/institutions/page.tsx');
const institutionsApi = read('lib/institutions-api.ts');
const modalSource = read('components/AddInstitutionModal.tsx');

describe('Institutions create', () => {
  it('page enables Create button and imports AddInstitutionModal', () => {
    assert.ok(
      /import\s+AddInstitutionModal\s+from\s+['"]@\/components\/AddInstitutionModal['"]/.test(institutionsPage),
      'page imports AddInstitutionModal'
    );
    assert.ok(
      /onClick=\{\(\)\s*=>\s*setAddOpen\(true\)\}/.test(institutionsPage),
      'page wires Create button to open modal'
    );
    assert.ok(!/disabled.*Create flow out of scope/.test(institutionsPage), 'Create button is no longer disabled');
  });

  it('lib exposes createInstitution and InstitutionCreatePayload type', () => {
    assert.ok(institutionsApi.includes('createInstitution'), 'lib has createInstitution method');
    assert.ok(institutionsApi.includes('InstitutionCreatePayload'), 'lib exports InstitutionCreatePayload');
  });

  it('lib exports InstitutionType and EmpanelmentStatus lifecycle vocabulary types', () => {
    assert.ok(
      /export\s+type\s+InstitutionType/.test(institutionsApi),
      'lib exports InstitutionType'
    );
    assert.ok(
      /export\s+type\s+EmpanelmentStatus/.test(institutionsApi),
      'lib exports EmpanelmentStatus'
    );
    assert.ok(
      /GOVERNMENT_DEPARTMENT/.test(institutionsApi),
      'InstitutionType includes GOVERNMENT_DEPARTMENT'
    );
    assert.ok(
      /NOT_STARTED/.test(institutionsApi),
      'EmpanelmentStatus includes NOT_STARTED'
    );
  });

  it('modal imports from institutions-api, not only retail-api', () => {
    assert.ok(
      /import\s*\{[^}]*InstitutionsAPI[^}]*\}\s*from\s+['"]@\/lib\/institutions-api['"]/.test(modalSource),
      'modal imports InstitutionsAPI from institutions-api'
    );
    assert.ok(
      /import\s+(type\s+)?\{[^}]*RetailEmployee[^}]*\}\s*from\s+['"]@\/lib\/retail-api['"]/.test(modalSource),
      'modal imports RetailEmployee type from retail-api for employees'
    );
  });

  it('modal uses POST /api/empanelment/institutions via InstitutionsAPI.createInstitution', () => {
    assert.ok(
      /InstitutionsAPI\.createInstitution/.test(modalSource),
      'modal calls InstitutionsAPI.createInstitution'
    );
    assert.ok(!/\/store\/create|\/customer\/create|\/client\/create/.test(modalSource), 'no legacy create routes');
  });

  it('modal validates required fields (institutionName, jurisdiction, state)', () => {
    assert.ok(
      /draft\.institutionName\.trim\(\)\).*push\('Institution name is required\./.test(modalSource),
      'validates institutionName'
    );
    assert.ok(
      /draft\.jurisdiction\.trim\(\)\).*push\('Jurisdiction is required\./.test(modalSource),
      'validates jurisdiction'
    );
    assert.ok(
      /draft\.state\.trim\(\)\).*push\('State is required\./.test(modalSource),
      'validates state'
    );
  });

  it('modal includes lifecycle vocabulary selects for institutionType and empanelmentStatus', () => {
    assert.ok(modalSource.includes('GOVERNMENT_DEPARTMENT'), 'institutionType has GOVERNMENT_DEPARTMENT');
    assert.ok(modalSource.includes('PRIVATE_INSTITUTION'), 'institutionType has PRIVATE_INSTITUTION');
    assert.ok(modalSource.includes('NOT_STARTED'), 'empanelmentStatus has NOT_STARTED');
    assert.ok(modalSource.includes('UNDER_REVIEW'), 'empanelmentStatus has UNDER_REVIEW');
    assert.ok(modalSource.includes('APPROVED'), 'empanelmentStatus has APPROVED');
  });

  it('modal navigates to detail page after creation', () => {
    assert.ok(
      /\/dashboard\/institutions\/\$\{id\}/.test(modalSource),
      'post-creation navigates to detail route with id'
    );
    assert.ok(
      /router\.push/.test(modalSource),
      'uses router.push for navigation'
    );
  });

  it('modal uses unsaved-changes guard', () => {
    assert.ok(
      /useUnsavedChanges/.test(modalSource),
      'modal uses useUnsavedChanges'
    );
  });

  it('institutions-api normalizes GET /api/empanelment/institutions correctly', () => {
    assert.ok(
      /\/api\/empanelment\/institutions\$\{queryString/.test(institutionsApi),
      'lib targets documented endpoint with queryString'
    );
    assert.ok(
      /getInstitutions\(token,\s*\{\s*page:\s*0,\s*size:\s*500\s*\}\)/.test(institutionsApi),
      'getInstitutionById uses paginated scan via getInstitutions'
    );
  });
});
