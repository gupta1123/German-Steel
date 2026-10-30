import test from 'node:test';
import assert from 'node:assert/strict';
import { employeePhotoApi, validateEmployeePhoto, createdEmployeeId, MAX_EMPLOYEE_PHOTO_BYTES } from '../lib/employee-photo-api.ts';

const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = () => new File([pngHeader], 'portrait.png', { type: 'image/png' });

test('accepts JPEG and PNG headers, including an image exactly 5 MiB', async () => {
  await validateEmployeePhoto(png());
  await validateEmployeePhoto(new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'portrait.jpg', { type: 'image/jpeg' }));
  await validateEmployeePhoto(new File([pngHeader, new Uint8Array(MAX_EMPLOYEE_PHOTO_BYTES - pngHeader.length)], 'limit.png', { type: 'image/png' }));
});

test('rejects unsupported, empty, oversized and falsely labelled images', async () => {
  await assert.rejects(validateEmployeePhoto(new File(['GIF89a'], 'portrait.gif', { type: 'image/gif' })), /JPEG or PNG/);
  await assert.rejects(validateEmployeePhoto(new File([], 'empty.png', { type: 'image/png' })), /empty/);
  await assert.rejects(validateEmployeePhoto(new File([new Uint8Array(MAX_EMPLOYEE_PHOTO_BYTES + 1)], 'big.png', { type: 'image/png' })), /5 MiB/);
  await assert.rejects(validateEmployeePhoto(new File(['not an image'], 'fake.png', { type: 'image/png' })), /valid JPEG or PNG/);
});

test('add and replace use the documented verbs and multipart file field without a manual content type', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  for (const mode of ['add', 'replace']) {
    await employeePhotoApi.save(42, 'photo-token', png(), mode);
    const [url, init] = fetch.mock.calls.at(-1).arguments;
    assert.equal(new URL(url).pathname, '/api/common/employees/42/profile-photo');
    assert.equal(init.method, mode === 'add' ? 'POST' : 'PUT');
    assert.equal(init.headers.Authorization, 'Bearer photo-token');
    assert.equal(init.headers['Content-Type'], undefined);
    assert(init.body instanceof FormData);
    assert.deepEqual([...init.body.keys()], ['file']);
    assert.equal(init.body.get('file').name, 'portrait.png');
  }
  assert.equal(fetch.mock.callCount(), 2);
});

test('view downloads authenticated image bytes and treats a missing photo as empty', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(pngHeader, { headers: { 'Content-Type': 'image/png' } }));
  const blob = await employeePhotoApi.get(42, 'photo-token');
  assert.equal(blob.type, 'image/png');
  assert.equal(blob.size, 8);
  assert.equal(fetch.mock.calls[0].arguments[1].headers.Authorization, 'Bearer photo-token');
  fetch.mock.mockImplementation(async () => new Response(null, { status: 404 }));
  assert.equal(await employeePhotoApi.get(42, 'photo-token'), null);
});

test('delete targets only the profile-photo endpoint with authentication', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  await employeePhotoApi.remove(42, 'photo-token');
  const [url, init] = fetch.mock.calls[0].arguments;
  assert.equal(new URL(url).pathname, '/api/common/employees/42/profile-photo');
  assert.equal(init.method, 'DELETE');
  assert.equal(init.headers.Authorization, 'Bearer photo-token');
});

test('permissions and upload failures are shown without automatic retries', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'You cannot change this employee photo' }, { status: 403 }));
  await assert.rejects(employeePhotoApi.save(42, 'photo-token', png(), 'replace'), /cannot change/);
  await assert.rejects(employeePhotoApi.get(42, 'photo-token'), /cannot change/);
  await assert.rejects(employeePhotoApi.remove(42, 'photo-token'), /cannot change/);
  assert.equal(fetch.mock.callCount(), 3);
});

test('invalid IDs, missing authentication and invalid files do not send requests', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request'); });
  await assert.rejects(employeePhotoApi.get(0, 'photo-token'), /valid employee ID/);
  await assert.rejects(employeePhotoApi.remove(42, ''), /sign in/);
  await assert.rejects(employeePhotoApi.save(42, 'photo-token', new File(['bad'], 'bad.txt', { type: 'text/plain' }), 'add'), /JPEG or PNG/);
  assert.equal(fetch.mock.callCount(), 0);
});

test('photo creation uses the employee ID, never the nested auth user ID', () => {
  assert.equal(createdEmployeeId({ employee: { id: 42 }, user: { id: 900, employeeId: 42 } }), 42);
  assert.equal(createdEmployeeId({ data: { employee: { id: 43 }, user: { id: 900 } } }), 43);
  assert.equal(createdEmployeeId({ id: 900, user: { employeeId: 44 } }), 44);
  assert.equal(createdEmployeeId({ employeeId: '45' }), 45);
  assert.equal(createdEmployeeId({ id: 46 }), 46);
  assert.equal(createdEmployeeId({ user: { id: 900 } }), null);
  assert.equal(createdEmployeeId({ employeeCode: 'EMP-42' }), null);
});
