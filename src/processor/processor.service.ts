import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomLogger } from '../shared/logger';
import { SQSService } from '../client/sqs.client';
import { DocumentRepository, DocumentRecord } from '../db/document.repository';
import { FetchSchemaService, Schema } from '../fetch-schema/fetch-schema.service';
import { DocumentStatus, SourceType } from '../shared/constants';
import { S3Service } from '../client/s3.client';
import { BedrockService } from '../client/bedrock.client';

interface DocumentExtraction {
  entities: any[];
  fields: any[];
  mapping: any[];
}

interface TermMapping {
  term: string;
  mappedAttribute: string; // Physical table/column
  logicalEntity: string;   // Business context
  confidenceScore?: number;
}

@Injectable()
export class ProcessorService {
  private readonly logger = new CustomLogger(ProcessorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
    private readonly sqsService: SQSService,
    private readonly bedrockService: BedrockService,
    private readonly documentRepository: DocumentRepository,
    private readonly fetchSchemaService: FetchSchemaService,
  ) {}

  async processMessage(messageBody: any): Promise<void> {
    try {
      this.logger.log(`Processing message: ${JSON.stringify(messageBody)}`);
      
      const { s3Bucket, s3Key } = messageBody;
      
      if (!s3Bucket || !s3Key) {
        throw new Error('Invalid message format. Missing s3Bucket or s3Key.');
      }
      
      // Create initial document record
      const document = await this.documentRepository.createDocument(s3Bucket, s3Key);
      
      // Fetch document extraction from S3
      const extraction = await this.s3Service.getObject(s3Bucket, s3Key);
      
      // Fetch schema
      const schema = await this.fetchSchemaService.fetchSchema();
      
      // Update status to PROCESSING
      await this.documentRepository.updateDocumentStatus(
        document.id,
        DocumentStatus.PROCESSING,
        undefined,
        schema.version,
      );
      
      // Process with LLM
      const result = await this.processWithLLM(extraction, schema, document);
      
      // Save results
      if (result.requiresManualReview) {
        await this.handleManualReview(document, result.llmResponse);
      } else {
        await this.saveProcessingResults(document, result.mappings, result.llmResponse, schema.version);
      }
      
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async processWithLLM(
    extraction: DocumentExtraction,
    schema: Schema,
    document: DocumentRecord,
  ): Promise<{
    mappings: TermMapping[];
    llmResponse: string;
    requiresManualReview: boolean;
  }> {
    try {
      // Build prompt
      const prompt = this.buildLLMPrompt(extraction, schema);
      
      // Invoke Bedrock
      const llmResponse = await this.bedrockService.invokeModel(prompt);
      
      // Parse LLM response
      const { mappings, requiresManualReview } = this.parseLLMResponse(llmResponse);
      
      return {
        mappings,
        llmResponse,
        requiresManualReview,
      };
    } catch (error) {
      this.logger.error(`Error processing with LLM: ${error.message}`, error.stack);
      throw error;
    }
  }

  private buildLLMPrompt(extraction: DocumentExtraction, schema: Schema): string {
    // Format the schema for the prompt
    const formattedSchema = this.fetchSchemaService.formatSchemaForPrompt(schema);
    
    // Build the prompt
    const prompt = `
You are a data mapping assistant. Your task is to map extracted terms from a document to the correct database attributes.

SCHEMA DEFINITION:
${formattedSchema}

DOCUMENT EXTRACTION:
Entities: ${JSON.stringify(extraction.entities, null, 2)}
Fields: ${JSON.stringify(extraction.fields, null, 2)}
Existing Mappings: ${JSON.stringify(extraction.mapping, null, 2)}

TASK:
Map each term to the appropriate database attribute based on the provided schema.
For each term, provide:
1. The term itself
2. The mapped attribute in format "table.column"
3. The logical entity it belongs to
4. A confidence score between 0 and 1

Return your response in the following JSON format:
{
  "mappings": [
    {
      "term": "example term",
      "mappedAttribute": "table_name.column_name",
      "logicalEntity": "Logical Entity Name",
      "confidenceScore": 0.95
    }
  ],
  "explanation": "Brief explanation of your mapping decisions"
}
`;

    return prompt;
  }

  private parseLLMResponse(llmResponse: string): {
    mappings: TermMapping[];
    requiresManualReview: boolean;
  } {
    try {
      // Extract JSON from the response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        this.logger.warn('Could not find valid JSON in LLM response');
        return { mappings: [], requiresManualReview: true };
      }
      
      const jsonString = jsonMatch[0];
      const parsed = JSON.parse(jsonString);
      
      // Check if we need manual review
      const requiresManualReview = this.shouldRequireManualReview(parsed);
      
      return {
        mappings: parsed.mappings || [],
        requiresManualReview,
      };
    } catch (error) {
      this.logger.error(`Error parsing LLM response: ${error.message}`, error.stack);
      return { mappings: [], requiresManualReview: true };
    }
  }

  private shouldRequireManualReview(parsedResponse: any): boolean {
    // Check for underscores in keys or other validation issues
    const hasInvalidData = parsedResponse.mappings?.some(mapping => {
      return (
        !mapping.term || 
        !mapping.mappedAttribute || 
        !mapping.logicalEntity ||
        typeof mapping.mappedAttribute !== 'string' ||
        mapping.mappedAttribute.includes('_') // Check for underscores in keys
      );
    });
    
    return hasInvalidData || false;
  }

  private async handleManualReview(document: DocumentRecord, llmResponse: string): Promise<void> {
    try {
      // Update document status
      await this.documentRepository.updateDocumentStatus(
        document.id,
        DocumentStatus.MANUAL_REVIEW,
        llmResponse,
      );
      
      // Send to manual review queue
      const manualReviewQueueUrl = this.configService.get<string>('aws.sqs.manualReviewQueueUrl');
      
      if (manualReviewQueueUrl) {
        await this.sqsService.sendMessage(
          manualReviewQueueUrl,
          JSON.stringify({
            documentId: document.id,
            s3Bucket: document.s3Bucket,
            s3Key: document.s3Key,
            reason: 'Invalid mappings detected',
          }),
        );
        
        this.logger.log(`Sent document ${document.id} for manual review`);
      } else {
        this.logger.warn('Manual review queue URL not configured. Skipping queue notification.');
      }
    } catch (error) {
      this.logger.error(`Error handling manual review: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async saveProcessingResults(
    document: DocumentRecord,
    mappings: TermMapping[],
    llmResponse: string,
    schemaVersion: string,
  ): Promise<void> {
    try {
      // Update document status to COMPLETED
      await this.documentRepository.updateDocumentStatus(
        document.id,
        DocumentStatus.COMPLETED,
        llmResponse,
        schemaVersion,
      );
      
      // Save term mappings
      await this.documentRepository.saveTermMappings(
        document.id,
        mappings,
        schemaVersion,
        SourceType.LLM,
      );
      
      this.logger.log(`Successfully processed document ${document.id} with ${mappings.length} mappings`);
    } catch (error) {
      this.logger.error(`Error saving processing results: ${error.message}`, error.stack);
      throw error;
    }
  }
} 