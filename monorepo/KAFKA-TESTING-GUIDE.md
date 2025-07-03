# 🎯 **Kafka Testing Guide - File Manager Platform**

## 📋 **Overview**

Your file manager uses Kafka to publish events when files are uploaded, deleted, or synchronized. This guide shows you how to test and monitor these events.

## 🏗️ **Architecture**

```
File Upload/Delete/Sync → Kafka Producer → file-events Topic → Your Consumers
```

## 🚀 **Quick Start Testing**

### **1. Prerequisites**
```bash
# Start all services
npm run docker:up

# Install dependencies
npm install

# Wait for all services to be ready (~30 seconds)
docker-compose logs kafka
```

### **2. Start Real-Time Event Monitoring**
```bash
# Terminal 1: Start event consumer
npm run kafka:consume
```

### **3. Start Your File Manager API**
```bash
# Terminal 2: Start the API
cd apps/api
npm run dev
```

### **4. Start Frontend (Optional)**
```bash
# Terminal 3: Start frontend for UI testing
cd apps/web  
npm run dev
```

## 🧪 **Testing Methods**

### **Method 1: Interactive Testing (Recommended)**
```bash
# Start comprehensive testing environment
npm run kafka:test
```

This will:
- ✅ Connect to Kafka broker
- ✅ Start consumer to listen for events
- ✅ Show menu to publish test events
- ✅ Display all events in real-time with color coding
- ✅ Allow you to test both producer and consumer

### **Method 2: Frontend UI Testing**
1. Open frontend: `http://localhost:3000`
2. Start event consumer: `npm run kafka:consume`
3. Upload files through UI
4. Delete files through UI
5. Watch events appear in consumer terminal

### **Method 3: API Testing with cURL**
```bash
# Start event consumer
npm run kafka:consume

# Upload a file via API
curl -X POST http://localhost:3001/api/files/upload \
  -F "file=@test-file.txt" \
  -F "uploadedBy=test-user"

# Delete a file via tRPC
curl -X POST http://localhost:3001/trpc/delete \
  -H "Content-Type: application/json" \
  -d '{"id":"file-id-here","deletedBy":"test-user"}'
```

### **Method 4: Sync Job Testing**
```bash
# Start event consumer
npm run kafka:consume

# Run manual sync
cd apps/api
npm run sync:now
```

## 📊 **Event Structure Examples**

### **File Upload Event**
```json
{
  "id": "upload_1703123456789_abc123",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "source": "file-manager-api",
  "version": "1.0",
  "type": "file.uploaded",
  "data": {
    "fileId": "cm3abc123def456",
    "fileName": "document.pdf",
    "fileSize": 2048576,
    "mimeType": "application/pdf",
    "uploadedBy": "user123",
    "url": "http://localhost:9000/files/files/application/uuid-document.pdf"
  }
}
```

### **File Delete Event**
```json
{
  "id": "delete_1703123456789_def456",
  "timestamp": "2024-01-01T12:05:00.000Z",
  "source": "file-manager-api",
  "version": "1.0",
  "type": "file.deleted",
  "data": {
    "fileId": "cm3abc123def456",
    "fileName": "document.pdf",
    "deletedBy": "user123"
  }
}
```

## 🔧 **Advanced Testing**

### **Creating a Custom Consumer**
```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'my-consumer',
  brokers: ['localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'my-group' });

const run = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'file-events' });
  
  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      
      // Your custom logic here
      if (event.type === 'file.uploaded') {
        console.log(`New file uploaded: ${event.data.fileName}`);
        // Trigger downstream processes...
      }
    },
  });
};

run().catch(console.error);
```

### **Testing with Kafka CLI Tools**
```bash
# Using Docker exec to access Kafka container
docker exec -it $(docker ps -f name=kafka -q) bash

# List topics
/opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092

# Consume from beginning
/opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic file-events \
  --from-beginning \
  --formatter kafka.tools.DefaultMessageFormatter \
  --property print.key=true \
  --property print.value=true \
  --property print.timestamp=true
```

## 🐛 **Troubleshooting**

### **Common Issues**

1. **"Kafka not connected" warnings**
   ```bash
   # Check if Kafka is running
   docker ps | grep kafka
   
   # Check Kafka logs
   docker-compose logs kafka
   
   # Restart services
   npm run docker:down && npm run docker:up
   ```

2. **No events appearing**
   ```bash
   # Check API logs
   cd apps/api && npm run dev
   
   # Check if producer is initialized
   # Look for "✅ Kafka producer connected" in API logs
   ```

3. **Consumer connection errors**
   ```bash
   # Wait for Kafka to be fully ready
   sleep 30
   
   # Try connecting again
   npm run kafka:consume
   ```

### **Verification Steps**

1. **✅ Kafka Running**: `docker ps | grep kafka`
2. **✅ Topic Exists**: Check with CLI tools or consumer connects
3. **✅ Producer Connected**: API logs show "Kafka producer connected"
4. **✅ Events Publishing**: Consumer receives events when files are uploaded/deleted

## 📈 **Monitoring Production**

### **Event Volume Tracking**
```javascript
// Add to your consumer
let eventCount = 0;
let lastHour = new Date().getHours();

// In eachMessage handler:
eventCount++;
const currentHour = new Date().getHours();

if (currentHour !== lastHour) {
  console.log(`Events processed last hour: ${eventCount}`);
  eventCount = 0;
  lastHour = currentHour;
}
```

### **Error Rate Monitoring**
```javascript
// Track failed vs successful events
let successCount = 0;
let errorCount = 0;

// In your downstream processing:
try {
  await processEvent(event);
  successCount++;
} catch (error) {
  errorCount++;
  console.error('Event processing failed:', error);
}
```

## 🎯 **Best Practices**

1. **Consumer Groups**: Use different group IDs for different services
2. **Error Handling**: Always catch and log consumer errors
3. **Graceful Shutdown**: Properly disconnect consumers
4. **Monitoring**: Track event volume and processing latency
5. **Idempotency**: Handle duplicate events gracefully

## 📚 **Next Steps**

1. **Create Consumers**: Build services that react to file events
2. **Add More Events**: Extend with file preview, share events, etc.
3. **Monitoring**: Add metrics collection (Prometheus, etc.)
4. **Scaling**: Use multiple Kafka partitions for high volume

---

## 🚀 **Quick Test Commands**

```bash
# Start everything
npm run docker:up
npm install

# Test Kafka interactively  
npm run kafka:test

# Or just consume events
npm run kafka:consume

# Start API
cd apps/api && npm run dev

# Upload test file
curl -X POST http://localhost:3001/api/files/upload -F "file=@README.md"
```

**Happy Testing! 🎉**
