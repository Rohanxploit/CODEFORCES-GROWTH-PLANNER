import { env } from '../config/env.js';
import { CodeforcesClient } from './codeforces.service.js';
import { ProblemCatalog, mongoCatalogRepository, type CatalogSnapshot } from './problemCatalog.service.js';
import type { CatalogProblem } from './problemSelector/fetchProblemset.js';

// Long-lived service instances. Tests swap them with setServices().

export interface Services {
  codeforces: Pick<CodeforcesClient, 'getUserInfo' | 'getContests'>;
  catalog: { getProblems(): Promise<CatalogProblem[]>; getSnapshot(): Promise<CatalogSnapshot> };
}

let services: Services | null = null;

function createServices(): Services {
  const codeforces = new CodeforcesClient({ baseUrl: env.CODEFORCES_API_BASE });
  return { codeforces, catalog: new ProblemCatalog(codeforces, mongoCatalogRepository) };
}

export function getServices(): Services {
  services ??= createServices();
  return services;
}

export function setServices(overrides: Partial<Services>): void {
  services = { ...getServices(), ...overrides };
}
