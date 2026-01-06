import mqtt from 'mqtt';
import config from '../config/config.js';

class MQTTPublisher {
  constructor() {
    this.client = null;
    this.connected = false;
    this.messageQueue = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log('📡 Connecting to MQTT broker...');
      
      this.client = mqtt.connect({
        host: config.MQTT_BROKER,
        port: config.MQTT_PORT,
        protocol: 'mqtts',
        username: config.MQTT_USERNAME,
        password: config.MQTT_PASSWORD,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        keepalive: 60,
        clean: true
      });

      this.client.on('connect', () => {
        console.log('✅ Connected to MQTT broker');
        this.connected = true;
        this.processQueue();
        resolve();
      });

      this.client.on('error', (err) => {
        console.error('❌ MQTT connection error:', err.message);
        this.connected = false;
        reject(err);
      });

      this.client.on('offline', () => {
        console.warn('⚠️  MQTT client offline');
        this.connected = false;
      });

      this.client.on('reconnect', () => {
        console.log('🔄 MQTT reconnecting...');
      });
    });
  }

  publishGPS(vehicleNumber, gpsData) {
    const topic = `vehicle/${vehicleNumber}/gps`;
    const message = JSON.stringify({
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      speed: gpsData.speed || 0,
      heading: gpsData.heading || 0,
      timestamp: new Date().toISOString()
    });

    if (!this.connected) {
      this.messageQueue.push({ topic, message });
      return;
    }

    this.client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        console.error(`❌ Failed to publish GPS for ${vehicleNumber}:`, err.message);
        this.messageQueue.push({ topic, message });
      }
    });
  }

  publishStatus(vehicleNumber, status) {
    const topic = `vehicle/${vehicleNumber}/status`;
    const message = JSON.stringify({
      status,
      timestamp: new Date().toISOString()
    });

    if (!this.connected) {
      this.messageQueue.push({ topic, message });
      return;
    }

    this.client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        console.error(`❌ Failed to publish status for ${vehicleNumber}:`, err.message);
      }
    });
  }

  processQueue() {
    if (this.messageQueue.length === 0) return;

    console.log(`📤 Processing ${this.messageQueue.length} queued messages...`);
    const queue = [...this.messageQueue];
    this.messageQueue = [];

    queue.forEach(({ topic, message }) => {
      this.client.publish(topic, message, { qos: 1 });
    });
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      console.log('🔌 MQTT client disconnected');
    }
  }
}

export default new MQTTPublisher();