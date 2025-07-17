import { Controller, Post, Body, Get, Param, HttpStatus } from '@nestjs/common';
import { ProcessorService } from './processor.service';
import { CustomLogger } from '../shared/logger';

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
      jobId,
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
  
  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
} 