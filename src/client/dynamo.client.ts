import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { CustomLogger } from '../shared/logger';

@Injectable()
export class DynamoDBService {
  private readonly ddbClient: DynamoDBClient;
  private readonly ddbDocClient: DynamoDBDocumentClient;
  private readonly logger = new CustomLogger(DynamoDBService.name);

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

    this.ddbClient = new DynamoDBClient(clientConfig);
    
    this.ddbDocClient = DynamoDBDocumentClient.from(this.ddbClient);
  }

  async putItem(tableName: string, item: Record<string, any>) {
    try {
      const command = new PutCommand({
        TableName: tableName,
        Item: item,
      });

      await this.ddbDocClient.send(command);
      this.logger.log(`Successfully put item in table: ${tableName}`);
    } catch (error) {
      this.logger.error(`Error putting item in DynamoDB: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getItem(tableName: string, key: Record<string, any>) {
    try {
      const command = new GetCommand({
        TableName: tableName,
        Key: key,
      });

      const response = await this.ddbDocClient.send(command);
      return response.Item;
    } catch (error) {
      this.logger.error(`Error getting item from DynamoDB: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateItem(tableName: string, key: Record<string, any>, updateExpression: string, expressionAttributeValues: Record<string, any>, expressionAttributeNames?: Record<string, string>) {
    try {
      const command = new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW',
      });

      const response = await this.ddbDocClient.send(command);
      return response.Attributes;
    } catch (error) {
      this.logger.error(`Error updating item in DynamoDB: ${error.message}`, error.stack);
      throw error;
    }
  }

  async query(tableName: string, keyConditionExpression: string, expressionAttributeValues: Record<string, any>, expressionAttributeNames?: Record<string, string>) {
    try {
      const command = new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
      });

      const response = await this.ddbDocClient.send(command);
      return response.Items;
    } catch (error) {
      this.logger.error(`Error querying DynamoDB: ${error.message}`, error.stack);
      throw error;
    }
  }
} 