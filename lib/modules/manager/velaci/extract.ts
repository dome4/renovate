import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';
import type { VelaPipelineConfiguration } from './types';

export function extractPackageFile(file: string): PackageFile | null {
  let doc: VelaPipelineConfiguration | undefined;

  try {
    doc = load(file, { json: true }) as VelaPipelineConfiguration;
  } catch (err) {
    logger.debug({ err, file }, 'Failed to parse Vela file.');
    return null;
  }

  const deps: PackageDependency[] = [];

  // iterate over steps
  for (const step of doc.steps ?? []) {
    const dep = getDep(step.image);

    deps.push(dep);
  }

  // iterate over services
  for (const service of doc.services ?? []) {
    const dep = getDep(service.image);

    deps.push(dep);
  }

  // iterate over stages
  for (const stage of Object.values(doc.stages ?? {})) {
    for (const step of stage.steps ?? []) {
      const dep = getDep(step.image);

      deps.push(dep);
    }
  }

  // check secrets
  for (const secret of Object.values(doc.secrets ?? {})) {
    if (secret.origin) {
      const dep = getDep(secret.origin.image);

      deps.push(dep);
    }
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}
