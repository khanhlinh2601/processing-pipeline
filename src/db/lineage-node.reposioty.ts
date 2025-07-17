import { Injectable } from '@nestjs/common';
import { CustomLogger } from '../shared/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';

export interface LineageNode {
  nodeId: string;
  nodeType: string;           // 'table', 'column', 'business_term', etc.
  nodeName: string;           // e.g., 'account', 'payment'
  qualifiedName: string;      // e.g., 'neondb.public.account'
  metadata: Record<string, any>;  // flexible for business metadata
  jobId: string;
  system: string;             // e.g., 'corebank', 'crm', 'payment_gateway'
  createdAt: string;
  updatedAt: string;
  isVerified: boolean;
}

@Injectable()
export class LineageNodeRepository {
  private readonly logger = new CustomLogger(LineageNodeRepository.name);
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  
  constructor(private configService: ConfigService) {
    const client = new DynamoDBClient({
      region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
    });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = this.configService.get<string>('DYNAMODB_LINEAGE_NODES_TABLE') || 'lineage-nodes';
  }

  async createNode(node: Omit<LineageNode, 'nodeId' | 'createdAt' | 'updatedAt'>): Promise<LineageNode> {
    try {
      this.logger.log(`Creating lineage node for ${node.nodeName} of type ${node.nodeType}`);
      
      const now = new Date().toISOString();
      const newNode: LineageNode = {
        ...node,
        nodeId: `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      };
      
      const command = new PutCommand({
        TableName: this.tableName,
        Item: newNode,
      });
      
      await this.docClient.send(command);
      return newNode;
    } catch (error) {
      this.logger.error(`Failed to create lineage node: ${error.message}`);
      throw error;
    }
  }

  async findByJobId(jobId: string): Promise<LineageNode[]> {
    try {
      this.logger.log(`Finding lineage nodes for job ${jobId}`);
      
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'jobId-index',
        KeyConditionExpression: 'jobId = :jobId',
        ExpressionAttributeValues: {
          ':jobId': jobId,
        },
      });
      
      const response = await this.docClient.send(command);
      return response.Items as LineageNode[] || [];
    } catch (error) {
      this.logger.error(`Failed to find lineage nodes: ${error.message}`);
      throw error;
    }
  }

  async updateNode(nodeId: string, updateData: Partial<LineageNode>): Promise<LineageNode> {
    try {
      this.logger.log(`Updating lineage node ${nodeId}`);
      
      const now = new Date().toISOString();
      
      // Build update expression
      let updateExpression = 'SET updatedAt = :updatedAt';
      const expressionAttributeValues: Record<string, any> = {
        ':updatedAt': now,
      };
      const expressionAttributeNames: Record<string, string> = {};
      
      // Add all updateData fields to the update expression
      Object.entries(updateData).forEach(([key, value]) => {
        if (key !== 'nodeId' && key !== 'createdAt') {
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
          nodeId,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });
      
      const response = await this.docClient.send(command);
      return response.Attributes as LineageNode;
    } catch (error) {
      this.logger.error(`Failed to update lineage node: ${error.message}`);
      throw error;
    }
  }

  async deleteNode(nodeId: string): Promise<void> {
    try {
      this.logger.log(`Deleting lineage node ${nodeId}`);
      
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: {
          nodeId,
        },
      });
      
      await this.docClient.send(command);
    } catch (error) {
      this.logger.error(`Failed to delete lineage node: ${error.message}`);
      throw error;
    }
  }

  async bulkCreate(nodes: Array<Omit<LineageNode, 'nodeId' | 'createdAt' | 'updatedAt'>>): Promise<LineageNode[]> {
    try {
      this.logger.log(`Bulk creating ${nodes.length} lineage nodes`);
      
      const now = new Date().toISOString();
      const createdNodes = nodes.map(node => ({
        ...node,
        nodeId: `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      }));
      
      // DynamoDB BatchWrite has a limit of 25 items per request
      const chunkSize = 25;
      for (let i = 0; i < createdNodes.length; i += chunkSize) {
        const chunk = createdNodes.slice(i, i + chunkSize);
        
        const command = new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: chunk.map(node => ({
              PutRequest: {
                Item: node,
              },
            })),
          },
        });
        
        await this.docClient.send(command);
      }
      
      return createdNodes;
    } catch (error) {
      this.logger.error(`Failed to bulk create nodes: ${error.message}`);
      throw error;
    }
  }
}
