import { type DOMWrapper, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import EventingPage from '@/pages/get-started/behaviour/eventing.vue';
import HistoryPage from '@/pages/get-started/behaviour/history.vue';
import RuntimePage from '@/pages/get-started/behaviour/runtime.vue';
import ObservabilityPage from '@/pages/get-started/deployment/observability.vue';
import { useAppStore } from '@/stores/app';
import { readServiceEnvironment } from '@/utils/dockerEnvironment';

vi.stubGlobal('useSeoMeta', vi.fn());

const InputStub = defineComponent({
  props: {
    modelValue: { type: [String, Number], default: '' },
    label: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  template:
    '<input :data-label="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
});

const NumberStub = defineComponent({
  props: {
    modelValue: { type: [String, Number], default: 0 },
    label: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  template:
    '<input :data-label="label" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
});

const SwitchStub = defineComponent({
  props: { modelValue: { type: Boolean, default: false }, label: { type: String, default: '' } },
  emits: ['update:modelValue'],
  template:
    '<input type="checkbox" :data-label="label" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
});

const globalStubs = {
  'v-container': { template: '<div><slot /></div>' },
  'v-breadcrumbs': { template: '<div />' },
  'v-alert': { template: '<div><slot /></div>' },
  'v-row': { template: '<div><slot /></div>' },
  'v-col': { template: '<div><slot /></div>' },
  'v-divider': { template: '<hr />' },
  'v-expansion-panels': { template: '<div><slot /></div>' },
  'v-expansion-panel': { template: '<section><slot /></section>' },
  'v-expansion-panel-text': { template: '<div><slot /></div>' },
  'v-text-field': InputStub,
  'v-select': InputStub,
  'v-number-input': NumberStub,
  'v-switch': SwitchStub,
  'v-btn': { template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'v-card-actions': { template: '<div><slot /></div>' },
  'v-spacer': { template: '<span />' },
};

function environment(): Record<string, string> {
  const store = useAppStore();
  return readServiceEnvironment(store.getDockerComposeConfig?.value);
}

function applyButton(wrapper: VueWrapper, label: string): DOMWrapper<Element> | undefined {
  return wrapper.findAll('button').find(button => button.text().includes(label));
}

describe('BaSyx Go configuration pages', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useAppStore().initializeStarterDefaults();
  });

  it('writes runtime and API settings to the AAS Environment', async () => {
    const wrapper = mount(RuntimePage, { global: { stubs: globalStubs } });

    await wrapper.find('input[data-label="SERVER_READ_TIMEOUT_SECONDS"]').setValue('900');
    await wrapper.find('input[data-label="Maximum upload size (MiB)"]').setValue('256');
    await applyButton(wrapper, 'Apply Runtime Settings')?.trigger('click');
    await nextTick();

    expect(environment().SERVER_READ_TIMEOUT_SECONDS).toBe('900');
    expect(environment().GENERAL_UPLOADMAXSIZEBYTES).toBe(String(256 * 1024 * 1024));
    expect(environment().CORS_ALLOWCREDENTIALS).toBe('true');
  });

  it('enables audit history with a guarded PostgreSQL history store', async () => {
    const wrapper = mount(HistoryPage, { global: { stubs: globalStubs } });

    await wrapper.find('input[data-label="BASYX_HISTORY_MODE"]').setValue('audit');
    await wrapper
      .find('input[data-label="BASYX_HISTORY_IMMUTABILITY"]')
      .setValue('postgres_guarded');
    await wrapper.find('input[data-label="BASYX_AUDIT_IDENTITY_MODE"]').setValue('extended');
    await applyButton(wrapper, 'Apply History Settings')?.trigger('click');
    await nextTick();

    expect(environment().BASYX_HISTORY_MODE).toBe('audit');
    expect(environment().BASYX_HISTORY_IMMUTABILITY).toBe('postgres_guarded');
    expect(environment().BASYX_AUDIT_IDENTITY_MODE).toBe('extended');
  });

  it('configures MQTT CloudEvent publication', async () => {
    const wrapper = mount(EventingPage, { global: { stubs: globalStubs } });

    await wrapper.find('input[data-label="Event sink"]').setValue('mqtt');
    await nextTick();
    await wrapper.find('input[data-label="MQTT broker URL"]').setValue('mqtt://events:1883');
    await applyButton(wrapper, 'Apply Eventing Settings')?.trigger('click');
    await nextTick();

    expect(environment().BASYX_EVENTING_ENABLED).toBe('true');
    expect(environment().BASYX_EVENTING_SINKS).toBe('mqtt');
    expect(environment().BASYX_EVENTING_MQTT_BROKER).toBe('mqtt://events:1883');
  });

  it('configures structured logs and OTLP export', async () => {
    const wrapper = mount(ObservabilityPage, { global: { stubs: globalStubs } });

    await wrapper.find('input[data-label="LOGGING_FORMAT"]').setValue('json');
    await wrapper.find('input[data-label="OTEL_TRACES_EXPORTER"]').setValue('otlp');
    await nextTick();
    await wrapper
      .find('input[data-label="OTEL_EXPORTER_OTLP_ENDPOINT"]')
      .setValue('http://collector:4318');
    await applyButton(wrapper, 'Apply Observability Settings')?.trigger('click');
    await nextTick();

    expect(environment().LOGGING_FORMAT).toBe('json');
    expect(environment().OTEL_TRACES_EXPORTER).toBe('otlp');
    expect(environment().OTEL_EXPORTER_OTLP_ENDPOINT).toBe('http://collector:4318');
  });
});
