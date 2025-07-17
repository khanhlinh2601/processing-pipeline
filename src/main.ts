import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SQSService } from './client/sqs.client';
import { ProcessorService } from './processor/processor.service';
import { POLLING_INTERVAL_MS } from './shared/constants';
import { CustomLogger } from './shared/logger';
import { INestApplication } from '@nestjs/common';

const logger = new CustomLogger('Main');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configure port from config
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  
  await app.listen(port);
  logger.log(`Application is running on port ${port}`);
  
  // Start SQS consumer if queue URL is configured
  const queueUrl = configService.get<string>('aws.sqs.queueUrl');
  
  if (queueUrl) {
    logger.log(`Starting SQS consumer for queue: ${queueUrl}`);
    startSQSConsumer(app, queueUrl);
  } else {
    logger.warn('SQS Queue URL not configured. SQS consumer not started.');
  }
}

async function startSQSConsumer(app: INestApplication, queueUrl: string) {
  const sqsService = app.get(SQSService);
  const processorService = app.get(ProcessorService);
  const configService = app.get(ConfigService);
  
  const delay = configService.get('aws.sqs.processingDelay', 0) as number;
  
  // Polling loop
  const poll = async () => {
    try {
      // Receive messages from SQS
      logger.log('Polling SQS for messages...');
      const messages = await sqsService.receiveMessages(queueUrl);
      
      if (messages.length > 0) {
        logger.log(`Received ${messages.length} messages from SQS`);
        
        // Process each message
        for (const message of messages) {
          try {
            if (message.Body) {
              const messageBody = JSON.parse(message.Body);
              
              // Verify message has required fields
              if (messageBody.bucket && messageBody.key && messageBody.jobId) {
                // Process document
                await processorService.processDocument({
                  bucket: messageBody.bucket,
                  key: messageBody.key,
                  documentId: messageBody.documentId,
                });
                
                // Delete message from queue after successful processing
                if (message.ReceiptHandle) {
                  await sqsService.deleteMessage(queueUrl, message.ReceiptHandle);
                } else {
                  logger.warn('Message has no receipt handle, cannot delete from queue');
                }
              } else {
                logger.warn('Message missing required fields (bucket, key, jobId), skipping');
              }
            } else {
              logger.warn('Received message with no body, skipping');
            }
          } catch (error) {
            logger.error(`Error processing message: ${error.message}`, error.stack);
            // Note: Not deleting the message will cause it to return to the queue after visibility timeout
          }
        }
      } else {
        logger.debug('No messages received from SQS');
      }
    } catch (error) {
      logger.error(`Error in SQS polling: ${error.message}`, error.stack);
    }
    
    // Schedule next poll with delay
    setTimeout(poll, POLLING_INTERVAL_MS);
  };
  
  // Start polling with initial delay
  setTimeout(poll, delay);
}

bootstrap();
