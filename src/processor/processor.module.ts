import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProcessorController } from './processor.controller';
import { ProcessorService } from './processor.service';
import { FetchSchemaModule } from '../fetch-schema/fetch-schema.module';
import { ClientsModule } from '../client/clients.module';
import { DbModule } from '../db/db.module';

@Module({
  imports: [
    ConfigModule,
    FetchSchemaModule,
    ClientsModule,
    DbModule,
  ],
  controllers: [ProcessorController],
  providers: [ProcessorService],
  exports: [ProcessorService],
})
export class ProcessorModule {} 