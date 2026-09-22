import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const detailPage = read('app/dashboard/institutions/[id]/page.tsx');
const institutionsApi = read('lib/institutions-api.ts');
const listPage = read('app/dashboard/institutions/page.tsx');

describe('Institution detail', () => {
  it('getInstitutionById uses direct GET with paginated scan fallback', () => {
    assert.ok(
      /\/api\/empanelment\/institutions\/\$\{id\}/.test(institutionsApi),
      'getInstitutionById tries direct GET /api/empanelment/institutions/{id}'
    );
    assert.ok(
      /getInstitutions\(token,\s*\{\s*page:\s*0,\s*size:\s*500\s*\}\)/.test(institutionsApi),
      'getInstitutionById falls back to paginated scan via getInstitutions'
    );
  });

  it('detail page does not import or call legacy institution routes', () => {
    assert.ok(!/\/institution\/getById|\/institution\/detail|\/institution\/get\//.test(detailPage), 'no legacy institution detail routes');
    assert.ok(!/\/institutions\/getById|\/institutions\/detail/.test(detailPage), 'no legacy institutions routes');
  });

  it('detail page does not use gap banner for missing endpoint', () => {
    assert.ok(
      !/institutionLookupGap/.test(detailPage),
      'no institutionLookupGap state (direct GET is implemented)'
    );
    assert.ok(
      !/Direct institution detail endpoint not available/.test(detailPage),
      'no gap banner title'
    );
  });

  it('detail page renders lifecycle vocabulary fields', () => {
    assert.ok(/empanelmentStatus/.test(detailPage), 'renders empanelmentStatus');
    assert.ok(/applicationDate/.test(detailPage), 'renders applicationDate');
    assert.ok(/approvalDate/.test(detailPage), 'renders approvalDate');
    assert.ok(/expiryDate/.test(detailPage), 'renders expiryDate');
    assert.ok(/renewalLeadDays/.test(detailPage), 'renders renewalLeadDays');
  });

  it('detail page renders lifecycle vocabulary labels', () => {
    assert.ok(/Application date/i.test(detailPage), 'Application date label');
    assert.ok(/Approval date/i.test(detailPage), 'Approval date label');
    assert.ok(/Expiry date/i.test(detailPage), 'Expiry date label');
    assert.ok(/Renewal lead days/i.test(detailPage), 'Renewal lead days label');
    assert.ok(/Lifecycle dates/.test(detailPage), 'Lifecycle dates section heading');
  });

  it('detail page preserves loading and error states', () => {
    assert.ok(/isLoading/.test(detailPage), 'has loading state');
    assert.ok(/Loader2/.test(detailPage), 'uses Loader2 spinner for loading');
    assert.ok(/Institution not found/.test(detailPage), 'shows not found state');
    assert.ok(/error/.test(detailPage), 'has error state');
  });

  it('detail page preserves permission hooks', () => {
    assert.ok(/useAuth/.test(detailPage), 'uses useAuth');
    assert.ok(/token/.test(detailPage), 'destructures token from useAuth');
  });

  it('detail page has back navigation to list', () => {
    assert.ok(
      /\/dashboard\/institutions/.test(detailPage),
      'back button navigates to institutions list'
    );
    assert.ok(
      /ArrowLeft/.test(detailPage),
      'back button has ArrowLeft icon'
    );
  });

  it('list page links to detail route /dashboard/institutions/${id}', () => {
    assert.ok(
      /\/dashboard\/institutions\/\$\{/.test(listPage),
      'list page constructs detail links with dynamic id'
    );
  });

  it('detail page implements sub-resource management', () => {
    assert.ok(/contacts/.test(detailPage), 'contacts sub-resource implemented');
    assert.ok(/pipeline/.test(detailPage), 'pipeline sub-resource implemented');
    assert.ok(/advanceStage|advance-stage/.test(detailPage), 'advance-stage sub-resource implemented');
    assert.ok(/ncRegisters|NC Register/.test(detailPage), 'NC register sub-resource implemented');
  });
});
