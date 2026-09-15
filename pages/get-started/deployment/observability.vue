<template>
  <v-container class="py-0 px-4 px-sm-8 px-md-12" fluid>
    <v-breadcrumbs class="px-0 pb-0 text-body-2 mb-3" divider="›" :items="breadcrumbs" />
    <h1 class="mb-8 text-header">Logging and OpenTelemetry</h1>
    <p class="text-normalText mt-8 mb-5 text-subtitle-1">
      BaSyx Go writes logs to standard error and can export traces and PostgreSQL pool metrics with
      OpenTelemetry. Trace and metric export are independently configurable.
    </p>

    <v-alert color="alertCard" class="mb-8">
      <div class="font-weight-medium text-header">Collector required for OTLP</div>
      <p class="text-subheader font-weight-medium mt-2 mb-0">
        This Starter Kit does not deploy an OpenTelemetry Collector. Select <code>otlp</code> only
        when the configured endpoint is reachable from the AAS Environment container.
      </p>
    </v-alert>

    <v-divider class="mb-8" />
    <h2 class="text-header">Logging</h2>
    <v-row class="mt-4" density="compact">
      <v-col cols="12" md="6">
        <v-select
          v-model="loggingFormat"
          :items="logFormats"
          label="LOGGING_FORMAT"
          variant="solo-filled"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-select
          v-model="loggingLevel"
          :items="logLevels"
          label="LOGGING_LEVEL"
          variant="solo-filled"
        />
      </v-col>
    </v-row>

    <v-divider class="mt-8 mb-8" />
    <h2 class="text-header">OpenTelemetry Export</h2>
    <v-row class="mt-4" density="compact">
      <v-col cols="12" md="6">
        <v-select
          v-model="tracesExporter"
          :items="exporters"
          label="OTEL_TRACES_EXPORTER"
          variant="solo-filled"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-select
          v-model="metricsExporter"
          :items="exporters"
          label="OTEL_METRICS_EXPORTER"
          variant="solo-filled"
        />
      </v-col>
      <template v-if="usesOtlp">
        <v-col cols="12" md="7">
          <v-text-field
            v-model="otlpEndpoint"
            label="OTEL_EXPORTER_OTLP_ENDPOINT"
            variant="solo-filled"
            hint="For example http://otel-collector:4318."
            persistent-hint
          />
        </v-col>
        <v-col cols="12" md="5">
          <v-select
            v-model="otlpProtocol"
            :items="protocols"
            label="OTEL_EXPORTER_OTLP_PROTOCOL"
            variant="solo-filled"
          />
        </v-col>
      </template>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="serviceName"
          label="OTEL_SERVICE_NAME"
          variant="solo-filled"
          hint="Logical service name shown in the observability backend."
          persistent-hint
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="resourceAttributes"
          label="OTEL_RESOURCE_ATTRIBUTES"
          variant="solo-filled"
          hint="Comma-separated key=value attributes, for example deployment.environment=local."
          persistent-hint
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-select
          v-model="tracesSampler"
          :items="samplers"
          label="OTEL_TRACES_SAMPLER"
          variant="solo-filled"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-number-input
          v-if="tracesSampler === 'parentbased_traceidratio'"
          v-model="tracesSamplerRatio"
          label="OTEL_TRACES_SAMPLER_ARG"
          :min="0"
          :max="1"
          :step="0.05"
          variant="solo-filled"
        />
      </v-col>
    </v-row>

    <v-alert v-if="usesOtlp && !otlpEndpoint.trim()" type="error" variant="tonal" class="mb-6">
      An OTLP endpoint is required when either exporter uses OTLP.
    </v-alert>

    <v-btn
      class="mb-2"
      block
      variant="tonal"
      :disabled="usesOtlp && !otlpEndpoint.trim()"
      @click="applySettings"
    >
      Apply Observability Settings
    </v-btn>
    <v-btn class="mb-8" block color="secondary" variant="text" @click="resetToDefaults">
      Reset To Defaults
    </v-btn>

    <v-card-actions class="px-0 mb-8">
      <v-btn
        variant="tonal"
        prepend-icon="mdi-arrow-left"
        to="/get-started/deployment/container-config"
        >Back</v-btn
      >
      <v-spacer />
      <v-btn
        variant="tonal"
        color="primary"
        append-icon="mdi-arrow-right"
        to="/get-started/deployment/access-control"
        >Next</v-btn
      >
    </v-card-actions>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { envNumber, readServiceEnvironment } from '@/utils/dockerEnvironment';

defineOptions({ name: 'ObservabilityConfiguration' });

useSeoMeta({
  title: 'Logging and OpenTelemetry | Eclipse BaSyx™',
  ogTitle: 'Logging and OpenTelemetry | Eclipse BaSyx™',
});

const DEFAULTS = {
  loggingFormat: 'text',
  loggingLevel: 'info',
  tracesExporter: 'none',
  metricsExporter: 'none',
  otlpEndpoint: '',
  otlpProtocol: 'http/protobuf',
  serviceName: 'aasenvironmentservice',
  resourceAttributes: '',
  tracesSampler: 'parentbased_always_on',
  tracesSamplerRatio: 1,
};

const appStore = useAppStore();
const compose = computed(() => appStore.getDockerComposeConfig?.value);
const breadcrumbs = ref([
  { title: 'Home', to: '/' },
  { title: 'Get Started', to: '/get-started/introduction' },
  { title: 'Logging and OpenTelemetry', to: '/get-started/deployment/observability' },
]);
const logFormats = ['text', 'json'];
const logLevels = ['debug', 'info', 'warn', 'error'];
const exporters = ['none', 'otlp', 'console'];
const protocols = ['http/protobuf', 'grpc'];
const samplers = ['parentbased_always_on', 'parentbased_traceidratio', 'always_on', 'always_off'];

const loggingFormat = ref(DEFAULTS.loggingFormat);
const loggingLevel = ref(DEFAULTS.loggingLevel);
const tracesExporter = ref(DEFAULTS.tracesExporter);
const metricsExporter = ref(DEFAULTS.metricsExporter);
const otlpEndpoint = ref(DEFAULTS.otlpEndpoint);
const otlpProtocol = ref(DEFAULTS.otlpProtocol);
const serviceName = ref(DEFAULTS.serviceName);
const resourceAttributes = ref(DEFAULTS.resourceAttributes);
const tracesSampler = ref(DEFAULTS.tracesSampler);
const tracesSamplerRatio = ref(DEFAULTS.tracesSamplerRatio);
const usesOtlp = computed(
  () => tracesExporter.value === 'otlp' || metricsExporter.value === 'otlp'
);

function syncFromCompose(): void {
  const env = readServiceEnvironment(compose.value);
  loggingFormat.value = env.LOGGING_FORMAT || DEFAULTS.loggingFormat;
  loggingLevel.value = env.LOGGING_LEVEL || DEFAULTS.loggingLevel;
  tracesExporter.value = env.OTEL_TRACES_EXPORTER || DEFAULTS.tracesExporter;
  metricsExporter.value = env.OTEL_METRICS_EXPORTER || DEFAULTS.metricsExporter;
  otlpEndpoint.value = env.OTEL_EXPORTER_OTLP_ENDPOINT || DEFAULTS.otlpEndpoint;
  otlpProtocol.value = env.OTEL_EXPORTER_OTLP_PROTOCOL || DEFAULTS.otlpProtocol;
  serviceName.value = env.OTEL_SERVICE_NAME || DEFAULTS.serviceName;
  resourceAttributes.value = env.OTEL_RESOURCE_ATTRIBUTES || DEFAULTS.resourceAttributes;
  tracesSampler.value = env.OTEL_TRACES_SAMPLER || DEFAULTS.tracesSampler;
  tracesSamplerRatio.value = envNumber(env.OTEL_TRACES_SAMPLER_ARG, DEFAULTS.tracesSamplerRatio);
}

function applySettings(): void {
  const values: Record<string, string> = {
    LOGGING_FORMAT: loggingFormat.value,
    LOGGING_LEVEL: loggingLevel.value,
    OTEL_TRACES_EXPORTER: tracesExporter.value,
    OTEL_METRICS_EXPORTER: metricsExporter.value,
    OTEL_SERVICE_NAME: serviceName.value.trim() || DEFAULTS.serviceName,
    OTEL_TRACES_SAMPLER: tracesSampler.value,
    OTEL_PROPAGATORS: 'tracecontext,baggage',
  };
  const optionalKeys = [
    'OTEL_EXPORTER_OTLP_ENDPOINT',
    'OTEL_EXPORTER_OTLP_PROTOCOL',
    'OTEL_RESOURCE_ATTRIBUTES',
    'OTEL_TRACES_SAMPLER_ARG',
  ];

  if (usesOtlp.value) {
    values.OTEL_EXPORTER_OTLP_ENDPOINT = otlpEndpoint.value.trim();
    values.OTEL_EXPORTER_OTLP_PROTOCOL = otlpProtocol.value;
  }
  if (resourceAttributes.value.trim()) {
    values.OTEL_RESOURCE_ATTRIBUTES = resourceAttributes.value.trim();
  }
  if (tracesSampler.value === 'parentbased_traceidratio') {
    values.OTEL_TRACES_SAMPLER_ARG = String(Math.min(1, Math.max(0, tracesSamplerRatio.value)));
  }

  const removeKeys = optionalKeys.filter(key => !(key in values));
  appStore.updateServiceEnvironment('aas-environment', values, removeKeys);
}

function resetToDefaults(): void {
  loggingFormat.value = DEFAULTS.loggingFormat;
  loggingLevel.value = DEFAULTS.loggingLevel;
  tracesExporter.value = DEFAULTS.tracesExporter;
  metricsExporter.value = DEFAULTS.metricsExporter;
  otlpEndpoint.value = DEFAULTS.otlpEndpoint;
  otlpProtocol.value = DEFAULTS.otlpProtocol;
  serviceName.value = DEFAULTS.serviceName;
  resourceAttributes.value = DEFAULTS.resourceAttributes;
  tracesSampler.value = DEFAULTS.tracesSampler;
  tracesSamplerRatio.value = DEFAULTS.tracesSamplerRatio;
  applySettings();
}

watch(compose, syncFromCompose, { immediate: true });
</script>
