import { Controller, Get } from '@nestjs/common';
import { FetchSchemaService, Schema } from './fetch-schema.service';
import { CustomLogger } from '../shared/logger';

@Controller('schema')
export class FetchSchemaController {
  private readonly logger = new CustomLogger(FetchSchemaController.name);

  constructor(private readonly fetchSchemaService: FetchSchemaService) {}

  @Get()
  async getSchema(): Promise<Schema> {
    this.logger.log('Received request to fetch schema');
    return this.fetchSchemaService.fetchSchema();
  }

  @Get('formatted')
  async getFormattedSchema(): Promise<{ schema: string }> {
    this.logger.log('Received request to fetch formatted schema');
    const schema = await this.fetchSchemaService.fetchSchema();
    const formattedSchema = this.fetchSchemaService.formatSchemaForPrompt(schema);
    
    return { schema: formattedSchema };
  }
} 