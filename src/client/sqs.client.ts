import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { CustomLogger } from '../shared/logger';

@Injectable()
export class SQSService {
  private readonly sqsClient: SQSClient;
  private readonly logger = new CustomLogger(SQSService.name);

  constructor(private configService: ConfigService) {
    const awsConfig = this.configService.get('aws');
    
    // Create client configuration
    const clientConfig: any = {
      region: awsConfig.region,
    };

    // Add credentials if they exist
    if (awsConfig.credentials?.accessKeyId && awsConfig.credentials?.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: awsConfig.credentials.accessKeyId,
        secretAccessKey: awsConfig.credentials.secretAccessKey,
        ...(awsConfig.credentials.sessionToken && { sessionToken: awsConfig.credentials.sessionToken }),
      };
    }

    this.sqsClient = new SQSClient(clientConfig);
  }

  async receiveMessages(queueUrl: string, maxNumberOfMessages = 1) {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: maxNumberOfMessages,
        WaitTimeSeconds: 20, // Long polling
        AttributeNames: ['All'],
        MessageAttributeNames: ['All'],
      });

      const response = await this.sqsClient.send(command);
      return response.Messages || [];
    } catch (error) {
      this.logger.error(`Error receiving SQS messages: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteMessage(queueUrl: string, receiptHandle: string) {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient.send(command);
      this.logger.log(`Successfully deleted message: ${receiptHandle}`);
    } catch (error) {
      this.logger.error(`Error deleting SQS message: ${error.message}`, error.stack);
      throw error;
    }
  }

  async sendMessage(queueUrl: string, messageBody: string, messageAttributes?: any) {
    try {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: messageBody,
        MessageAttributes: messageAttributes,
      });

      const result = await this.sqsClient.send(command);
      this.logger.log(`Successfully sent message: ${result.MessageId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error sending SQS message: ${error.message}`, error.stack);
      throw error;
    }
  }
} 