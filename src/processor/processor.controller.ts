import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ProcessorService } from './processor.service';
import { DocumentRepository, DocumentRecord, DocumentTermMapping } from '../db/document.repository';
import { CustomLogger } from '../shared/logger';

@Controller('processor')
export class ProcessorController {
  private readonly logger = new CustomLogger(ProcessorController.name);

  constructor(
    private readonly processorService: ProcessorService,
    private readonly documentRepository: DocumentRepository,
  ) {}

  @Post('process')
  async processMessage(@Body() messageBody: any): Promise<{ success: boolean; documentId?: string }> {
    this.logger.log(`Received manual process request for message: ${JSON.stringify(messageBody)}`);
    
    try {
      await this.processorService.processMessage(messageBody);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error processing message: ${error.message}`, error.stack);
      return { success: false };
    }
  }

  @Get('document/:id')
  async getDocument(@Param('id') id: string): Promise<DocumentRecord | { error: string }> {
    try {
      const document = await this.documentRepository.getDocument(id);
      
      if (!document) {
        return { error: `Document with ID ${id} not found` };
      }
      
      return document;
    } catch (error) {
      this.logger.error(`Error fetching document: ${error.message}`, error.stack);
      return { error: `Failed to fetch document: ${error.message}` };
    }
  }

  @Get('mappings/:documentId')
  async getMappings(@Param('documentId') documentId: string): Promise<DocumentTermMapping[] | { error: string }> {
    try {
      const mappings = await this.documentRepository.getTermMappings(documentId);
      return mappings;
    } catch (error) {
      this.logger.error(`Error fetching mappings: ${error.message}`, error.stack);
      return { error: `Failed to fetch mappings: ${error.message}` };
    }
  }
} 