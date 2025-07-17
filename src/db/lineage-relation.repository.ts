import { Injectable } from '@nestjs/common';
import { CustomLogger } from '../shared/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';

export interface LineageRelationship {
  relationshipId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: string;     // e.g., 'foreign_key', 'business_reference'
  businessRule?: Record<string, any>;
  sourceMeta?: Record<string, any>;  // column information of source
  targetMeta?: Record<string, any>;  // column information of target
  confidence?: number;           // optional AI confidence
  isVerified: boolean;
  jobId: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class LineageRelationshipRepository {
  private readonly logger = new CustomLogger(LineageRelationshipRepository.name);
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  
  constructor(private configService: ConfigService) {
    const client = new DynamoDBClient({
      region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
    });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = this.configService.get<string>('DYNAMODB_LINEAGE_RELATIONSHIPS_TABLE') || 'lineage-relationships';
  }

  async createRelationship(relationship: Omit<LineageRelationship, 'relationshipId' | 'createdAt' | 'updatedAt'>): Promise<LineageRelationship> {
    try {
      this.logger.log(`Creating lineage relationship from ${relationship.sourceNodeId} to ${relationship.targetNodeId}`);
      
      const now = new Date().toISOString();
      const newRelationship: LineageRelationship = {
        ...relationship,
        relationshipId: `rel-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      };
      
      const command = new PutCommand({
        TableName: this.tableName,
        Item: newRelationship,
      });
      
      await this.docClient.send(command);
      return newRelationship;
    } catch (error) {
      this.logger.error(`Failed to create lineage relationship: ${error.message}`);
      throw error;
    }
  }

  async findByJobId(jobId: string): Promise<LineageRelationship[]> {
    try {
      this.logger.log(`Finding lineage relationships for job ${jobId}`);
      
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'jobId-index',
        KeyConditionExpression: 'jobId = :jobId',
        ExpressionAttributeValues: {
          ':jobId': jobId,
        },
      });
      
      const response = await this.docClient.send(command);
      return response.Items as LineageRelationship[] || [];
    } catch (error) {
      this.logger.error(`Failed to find lineage relationships: ${error.message}`);
      throw error;
    }
  }

  async updateRelationship(relationshipId: string, updateData: Partial<LineageRelationship>): Promise<LineageRelationship> {
    try {
      this.logger.log(`Updating lineage relationship ${relationshipId}`);
      
      const now = new Date().toISOString();
      
      // Build update expression
      let updateExpression = 'SET updatedAt = :updatedAt';
      const expressionAttributeValues: Record<string, any> = {
        ':updatedAt': now,
      };
      const expressionAttributeNames: Record<string, string> = {};
      
      // Add all updateData fields to the update expression
      Object.entries(updateData).forEach(([key, value]) => {
        if (key !== 'relationshipId' && key !== 'createdAt') {
          const attributeName = `#${key}`;
          const attributeValue = `:${key}`;
          updateExpression += `, ${attributeName} = ${attributeValue}`;
          expressionAttributeNames[attributeName] = key;
          expressionAttributeValues[attributeValue] = value;
        }
      });
      
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: {
          relationshipId,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });
      
      const response = await this.docClient.send(command);
      return response.Attributes as LineageRelationship;
    } catch (error) {
      this.logger.error(`Failed to update lineage relationship: ${error.message}`);
      throw error;
    }
  }

  async deleteRelationship(relationshipId: string): Promise<void> {
    try {
      this.logger.log(`Deleting lineage relationship ${relationshipId}`);
      
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: {
          relationshipId,
        },
      });
      
      await this.docClient.send(command);
    } catch (error) {
      this.logger.error(`Failed to delete lineage relationship: ${error.message}`);
      throw error;
    }
  }

  async bulkCreate(relationships: Array<Omit<LineageRelationship, 'relationshipId' | 'createdAt' | 'updatedAt'>>): Promise<LineageRelationship[]> {
    try {
      this.logger.log(`Bulk creating ${relationships.length} lineage relationships`);
      
      const now = new Date().toISOString();
      const createdRelationships = relationships.map(rel => ({
        ...rel,
        relationshipId: `rel-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      }));
      
      // DynamoDB BatchWrite has a limit of 25 items per request
      const chunkSize = 25;
      for (let i = 0; i < createdRelationships.length; i += chunkSize) {
        const chunk = createdRelationships.slice(i, i + chunkSize);
        
        const command = new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: chunk.map(relationship => ({
              PutRequest: {
                Item: relationship,
              },
            })),
          },
        });
        
        await this.docClient.send(command);
      }
      
      return createdRelationships;
    } catch (error) {
      this.logger.error(`Failed to bulk create relationships: ${error.message}`);
      throw error;
    }
  }
}
