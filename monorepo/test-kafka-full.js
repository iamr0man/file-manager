const { Kafka } = require('kafkajs');
const readline = require('readline');

const kafka = new Kafka({
  clientId: 'file-manager-test-client',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'test-group' });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Event templates for testing
const createTestUploadEvent = (fileId = 'test-file-123') => ({
  id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  timestamp: new Date(),
  source: 'file-manager-api',
  version: '1.0',
  type: 'file.uploaded',
  data: {
    fileId,
    fileName: 'test-document.pdf',
    fileSize: 1024576,
    mimeType: 'application/pdf',
    uploadedBy: 'test-user',
    url: 'http://localhost:9000/files/files/application/test-document.pdf'
  }
});

const createTestDeleteEvent = (fileId = 'test-file-123') => ({
  id: `delete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  timestamp: new Date(),
  source: 'file-manager-api',
  version: '1.0',
  type: 'file.deleted',
  data: {
    fileId,
    fileName: 'test-document.pdf',
    deletedBy: 'test-user'
  }
});

const publishTestEvent = async (event) => {
  try {
    await producer.send({
      topic: 'file-events',
      messages: [
        {
          key: event.data.fileId,
          value: JSON.stringify(event),
          timestamp: event.timestamp.getTime().toString()
        }
      ]
    });
    console.log(`✅ Published ${event.type} event for file: ${event.data.fileId}`);
  } catch (error) {
    console.error('❌ Error publishing event:', error);
  }
};

const startConsumer = async () => {
  console.log('🚀 Starting Kafka consumer...');
  
  await consumer.connect();
  console.log('✅ Consumer connected to Kafka');
  
  await consumer.subscribe({ topic: 'file-events', fromBeginning: true });
  console.log('📡 Subscribed to file-events topic');
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        
        // Color coding for different events
        const eventColor = event.type === 'file.uploaded' ? '\x1b[32m' : '\x1b[31m'; // green/red
        const resetColor = '\x1b[0m';
        
        console.log(`\n${eventColor}🎉 NEW EVENT RECEIVED:${resetColor}`);
        console.log('==========================================');
        console.log(`📅 Timestamp: ${event.timestamp}`);
        console.log(`🏷️  Event Type: ${eventColor}${event.type}${resetColor}`);
        console.log(`🔑 Event ID: ${event.id}`);
        console.log(`📊 Partition: ${partition}`);
        console.log(`🔑 Message Key: ${message.key?.toString()}`);
        console.log('\n📋 Event Data:');
        console.log(JSON.stringify(event.data, null, 2));
        console.log('==========================================\n');
        
        // Show interactive menu again
        showMenu();
      } catch (error) {
        console.error('❌ Error parsing message:', error);
        console.log('Raw message:', message.value.toString());
      }
    },
  });
};

const showMenu = () => {
  console.log('\n📋 KAFKA TESTING MENU:');
  console.log('1. Publish test upload event');
  console.log('2. Publish test delete event');
  console.log('3. Show consumer status');
  console.log('4. Exit');
  console.log('\nEvents from your API will appear automatically above.');
  console.log('Choose an option (1-4): ');
};

const handleUserInput = async (input) => {
  const choice = input.trim();
  
  switch (choice) {
    case '1':
      const uploadEvent = createTestUploadEvent();
      await publishTestEvent(uploadEvent);
      break;
      
    case '2':
      const deleteEvent = createTestDeleteEvent();
      await publishTestEvent(deleteEvent);
      break;
      
    case '3':
      console.log('📊 Consumer Status: Running and listening for events...');
      console.log('📡 Topic: file-events');
      console.log('👥 Group: test-group');
      break;
      
    case '4':
      console.log('👋 Shutting down...');
      await cleanup();
      process.exit(0);
      break;
      
    default:
      console.log('❌ Invalid choice. Please select 1-4.');
      break;
  }
  
  showMenu();
};

const cleanup = async () => {
  try {
    await producer.disconnect();
    await consumer.disconnect();
    console.log('✅ Kafka connections closed');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
};

const main = async () => {
  try {
    console.log('🔧 Initializing Kafka testing environment...');
    
    // Connect producer
    await producer.connect();
    console.log('✅ Producer connected');
    
    // Start consumer
    await startConsumer();
    
    console.log('\n🎉 Kafka testing environment ready!');
    console.log('💡 This script will show all events from your file manager API');
    console.log('💡 You can also publish test events to verify the system');
    
    showMenu();
    
    // Handle user input
    rl.on('line', handleUserInput);
    
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const errorTypes = ['unhandledRejection', 'uncaughtException'];
const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

errorTypes.forEach(type => {
  process.on(type, async e => {
    try {
      console.log(`\nprocess.on ${type}`);
      console.error(e);
      await cleanup();
      process.exit(0);
    } catch (_) {
      process.exit(1);
    }
  });
});

signalTraps.forEach(type => {
  process.once(type, async () => {
    try {
      await cleanup();
    } finally {
      process.kill(process.pid, type);
    }
  });
});

main().catch(console.error); 