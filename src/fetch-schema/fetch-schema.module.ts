import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FetchSchemaService } from './fetch-schema.service';
import { FetchSchemaController } from './fetch-schema.controller';

@Module({
  imports: [ConfigModule],
  controllers: [FetchSchemaController],
  providers: [FetchSchemaService],
  exports: [FetchSchemaService],
})
export class FetchSchemaModule {} 