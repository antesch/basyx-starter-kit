export interface EnvironmentService {
  environment?: Record<string, string> | string[];
}

export function readEnvironment(environment: string[] | undefined): Record<string, string> {
  if (!environment) {
    return {};
  }

  return environment.reduce<Record<string, string>>((result, entry) => {
    const separator = entry.indexOf('=');
    if (separator < 0) {
      return result;
    }
    result[entry.slice(0, separator)] = entry.slice(separator + 1);
    return result;
  }, {});
}

export function readServiceEnvironment(
  composeValue: unknown,
  serviceName = 'aas-environment'
): Record<string, string> {
  if (!composeValue || typeof composeValue !== 'object' || !('services' in composeValue)) {
    return {};
  }

  const services = composeValue.services as Record<string, EnvironmentService>;
  const environment = services[serviceName]?.environment;
  return Array.isArray(environment) ? readEnvironment(environment) : environment || {};
}

export function envBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value.toLowerCase() === 'true';
}

export function envNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
