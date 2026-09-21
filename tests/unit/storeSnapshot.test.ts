import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from '@/stores/app';
import { decodeConfigHash, encodeConfigHash } from '@/utils/configPersistence';
import { readServiceEnvironment } from '@/utils/dockerEnvironment';
import { localBrokerServices } from '@/utils/localStacks';
import { updateOptionalServices } from '@/utils/optionalServices';
import { localKeycloakService } from '@/utils/securitySetup';

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

  it('restores generated local service credentials after a secret-free shared link', () => {
    const store = useAppStore();
    store.initializeStarterDefaults();
    updateOptionalServices(
      {
        ...localBrokerServices('amqp'),
        ...localKeycloakService({
          host: 'db',
          port: '5432',
          name: 'basyxTestDB',
          user: 'admin',
          password: 'admin123',
          local: true,
        }),
      },
      ['rabbitmq', 'keycloak']
    );
    store.updateServiceEnvironment('aas-environment', {
      BASYX_EVENTING_AMQP_PASSWORD: 'basyx-demo',
    });

    const encoded = encodeConfigHash({
      route: '/get-started/download',
      state: store.createSerializableSnapshot(),
    });
    const decoded = decodeConfigHash(encoded);
    expect(JSON.stringify(decoded.payload)).not.toContain('basyx-demo');
    store.reset();
    store.initializeStarterDefaults();
    store.applySerializableSnapshot(decoded.payload?.state);

    const services = (
      store.getDockerComposeConfig?.value as {
        services: Record<string, { environment?: Record<string, string> }>;
      }
    ).services;
    expect(services.keycloak?.environment?.KC_DB_PASSWORD).toBe('admin123');
    expect(services.rabbitmq?.environment?.RABBITMQ_DEFAULT_PASS).toBe('basyx-demo');
    expect(
      readServiceEnvironment(store.getDockerComposeConfig?.value).BASYX_EVENTING_AMQP_PASSWORD
    ).toBe('basyx-demo');
  });
});
