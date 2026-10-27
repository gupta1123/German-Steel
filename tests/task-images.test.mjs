import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { downloadTaskImage, listTaskImages, normalizeTaskImages } from '../lib/task-images.ts';

const image = { id: 101, fileName: 'Complaint.jpg', mimeType: 'image/jpeg', downloadUrl: '/api/hr/files/101/download' };
const base = new URL(process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081').origin;

test('recognizes the mobile inline-attachment contract and paginated file metadata', () => {
  const expected = [{ id: 101, name: 'Complaint.jpg', mimeType: 'image/jpeg', downloadUrl: `${base}/api/hr/files/101/download` }];
  assert.deepEqual(normalizeTaskImages({ attachments: [image] }), expected);
  assert.deepEqual(normalizeTaskImages({ data: { attachments: [image] } }), expected);
  assert.deepEqual(normalizeTaskImages({ content: [{ id: 101, originalFileName: 'Complaint.jpg', storedMimeType: 'image/jpeg' }] }), expected);
  assert.deepEqual(normalizeTaskImages([image]), expected);
});

test('filters non-images, inactive files, and invalid IDs without losing images lacking MIME metadata', () => {
  const result = normalizeTaskImages([
    image, image,
    { id: 102, originalFileName: 'Photo.PNG' },
    { id: 103, fileName: 'camera.webp', mimeType: 'application/octet-stream' },
    { id: 104, fileName: 'document.pdf', mimeType: 'application/pdf' },
    { id: 105, fileName: 'fake.jpg', mimeType: 'text/html' },
    { id: 106, fileName: 'inactive.jpg', mimeType: 'image/jpeg', active: false },
    { id: 107, mimeType: 'image/png' },
    { id: 0, mimeType: 'image/png' },
    { id: -1, mimeType: 'image/png' },
    { id: 1.1, mimeType: 'image/png' },
    { id: 'invalid', mimeType: 'image/png' },
    null,
  ]);
  assert.deepEqual(result.map((file) => file.id), [101, 102, 103, 107]);
  assert.equal(result.at(-1).name, 'Image 107');
});

test('attachment metadata cannot redirect authenticated downloads to another host or unsafe scheme', () => {
  for (const downloadUrl of ['https://example.invalid/leak', '//example.invalid/leak', 'javascript:alert(1)', 'data:text/html,test', `http://user:pass@${new URL(base).host}/image`]) {
    const [file] = normalizeTaskImages([{ ...image, downloadUrl }]);
    assert.equal(file.downloadUrl, `${base}/api/hr/files/101/download`);
  }
  const [safe] = normalizeTaskImages([{ ...image, downloadUrl: '/api/hr/files/101/download?original=true' }]);
  assert.equal(safe.downloadUrl, `${base}/api/hr/files/101/download?original=true`);
});

test('lists inline images through the same task-details endpoint as mobile, with authentication and cancellation', async (t) => {
  const controller = new AbortController();
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ attachments: [image] }));
  const result = await listTaskImages(42, 'test-token', controller.signal);
  assert.equal(result.length, 1);
  assert.equal(fetchMock.mock.callCount(), 1);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(new URL(url).pathname, '/api/Task/getById');
  assert.equal(new URL(url).searchParams.get('id'), '42');
  assert.equal(options.headers.Authorization, 'Bearer test-token');
  assert.equal(options.signal, controller.signal);
  assert.equal(options.method, undefined, 'Viewing images must not write any task data');
});

test('an explicitly empty attachment list is an empty state, not an unnecessary fallback request', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ attachments: [] }));
  assert.deepEqual(await listTaskImages(42, 'test-token'), []);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('older task DTOs fall back to TASK-scoped files and read all file pages', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/api/Task/getById') return Response.json({ id: 42 });
    assert.equal(parsed.pathname, '/api/hr/files');
    assert.equal(parsed.searchParams.get('parentType'), 'TASK');
    assert.equal(parsed.searchParams.get('parentId'), '42');
    assert.equal(parsed.searchParams.get('size'), '50');
    return Response.json({ data: { content: [{ ...image, id: parsed.searchParams.get('page') === '0' ? 101 : 102 }], totalPages: 2 } });
  });
  assert.deepEqual((await listTaskImages(42, 'test-token')).map((file) => file.id), [101, 102]);
  assert.equal(fetchMock.mock.callCount(), 3);
});

test('unsupported detail routes fall back, but permission and server errors are surfaced', async (t) => {
  let detailStatus = 404;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url) => (
    new URL(url).pathname === '/api/Task/getById'
      ? Response.json({ message: 'Task access denied' }, { status: detailStatus })
      : Response.json({ content: [image] })
  ));
  for (const status of [404, 405]) {
    detailStatus = status;
    assert.equal((await listTaskImages(42, 'test-token')).length, 1);
  }
  for (const status of [401, 403, 500]) {
    detailStatus = status;
    const before = fetchMock.mock.callCount();
    await assert.rejects(listTaskImages(42, 'test-token'), { message: 'Task access denied' });
    assert.equal(fetchMock.mock.callCount(), before + 1, 'Must not bypass task visibility failures');
  }
});

test('fallback list failures are not mistaken for tasks without images', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => (
    new URL(url).pathname === '/api/Task/getById'
      ? Response.json({ id: 42 })
      : Response.json({ message: 'Files unavailable' }, { status: 503 })
  ));
  await assert.rejects(listTaskImages(42, 'test-token'), { message: 'Files unavailable' });
});

test('invalid task IDs are refused without requests', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('Should not fetch'); });
  for (const id of [0, -1, 1.5, NaN]) await assert.rejects(listTaskImages(id, 'test-token'), /valid task ID/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('downloads use the bearer token and return image bytes; failed downloads remain errors', async (t) => {
  const file = normalizeTaskImages([image])[0];
  const controller = new AbortController();
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('image bytes', { headers: { 'Content-Type': 'image/jpeg' } }));
  const blob = await downloadTaskImage(file, 'test-token', controller.signal);
  assert.equal(await blob.text(), 'image bytes');
  assert.equal(blob.type, 'image/jpeg');
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, `${base}/api/hr/files/101/download`);
  assert.equal(options.headers.Authorization, 'Bearer test-token');
  assert.equal(options.signal, controller.signal);
  fetchMock.mock.mockImplementation(async () => Response.json({ message: 'Image unavailable' }, { status: 404 }));
  await assert.rejects(downloadTaskImage(file, 'test-token'), { message: 'Image unavailable' });
});

test('even a directly supplied cross-origin image URL is rejected before downloading', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('Should not fetch'); });
  await assert.rejects(downloadTaskImage({ ...image, name: image.fileName, downloadUrl: 'https://example.invalid/image' }, 'test-token'), /Invalid task image URL/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('all account task editors show the read-only gallery only for existing, open tasks', () => {
  for (const file of ['components/customer-detail-page.tsx', 'app/dashboard/institutions/[id]/page.tsx', 'app/dashboard/projects/[id]/page.tsx']) {
    assert.match(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), /taskOpen && editingTask && <TaskImages key=\{editingTask.id\} taskId=\{editingTask.id\}/, file);
  }
  const complaints = fs.readFileSync(new URL('../app/dashboard/complaints/page.tsx', import.meta.url), 'utf8');
  assert.match(complaints, /onClick=\{\(\) => setImageTask\(task\)\}/);
  assert.match(complaints, /View images/);
  const gallery = fs.readFileSync(new URL('../components/task-images.tsx', import.meta.url), 'utf8');
  assert.match(gallery, /controller.abort\(\)/);
  assert.match(gallery, /URL.revokeObjectURL/);
  assert.doesNotMatch(gallery, /type="file"|uploadTask|method: 'POST'|method: 'DELETE'/);
});
