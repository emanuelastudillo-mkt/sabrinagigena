import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export async function waitForPagesArtifact({
  repository, runId, artifactId, token,
  fetchImpl = fetch, wait = sleep, log = console.log,
  attempts = 12, delayMs = 10000
}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') ||
      !/^\d+$/.test(String(runId || '')) || !/^\d+$/.test(String(artifactId || '')) || !token) {
    throw new Error('Faltan el repositorio, la ejecución, el ID del paquete subido o GH_TOKEN.');
  }
  const url = `https://api.github.com/repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28' },
        signal: AbortSignal.timeout(10000)
      });
    } catch {
      log(`Consulta ${attempt}/${attempts}: GitHub no respondió; se reintentará.`);
    }
    if (response) {
      if (response.ok) {
        const data = await response.json();
        if (!Array.isArray(data.artifacts)) throw new Error('Respuesta de artefactos inválida.');
        const matches = data.artifacts.filter(item => item.name === 'github-pages');
        if (matches.length > 1) throw new Error('Hay varios paquetes github-pages en esta ejecución.');
        const artifact = matches[0];
        if (artifact && String(artifact.id) === String(artifactId) &&
            artifact.expired === false && artifact.size_in_bytes > 0) {
          log(`Paquete github-pages ${artifactId} disponible en la ejecución ${runId} (consulta ${attempt}).`);
          return artifact;
        }
        log(`Consulta ${attempt}/${attempts}: el paquete recién subido aún no está disponible.`);
      } else if ([404, 429].includes(response.status) || response.status >= 500) {
        log(`Consulta ${attempt}/${attempts}: GitHub respondió HTTP ${response.status}; se reintentará.`);
      } else {
        throw new Error(`No se pudo comprobar el paquete: HTTP ${response.status}. Revisar permiso actions: read.`);
      }
    }
    if (attempt < attempts) await wait(delayMs);
  }
  throw new Error(`El paquete github-pages ${artifactId} no apareció tras ${attempts} consultas. Publicación detenida; reejecutar el workflow cuando GitHub se recupere.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  waitForPagesArtifact({ repository: process.env.GITHUB_REPOSITORY, runId: process.env.GITHUB_RUN_ID,
    artifactId: process.env.EXPECTED_ARTIFACT_ID, token: process.env.GH_TOKEN
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
