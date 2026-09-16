<template>
  <v-container class="py-0 px-4 px-sm-8 px-md-12" fluid>
    <v-breadcrumbs class="px-0 pb-0 text-body-2 mb-3" divider="›" :items="breadcrumbs" />
    <h1 class="mb-8 text-header">Eventing</h1>
    <p class="text-normalText mt-8 mb-5 text-subtitle-1">
      BaSyx Go can expose recent changes through a REST event feed or publish CloudEvents through
      MQTT, Kafka, or AMQP 1.0. Broker delivery uses a PostgreSQL outbox and is at least once.
    </p>

    <v-alert type="warning" variant="tonal" class="mb-8">
      Broker eventing is experimental. The broker destination must exist before the AAS Environment
      starts, and consumers must deduplicate events by CloudEvent ID.
    </v-alert>

    <v-divider class="mb-8" />
    <h2 class="text-header">REST Event Feed</h2>
    <v-switch
      v-model="feedEnabled"
      color="primary"
      label="Enable the REST event feed"
      hide-details
      class="my-4"
    />
    <v-row v-if="feedEnabled" density="compact">
      <v-col cols="12" md="4">
        <v-number-input
          v-model="feedMaxAgeDays"
          label="Visible age (days)"
          :min="1"
          variant="solo-filled"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-number-input
          v-model="feedGraceDays"
          label="Hard-delete grace (days)"
          :min="0"
          variant="solo-filled"
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-number-input
          v-model="feedMaxPageSize"
          label="Maximum page size"
          :min="1"
          variant="solo-filled"
        />
      </v-col>
    </v-row>

    <v-divider class="mt-8 mb-8" />
    <h2 class="text-header">Message Broker</h2>
    <v-select
      v-model="sink"
      :items="sinkOptions"
      label="Event sink"
      variant="solo-filled"
      hint="Select none to disable broker publication."
      persistent-hint
      class="mt-4"
    />

    <v-row v-if="sink === 'mqtt'" density="compact">
      <v-col cols="12" md="6">
        <v-text-field v-model="mqttBroker" label="MQTT broker URL" variant="solo-filled" />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field v-model="mqttClientId" label="MQTT client ID" variant="solo-filled" />
      </v-col>
      <v-col cols="12" md="6">
        <v-select v-model="mqttQos" :items="[0, 1, 2]" label="MQTT QoS" variant="solo-filled" />
      </v-col>
      <v-col cols="12" md="6">
        <v-switch v-model="mqttRetained" color="primary" label="Publish retained messages" />
      </v-col>
    </v-row>

    <v-row v-if="sink === 'kafka'" density="compact">
      <v-col cols="12" md="6">
        <v-text-field
          v-model="kafkaBrokers"
          label="Kafka bootstrap brokers"
          variant="solo-filled"
          hint="Comma-separated host:port values."
          persistent-hint
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field v-model="kafkaTopic" label="Kafka topic" variant="solo-filled" />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field v-model="kafkaClientId" label="Kafka client ID" variant="solo-filled" />
      </v-col>
      <v-col cols="12" md="6">
        <v-switch v-model="kafkaTls" color="primary" label="Enable Kafka TLS" />
      </v-col>
    </v-row>

    <v-row v-if="sink === 'amqp'" density="compact">
      <v-col cols="12" md="6">
        <v-text-field v-model="amqpBroker" label="AMQP broker URL" variant="solo-filled" />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field v-model="amqpAddress" label="AMQP target address" variant="solo-filled" />
      </v-col>
    </v-row>

    <v-text-field
      v-if="sink !== 'none'"
      v-model="topicPrefix"
      label="BASYX_EVENTING_TOPIC_PREFIX"
      variant="solo-filled"
      hint="Prefix used for generated event topics."
      persistent-hint
    />

    <v-alert v-if="!brokerSettingsComplete" type="error" variant="tonal" class="mb-6">
      Complete the required broker destination fields for the selected sink.
    </v-alert>

    <v-btn
      class="mb-2"
      block
      variant="tonal"
      :disabled="!brokerSettingsComplete"
      @click="applySettings"
    >
      Apply Eventing Settings
    </v-btn>
    <v-btn class="mb-8" block color="secondary" variant="text" @click="resetToDefaults">
      Reset To Defaults
    </v-btn>

    <v-card-actions class="px-0 mb-8">
      <v-btn variant="tonal" prepend-icon="mdi-arrow-left" to="/get-started/behaviour/history"
        >Back</v-btn
      >
      <v-spacer />
      <v-btn
        variant="tonal"
        color="primary"
        append-icon="mdi-arrow-right"
        to="/get-started/behaviour/time-series"
        >Next</v-btn
      >
    </v-card-actions>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { envBoolean, envNumber, readServiceEnvironment } from '@/utils/dockerEnvironment';

defineOptions({ name: 'Eventing' });

useSeoMeta({
  title: 'Eventing | Eclipse BaSyx™',
  ogTitle: 'Eventing | Eclipse BaSyx™',
});

type EventSink = 'none' | 'mqtt' | 'kafka' | 'amqp';

const appStore = useAppStore();
const compose = computed(() => appStore.getDockerComposeConfig?.value);
const breadcrumbs = ref([
  { title: 'Home', to: '/' },
  { title: 'Get Started', to: '/get-started/introduction' },
  { title: 'Eventing', to: '/get-started/behaviour/eventing' },
]);
const sinkOptions = [
  { title: 'No message broker', value: 'none' },
  { title: 'MQTT 5', value: 'mqtt' },
  { title: 'Kafka', value: 'kafka' },
  { title: 'AMQP 1.0', value: 'amqp' },
];

const feedEnabled = ref(false);
const feedMaxAgeDays = ref(30);
const feedGraceDays = ref(10);
const feedMaxPageSize = ref(100);
const sink = ref<EventSink>('none');
const topicPrefix = ref('basyx');
const mqttBroker = ref('mqtt://broker:1883');
const mqttClientId = ref('basyx-aas-environment');
const mqttQos = ref(1);
const mqttRetained = ref(false);
const kafkaBrokers = ref('kafka:9092');
const kafkaTopic = ref('basyx.events');
const kafkaClientId = ref('basyx');
const kafkaTls = ref(false);
const amqpBroker = ref('amqp://rabbitmq:5672');
const amqpAddress = ref('/queues/basyx.events');

const brokerSettingsComplete = computed(() => {
  if (sink.value === 'mqtt') {
    return Boolean(mqttBroker.value.trim() && mqttClientId.value.trim());
  }
  if (sink.value === 'kafka') {
    return Boolean(kafkaBrokers.value.trim() && kafkaTopic.value.trim());
  }
  if (sink.value === 'amqp') {
    return Boolean(amqpBroker.value.trim() && amqpAddress.value.trim());
  }
  return true;
});

function syncFromCompose(): void {
  const env = readServiceEnvironment(compose.value);
  feedEnabled.value = envBoolean(env.BASYX_EVENTING_FEED_ENABLED);
  feedMaxAgeDays.value = envNumber(env.BASYX_EVENTING_FEED_MAX_AGE_DAYS, 30);
  feedGraceDays.value = envNumber(env.BASYX_EVENTING_FEED_HARD_DELETE_GRACE_DAYS, 10);
  feedMaxPageSize.value = envNumber(env.BASYX_EVENTING_FEED_MAX_PAGE_SIZE, 100);
  const configuredSink = env.BASYX_EVENTING_SINKS?.split(',')[0];
  sink.value =
    configuredSink === 'mqtt' || configuredSink === 'kafka' || configuredSink === 'amqp'
      ? configuredSink
      : 'none';
  topicPrefix.value = env.BASYX_EVENTING_TOPIC_PREFIX || 'basyx';
  mqttBroker.value = env.BASYX_EVENTING_MQTT_BROKER || 'mqtt://broker:1883';
  mqttClientId.value = env.BASYX_EVENTING_MQTT_CLIENT_ID || 'basyx-aas-environment';
  mqttQos.value = envNumber(env.BASYX_EVENTING_MQTT_QOS, 1);
  mqttRetained.value = envBoolean(env.BASYX_EVENTING_MQTT_RETAINED);
  kafkaBrokers.value = env.BASYX_EVENTING_KAFKA_BROKERS || 'kafka:9092';
  kafkaTopic.value = env.BASYX_EVENTING_KAFKA_TOPIC || 'basyx.events';
  kafkaClientId.value = env.BASYX_EVENTING_KAFKA_CLIENT_ID || 'basyx';
  kafkaTls.value = envBoolean(env.BASYX_EVENTING_KAFKA_TLS_ENABLED);
  amqpBroker.value = env.BASYX_EVENTING_AMQP_BROKER || 'amqp://rabbitmq:5672';
  amqpAddress.value = env.BASYX_EVENTING_AMQP_ADDRESS || '/queues/basyx.events';
}

function applySettings(): void {
  const brokerEnabled = sink.value !== 'none';
  const eventingEnabled = feedEnabled.value || brokerEnabled;
  const values: Record<string, string> = {
    BASYX_EVENTING_ENABLED: String(eventingEnabled),
    BASYX_EVENTING_FORMAT: 'cloudevents',
    BASYX_EVENTING_OUTBOX_ENABLED: String(brokerEnabled),
    BASYX_EVENTING_TOPIC_PREFIX: topicPrefix.value.trim() || 'basyx',
    BASYX_EVENTING_FEED_ENABLED: String(feedEnabled.value),
  };
  if (feedEnabled.value) {
    values.BASYX_EVENTING_FEED_MAX_AGE_DAYS = String(Math.max(1, feedMaxAgeDays.value));
    values.BASYX_EVENTING_FEED_HARD_DELETE_GRACE_DAYS = String(Math.max(0, feedGraceDays.value));
    values.BASYX_EVENTING_FEED_MAX_PAGE_SIZE = String(Math.max(1, feedMaxPageSize.value));
  }
  if (sink.value !== 'none') {
    values.BASYX_EVENTING_SINKS = sink.value;
  }
  if (sink.value === 'mqtt') {
    Object.assign(values, {
      BASYX_EVENTING_MQTT_BROKER: mqttBroker.value.trim(),
      BASYX_EVENTING_MQTT_CLIENT_ID: mqttClientId.value.trim(),
      BASYX_EVENTING_MQTT_SINK_ID: 'mqtt',
      BASYX_EVENTING_MQTT_QOS: String(mqttQos.value),
      BASYX_EVENTING_MQTT_RETAINED: String(mqttRetained.value),
    });
  }
  if (sink.value === 'kafka') {
    Object.assign(values, {
      BASYX_EVENTING_KAFKA_BROKERS: kafkaBrokers.value.trim(),
      BASYX_EVENTING_KAFKA_TOPIC: kafkaTopic.value.trim(),
      BASYX_EVENTING_KAFKA_CLIENT_ID: kafkaClientId.value.trim(),
      BASYX_EVENTING_KAFKA_SINK_ID: 'kafka',
      BASYX_EVENTING_KAFKA_TLS_ENABLED: String(kafkaTls.value),
    });
  }
  if (sink.value === 'amqp') {
    Object.assign(values, {
      BASYX_EVENTING_AMQP_BROKER: amqpBroker.value.trim(),
      BASYX_EVENTING_AMQP_ADDRESS: amqpAddress.value.trim(),
      BASYX_EVENTING_AMQP_SINK_ID: 'amqp',
    });
  }

  const managedKeys = [
    'BASYX_EVENTING_SINKS',
    'BASYX_EVENTING_FEED_MAX_AGE_DAYS',
    'BASYX_EVENTING_FEED_HARD_DELETE_GRACE_DAYS',
    'BASYX_EVENTING_FEED_MAX_PAGE_SIZE',
    'BASYX_EVENTING_MQTT_BROKER',
    'BASYX_EVENTING_MQTT_CLIENT_ID',
    'BASYX_EVENTING_MQTT_SINK_ID',
    'BASYX_EVENTING_MQTT_QOS',
    'BASYX_EVENTING_MQTT_RETAINED',
    'BASYX_EVENTING_KAFKA_BROKERS',
    'BASYX_EVENTING_KAFKA_TOPIC',
    'BASYX_EVENTING_KAFKA_CLIENT_ID',
    'BASYX_EVENTING_KAFKA_SINK_ID',
    'BASYX_EVENTING_KAFKA_TLS_ENABLED',
    'BASYX_EVENTING_AMQP_BROKER',
    'BASYX_EVENTING_AMQP_ADDRESS',
    'BASYX_EVENTING_AMQP_SINK_ID',
  ];
  appStore.updateServiceEnvironment(
    'aas-environment',
    values,
    managedKeys.filter(key => !(key in values))
  );
  appStore.updateMQTT(sink.value === 'mqtt');
}

function resetToDefaults(): void {
  feedEnabled.value = false;
  feedMaxAgeDays.value = 30;
  feedGraceDays.value = 10;
  feedMaxPageSize.value = 100;
  sink.value = 'none';
  topicPrefix.value = 'basyx';
  mqttBroker.value = 'mqtt://broker:1883';
  mqttClientId.value = 'basyx-aas-environment';
  mqttQos.value = 1;
  mqttRetained.value = false;
  kafkaBrokers.value = 'kafka:9092';
  kafkaTopic.value = 'basyx.events';
  kafkaClientId.value = 'basyx';
  kafkaTls.value = false;
  amqpBroker.value = 'amqp://rabbitmq:5672';
  amqpAddress.value = '/queues/basyx.events';
  applySettings();
}

watch(compose, syncFromCompose, { immediate: true });
</script>
