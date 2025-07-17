import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ProcessorService } from './processor.service';
import { CustomLogger } from '../shared/logger';

interface ProcessDocumentDto {
  bucket: string;
  key: string;
  documentId: string;
}

@Controller('processor')
export class ProcessorController {
  private readonly logger = new CustomLogger(ProcessorController.name);

  constructor(private readonly processorService: ProcessorService) {}

  @Post('document')
  async processDocument(@Body() processDocumentDto: ProcessDocumentDto) {
    this.logger.log(`Received request to process document with documentId: ${processDocumentDto.documentId}`);
    
    await this.processorService.processDocument({
      bucket: processDocumentDto.bucket,
      key: processDocumentDto.key,
      documentId: processDocumentDto.documentId,
    });

    return { status: 'Processing started', documentId: processDocumentDto.documentId };
  }

  @Get('document/:documentId')
  async getDocumentStatus(@Param('documentId') documentId: string) {
    // This could be extended to actually check the status in the database
    return { message: `Status check for document ${documentId} is not implemented yet` };
  }
} 