import { defineStore } from 'pinia';

export const useMqttStore = defineStore('mqtt', {
  state: () => ({
    topicValues: {},
    status: 'disconnected', // 'connecting' | 'connected' | 'disconnected'
  }),
  actions: {
    setTopicValue(topic, value) {
      this.topicValues[topic] = value;
    },
    setStatus(status) {
      this.status = status;
    },
  },
  getters: {
    getValue: (state) => (topic) => state.topicValues[topic] ?? null,
  },
});
