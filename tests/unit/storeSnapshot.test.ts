import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from '@/stores/app';
import { readServiceEnvironment } from '@/utils/dockerEnvironment';

describe('app store snapshot helpers', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('creates and reapplies a serializable snapshot', () => {
    const store = useAppStore();
    store.initializeStarterDefaults();
    store.updateRegistryIntegration(false);
    store.setPrimaryDarkColor('#123456');

    const snapshot = store.createSerializableSnapshot();
    store.reset();
    store.initializeStarterDefaults();

    expect(store.getRegistryIntegration).toBe(true);
    store.applySerializableSnapshot(snapshot);
    expect(store.getRegistryIntegration).toBe(false);
    expect(store.getPrimaryDarkColor).toBe('#123456');
  });

  it('ignores unknown keys and keeps defaults for missing keys', () => {
    const store = useAppStore();
    store.initializeStarterDefaults();

    store.applySerializableSnapshot({
      registryIntegration: false,
      unknownFeature: true,
    });

    expect(store.getRegistryIntegration).toBe(false);
    expect(store.getDiscoveryIntegration).toBe(true);
  });

  it('migrates legacy snapshots with current generated defaults', () => {
    const store = useAppStore();
    store.initializeStarterDefaults();
    const snapshot = store.createSerializableSnapshot();
    const legacy = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;

    legacy.basyxConfig = legacy.basyxConfig.map(item => ({
      ...item,
      children: item.children.filter(
        child =>
          child.id !== 'ovw-aas-environment-history' &&
          child.id !== 'ovw-aas-environment-observability'
      ),
    }));
    const dockerComposeConfig = legacy.dockerComposeConfig;
    if (
      !dockerComposeConfig ||
      !dockerComposeConfig.value ||
      typeof dockerComposeConfig.value !== 'object'
    ) {
      throw new Error('Expected a generated Docker Compose configuration');
    }
    const services = (
      dockerComposeConfig.value as {
        services: Record<string, { environment?: string[] }>;
      }
    ).services;
    const aasEnvironment = services['aas-environment'];
    if (!aasEnvironment) {
      throw new Error('Expected the AAS Environment service');
    }
    aasEnvironment.environment = aasEnvironment.environment?.filter(
      entry =>
        !entry.startsWith('BASYX_HISTORY_') &&
        !entry.startsWith('BASYX_AUDIT_') &&
        !entry.startsWith('BASYX_EVENTING_') &&
        !entry.startsWith('OTEL_')
    );

    store.reset();
    store.initializeStarterDefaults();
    store.applySerializableSnapshot(legacy);

    const environment = readServiceEnvironment(store.getDockerComposeConfig?.value);
    expect(environment.BASYX_HISTORY_MODE).toBe('off');
    expect(environment.BASYX_EVENTING_ENABLED).toBe('false');
    expect(environment.OTEL_TRACES_EXPORTER).toBe('none');
    expect(store.getBasyxConfig[0]?.children.map(child => child.id)).toContain(
      'ovw-aas-environment-history'
    );
    expect(store.getBasyxConfig[0]?.children.map(child => child.id)).toContain(
      'ovw-aas-environment-observability'
    );
  });

  it('preserves mapping-style environments when updating a service', () => {
    const store = useAppStore();
    store.setDockerComposeConfig({
      value: {
        services: {
          'aas-environment': {
            environment: {
              KEEP: 'yes',
              REMOVE: 'old',
            },
          },
        },
      },
    });

    store.updateServiceEnvironment('aas-environment', { ADDED: 'new' }, ['REMOVE']);

    const environment = readServiceEnvironment(store.getDockerComposeConfig?.value);
    expect(environment).toEqual({ KEEP: 'yes', ADDED: 'new' });
  });
});
