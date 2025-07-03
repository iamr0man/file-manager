const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'file-manager-test-consumer',
  brokers: ['localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'test-group' });

const run = async () => {
  console.log('🚀 Starting Kafka consumer...');
  
  await consumer.connect();
  console.log('✅ Connected to Kafka');
  
  await consumer.subscribe({ topic: 'file-events', fromBeginning: true });
  console.log('📡 Subscribed to file-events topic');
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        console.log('\n🎉 NEW EVENT RECEIVED:');
        console.log('==========================================');
        console.log(`📅 Timestamp: ${event.timestamp}`);
        console.log(`🏷️  Event Type: ${event.type}`);
        console.log(`🔑 Event ID: ${event.id}`);
        console.log(`📊 Partition: ${partition}`);
        console.log(`🔑 Message Key: ${message.key?.toString()}`);
        console.log('\n📋 Event Data:');
        console.log(JSON.stringify(event.data, null, 2));
        console.log('==========================================\n');
      } catch (error) {
        console.error('❌ Error parsing message:', error);
        console.log('Raw message:', message.value.toString());
      }
    },
  });
};

const errorTypes = ['unhandledRejection', 'uncaughtException'];
const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

errorTypes.forEach(type => {
  process.on(type, async e => {
    try {
      console.log(`process.on ${type}`);
      console.error(e);
      await consumer.disconnect();
      process.exit(0);
    } catch (_) {
      process.exit(1);
    }
  });
});

signalTraps.forEach(type => {
  process.once(type, async () => {
    try {
      await consumer.disconnect();
    } finally {
      process.kill(process.pid, type);
    }
  });
});

run().catch(console.error); 