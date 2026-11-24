import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForPagesArtifact } from './verificar-artefacto-pages.mjs';

const artifact = { id: 42, name: 'github-pages', expired: false, size_in_bytes: 100 };
const ok = artifacts => ({ ok: true, json: async () => ({ artifacts }) });
function fixture(responses) {
  const calls = [], delays = [];
  return { calls, delays, options: { repository: 'owner/repo', runId: '123', artifactId: '42', token: 'test',
    attempts: responses.length, delayMs: 10, log: () => {}, wait: async ms => delays.push(ms),
    fetchImpl: async (url, options) => {
      calls.push(url);
      assert.ok(options.signal);
      const response = responses[calls.length - 1];
      if (response instanceof Error) throw response;
      return response;
    }
  } };
}
test('Espera hasta que la API liste el paquete subido en la ejecución actual', async () => {
  const f = fixture([ok([]), ok([artifact])]);
  assert.equal((await waitForPagesArtifact(f.options)).id, 42);
  assert.equal(f.calls.length, 2);
  assert.match(f.calls[0], /\/runs\/123\/artifacts/);
  assert.deepEqual(f.delays, [10]);
});
test('Recupera errores transitorios de red, 404, 429 y 503', async () => {
  const f = fixture([new Error('network'), ...[404,429,503].map(status => ({ok:false,status})), ok([artifact])]);
  await waitForPagesArtifact(f.options);
  assert.equal(f.delays.length, 4);
});
test('No acepta un paquete anterior, vencido, vacío ni de otro nombre', async () => {
  for (const overrides of [{id:41}, {expired:true}, {size_in_bytes:0}, {name:'other'}]) {
    const f = fixture([ok([{...artifact,...overrides}]), ok([])]);
    await assert.rejects(waitForPagesArtifact(f.options), /no apareció tras 2 consultas/);
    assert.equal(f.delays.length, 1);
  }
});
test('Permisos insuficientes detienen inmediatamente la publicación', async () => {
  const f = fixture([{ok:false,status:403},ok([artifact])]);
  await assert.rejects(waitForPagesArtifact(f.options), /HTTP 403/);
  assert.equal(f.calls.length, 1);
  assert.equal(f.delays.length, 0);
});
test('Rechaza duplicados y falta de ID sin publicar un paquete ambiguo', async () => {
  const f = fixture([ok([artifact, {...artifact,id:43}])]);
  await assert.rejects(waitForPagesArtifact(f.options), /varios paquetes/);
  await assert.rejects(waitForPagesArtifact({...f.options,artifactId:''}), /Faltan/);
  assert.equal(f.calls.length, 1);
});
