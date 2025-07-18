import { Injectable } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DocumentStatus } from '../shared/constants';
import { CustomLogger } from '../shared/logger';
import { ConfigService } from '@nestjs/config';

export interface DocumentJob {
  jobId: string;                       // UUID for tracking processing job
  documentId: string;                  // Unique identifier for the document
  bucket: string;                      // S3 bucket storing the document
  key: string;                         // S3 key (path) of the document
  status: DocumentStatus;              // Enum status (e.g., PENDING, PROCESSING, COMPLETED, FAILED)

  createdAt: string;                   // ISO timestamp when the job was created
  updatedAt: string;                   // ISO timestamp for last update (for UI tracking)
  timestamp: string;                   // DynamoDB sort key (e.g., createdAt or updatedAt)

  originalName?: string;               // Optional: original file name (useful for UI)
  completedAt?: string;                // Optional: ISO timestamp when completed
  errorMessage?: string;               // Optional: detailed error message if failed
  textractFeatures?: string[];         // Optional: Textract features used (e.g., ["TABLES", "FORMS"])
  textractJobId?: string;              // Optional: AWS Textract Job ID for traceability
}

@Injectable()
export class DocumentJobRepository {
  private readonly logger = new CustomLogger(DocumentJobRepository.name);
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  
  constructor(private configService: ConfigService) {
    const client = new DynamoDBClient({
      region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
    });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = this.configService.get<string>('DYNAMODB_DOCUMENT_TABLE') || 'document-jobs';
  }
  
  async updateStatus(documentId: string, status: DocumentStatus, errorMessage?: string): Promise<void> {
    try {
      this.logger.log(`Updating job ${documentId} status to ${status}`);
      
      // First, find the job to get its timestamp
      const jobs = await this.findByDocumentId(documentId);
      
      if (!jobs || jobs.length === 0) {
        this.logger.warn(`Document job not found for update with documentId ${documentId}`);
        throw new Error(`Document job not found with documentId ${documentId}`);
      }
      
      // Use the most recent job (assuming they're sorted by timestamp in descending order)
      const job = jobs[0];
      
      const now = new Date().toISOString();
      let updateExpression = 'SET #status = :status, updatedAt = :updatedAt';
      
      const expressionAttributeValues: Record<string, any> = {
        ':status': status,
        ':updatedAt': now,
      };
      
      if (errorMessage) {
        updateExpression += ', errorMessage = :errorMessage';
        expressionAttributeValues[':errorMessage'] = errorMessage;
      }
      
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: {
          documentId: job.documentId,
          timestamp: job.timestamp
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: expressionAttributeValues,
      });
      
      await this.docClient.send(command);
      
    } catch (error) {
      this.logger.error(`Failed to update job status: ${error.message}`);
      throw error;
    }
  }

  async findById(jobId: string): Promise<DocumentJob | null> {
    try {
      this.logger.log(`Finding job with ID ${jobId}`);
      
      const command = new GetCommand({
        TableName: this.tableName,
        Key: {
          jobId,
        },
      });
      
      const response = await this.docClient.send(command);
      return response.Item as DocumentJob || null;
      
    } catch (error) {
      this.logger.error(`Failed to find job ${jobId}: ${error.message}`);
      throw error;
    }
  }
  
  async findByDocumentId(documentId: string): Promise<DocumentJob[]> {
    try {
      this.logger.log(`Finding jobs for document ${documentId}`);
      
      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'documentId = :documentId',
        ExpressionAttributeValues: {
          ':documentId': documentId,
        },
        ScanIndexForward: false, // Get the newest jobs first
      });
      
      const response = await this.docClient.send(command);
      return response.Items as DocumentJob[] || [];
      
    } catch (error) {
      this.logger.error(`Failed to find jobs for document ${documentId}: ${error.message}`);
      throw error;
    }
  }
  
  async createJob(job: DocumentJob): Promise<void> {
    try {
      this.logger.log(`Creating job for document ${job.documentId}`);
      
      const command = new PutCommand({
        TableName: this.tableName,
        Item: job,
      });
      
      await this.docClient.send(command);
      
    } catch (error) {
      this.logger.error(`Failed to create job: ${error.message}`);
      throw error;
    }
  }
}
