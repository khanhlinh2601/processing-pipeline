import { Controller, Post, Body, Get, Param, HttpStatus } from '@nestjs/common';
import { ProcessorService, LineageResponse } from './processor.service';
import { CustomLogger } from '../shared/logger';
import { DocumentMappingResponse, DocumentProcessRequest } from './interfaces';

export interface ProcessDocumentDto {
  bucket: string;
  key: string;
  documentId: string;
  jobId?: string;
}

export interface ProcessDocumentResponse {
  status: string;
  documentId: string;
  jobId?: string;
  timestamp: string;
}

@Controller('processor')
export class ProcessorController {
  private readonly logger = new CustomLogger(ProcessorController.name);

  constructor(private readonly processorService: ProcessorService) {}

  @Post('document')
  async processDocument(@Body() processDocumentDto: ProcessDocumentDto): Promise<ProcessDocumentResponse> {
    this.logger.log(`Received request to process document with documentId: ${processDocumentDto.documentId}`);
    
    const jobId = processDocumentDto.jobId || this.generateJobId();
    
    await this.processorService.processDocument({
      bucket: processDocumentDto.bucket,
      key: processDocumentDto.key,
      documentId: processDocumentDto.documentId,
    });

    return { 
      status: 'PROCESSING', 
      documentId: processDocumentDto.documentId,
      jobId,
      timestamp: new Date().toISOString()
    };
  }
  
  @Get('health')
  healthCheck() {
    return {
      status: HttpStatus.OK,
      message: 'Service is healthy',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get lineage data for a specific table
   * @param tableName The name of the table to get lineage for
   * @returns Lineage data with nodes and edges
   */
  @Get('lineage/:tableName')
  async getLineage(@Param('tableName') tableName: string): Promise<LineageResponse> {
    this.logger.log(`Received request to get lineage for table: ${tableName}`);
    return this.processorService.getLineage(tableName);
  }
  
  /**
   * Get document with its list of table mappings by documentId
   * @param documentId The ID of the document to retrieve
   * @returns Document with status and mappings data
   */
  @Get('document/:documentId')
  async getDocumentWithMappings(@Param('documentId') documentId: string): Promise<DocumentMappingResponse> {
    this.logger.log(`Received request to get document with mappings for documentId: ${documentId}`);
    return this.processorService.getDocumentWithMappings(documentId);
  }
  
  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
} 