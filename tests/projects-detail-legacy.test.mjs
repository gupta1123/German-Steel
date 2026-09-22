import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const detailPage = read('app/dashboard/projects/[id]/page.tsx');
const projectsApi = read('lib/projects-api.ts');
const listPage = read('app/dashboard/projects/page.tsx');

describe('Project detail', () => {
  it('getProjectById uses direct GET with paginated scan fallback', () => {
    assert.ok(
      /\/api\/projects\/\$\{id\}/.test(projectsApi),
      'getProjectById tries direct GET /api/projects/{id}'
    );
    assert.ok(
      /getProjects\(token,\s*\{\s*page:\s*0,\s*size:\s*500\s*\}\)/.test(projectsApi),
      'getProjectById falls back to paginated scan'
    );
  });

  it('detail page does not import or call legacy project routes', () => {
    assert.ok(!/\/project\/getById|\/project\/detail|\/project\/get\//.test(detailPage), 'no legacy project detail routes');
    assert.ok(!/\/projects\/getById|\/projects\/detail/.test(detailPage), 'no legacy projects routes');
  });

  it('detail page does not use gap banner for missing endpoint', () => {
    assert.ok(!/projectLookupGap/.test(detailPage), 'no projectLookupGap state (direct GET is implemented)');
    assert.ok(!/Direct project detail endpoint not available/.test(detailPage), 'no gap banner title');
  });

  it('detail page renders lifecycle vocabulary fields', () => {
    assert.ok(/sourceApprovalStatus/.test(detailPage), 'renders sourceApprovalStatus');
    assert.ok(/projectType/.test(detailPage), 'renders projectType');
    assert.ok(/estimatedTmtMt/.test(detailPage), 'renders estimatedTmtMt');
  });

  it('detail page renders lifecycle stage labels', () => {
    assert.ok(/NOT_STARTED/.test(detailPage), 'stage NOT_STARTED');
    assert.ok(/CREDENTIALS_SUBMITTED_TO_CONTRACTOR/.test(detailPage), 'stage CREDENTIALS_SUBMITTED_TO_CONTRACTOR');
    assert.ok(/FORWARDED_TO_CONSULTANT/.test(detailPage), 'stage FORWARDED_TO_CONSULTANT');
    assert.ok(/UNDER_REVIEW/.test(detailPage), 'stage UNDER_REVIEW');
    assert.ok(/TECHNICAL_VISIT_SCHEDULED/.test(detailPage), 'stage TECHNICAL_VISIT_SCHEDULED');
    assert.ok(/SOURCE_APPROVED/.test(detailPage), 'stage SOURCE_APPROVED');
    assert.ok(/PROJECT_COMPLETED/.test(detailPage), 'stage PROJECT_COMPLETED');
    assert.ok(/REJECTED/.test(detailPage), 'stage REJECTED');
  });

  it('detail page preserves loading and error states', () => {
    assert.ok(/isLoading/.test(detailPage), 'has loading state');
    assert.ok(/Loader2/.test(detailPage), 'uses Loader2 spinner for loading');
    assert.ok(/Project not found/.test(detailPage), 'shows not found state');
    assert.ok(/error/.test(detailPage), 'has error state');
  });

  it('detail page preserves permission hooks', () => {
    assert.ok(/useAuth/.test(detailPage), 'uses useAuth');
    assert.ok(/token/.test(detailPage), 'destructures token from useAuth');
  });

  it('detail page has back navigation to list', () => {
    assert.ok(/\/dashboard\/projects/.test(detailPage), 'back button navigates to projects list');
    assert.ok(/ArrowLeft/.test(detailPage), 'back button has ArrowLeft icon');
  });

  it('list page links to detail route /dashboard/projects/${id}', () => {
    assert.ok(/\/dashboard\/projects\/\$\{/.test(listPage), 'list constructs detail links');
  });

  it('lib exposes sub-resource methods for parties, pipeline, approval-history, nc', () => {
    assert.ok(/getProjectParties/.test(projectsApi), 'has getProjectParties');
    assert.ok(/getProjectPipeline/.test(projectsApi), 'has getProjectPipeline');
    assert.ok(/getProjectApprovalHistory/.test(projectsApi), 'has getProjectApprovalHistory');
    assert.ok(/getProjectNc/.test(projectsApi), 'has getProjectNc');
  });

  it('sub-resource methods use documented endpoints', () => {
    assert.ok(/\/api\/projects\/\$\{projectId\}\/parties/.test(projectsApi), 'parties endpoint');
    assert.ok(/\/api\/projects\/\$\{projectId\}\/pipeline/.test(projectsApi), 'pipeline endpoint');
    assert.ok(/\/api\/projects\/\$\{projectId\}\/approval-history/.test(projectsApi), 'approval-history endpoint');
    assert.ok(/\/api\/projects\/\$\{projectId\}\/nc/.test(projectsApi), 'nc endpoint');
  });

  it('detail page renders parties, pipeline, nc sections', () => {
    assert.ok(/Parties/.test(detailPage), 'Parties section heading');
    assert.ok(/Pipeline/.test(detailPage), 'Pipeline section heading');
    assert.ok(/NC Register/.test(detailPage), 'NC Register section heading');
  });

  it('detail page implements sub-resource management', () => {
    assert.ok(/NC Register/.test(detailPage), 'NC register implemented');
    assert.ok(/contacts/.test(detailPage), 'contacts implemented');
    assert.ok(/notes/.test(detailPage), 'notes implemented');
    assert.ok(/tasks/.test(detailPage), 'tasks implemented');
    assert.ok(/documents/.test(detailPage), 'documents implemented');
  });

  it('detail page renders project-specific fields (institution, location, state, parties)', () => {
    assert.ok(/institutionName/.test(detailPage), 'renders institutionName');
    assert.ok(/locationText/.test(detailPage), 'renders locationText');
    assert.ok(/state/.test(detailPage), 'renders state');
    assert.ok(/Party Name/.test(detailPage) || /partyName/.test(detailPage), 'renders party name');
    assert.ok(/Party Role/.test(detailPage) || /partyRole/.test(detailPage), 'renders party role');
  });

  it('lib exports sub-resource types', () => {
    assert.ok(/export interface ProjectParty/.test(projectsApi), 'exports ProjectParty');
    assert.ok(/export interface ProjectPipelineEntry/.test(projectsApi), 'exports ProjectPipelineEntry');
    assert.ok(/export interface ProjectApprovalHistoryEntry/.test(projectsApi), 'exports ProjectApprovalHistoryEntry');
    assert.ok(/export interface ProjectNcEntry/.test(projectsApi), 'exports ProjectNcEntry');
  });
});
