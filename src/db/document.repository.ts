import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBService } from '../client/dynamo.client';
import { CustomLogger } from '../shared/logger';
import { DocumentStatus, SourceType } from '../shared/constants';
import { v4 as uuidv4 } from 'uuid';

export interface DocumentRecord {
  id: string;
  s3Bucket: string;
  s3Key: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  llmResponse?: string;
  schemaVersion?: string;
}

export interface DocumentTermMapping {
  id: string;
  documentId: string;
  term: string;
  mappedAttribute: string;
  logicalEntity: string;
  confidenceScore?: number;
  sourceType: SourceType;
  schemaVersion: string;
  status: string;
  createdAt: string;
}

@Injectable()
export class DocumentRepository {
  private readonly documentTableName: string;
  private readonly termMappingTableName: string;
  private readonly logger = new CustomLogger(DocumentRepository.name);

  constructor(
    private readonly dynamoDBService: DynamoDBService,
    private readonly configService: ConfigService,
  ) {
    const docTableName = this.configService.get<string>('aws.dynamodb.documentTableName');
    const termTableName = this.configService.get<string>('aws.dynamodb.documentTermMappingTableName');
    
    if (!docTableName || !termTableName) {
      throw new Error('DynamoDB table names are not configured properly');
    }
    
    this.documentTableName = docTableName;
    this.termMappingTableName = termTableName;
  }

  async createDocument(s3Bucket: string, s3Key: string): Promise<DocumentRecord> {
    const now = new Date().toISOString();
    
    const document: DocumentRecord = {
      id: uuidv4(),
      s3Bucket,
      s3Key,
      status: DocumentStatus.INITIAL,
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamoDBService.putItem(this.documentTableName, document);
    this.logger.log(`Created document record with ID: ${document.id}`);
    
    return document;
  }

  async updateDocumentStatus(
    documentId: string,
    status: DocumentStatus,
    llmResponse?: string,
    schemaVersion?: string,
  ): Promise<DocumentRecord> {
    const now = new Date().toISOString();
    
    const updateExpression = 'SET #status = :status, updatedAt = :updatedAt' +
      (llmResponse ? ', llmResponse = :llmResponse' : '') +
      (schemaVersion ? ', schemaVersion = :schemaVersion' : '');
    
    const expressionAttributeValues: Record<string, any> = {
      ':status': status,
      ':updatedAt': now,
    };
    
    if (llmResponse) {
      expressionAttributeValues[':llmResponse'] = llmResponse;
    }
    
    if (schemaVersion) {
      expressionAttributeValues[':schemaVersion'] = schemaVersion;
    }
    
    const expressionAttributeNames = {
      '#status': 'status',
    };

    const result = await this.dynamoDBService.updateItem(
      this.documentTableName,
      { id: documentId },
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames,
    );

    this.logger.log(`Updated document status to ${status} for ID: ${documentId}`);
    return result as DocumentRecord;
  }

  async getDocument(documentId: string): Promise<DocumentRecord | null> {
    const result = await this.dynamoDBService.getItem(
      this.documentTableName,
      { id: documentId },
    );
    
    if (!result) {
      this.logger.warn(`Document with ID ${documentId} not found`);
      return null;
    }
    
    return result as DocumentRecord;
  }

  async saveTermMappings(
    documentId: string,
    mappings: Array<{
      term: string;
      mappedAttribute: string;
      logicalEntity: string;
      confidenceScore?: number;
    }>,
    schemaVersion: string,
    sourceType: SourceType = SourceType.LLM,
  ): Promise<DocumentTermMapping[]> {
    const now = new Date().toISOString();
    const savedMappings: DocumentTermMapping[] = [];
    
    for (const mapping of mappings) {
      const termMapping: DocumentTermMapping = {
        id: uuidv4(),
        documentId,
        term: mapping.term,
        mappedAttribute: mapping.mappedAttribute,
        logicalEntity: mapping.logicalEntity,
        confidenceScore: mapping.confidenceScore,
        sourceType,
        schemaVersion,
        status: 'ACTIVE',
        createdAt: now,
      };
      
      await this.dynamoDBService.putItem(this.termMappingTableName, termMapping);
      savedMappings.push(termMapping);
    }
    
    this.logger.log(`Saved ${savedMappings.length} term mappings for document ID: ${documentId}`);
    return savedMappings;
  }

  async getTermMappings(documentId: string): Promise<DocumentTermMapping[]> {
    const result = await this.dynamoDBService.query(
      this.termMappingTableName,
      'documentId = :documentId',
      { ':documentId': documentId },
    );
    
    return result as DocumentTermMapping[];
  }
} 