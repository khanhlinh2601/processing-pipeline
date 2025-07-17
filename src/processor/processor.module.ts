import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProcessorController } from './processor.controller';
import { ProcessorService } from './processor.service';
import { LineageGenerationService } from './lineage-generation.service';
import { QualityCheckService } from './quality-check.service';
import { ClientsModule } from '../client/clients.module';
import { DbModule } from '../db/db.module';

@Module({
  imports: [
    ConfigModule,
    ClientsModule,
    DbModule,
  ],
  controllers: [ProcessorController],
  providers: [
    ProcessorService,
    LineageGenerationService,
    QualityCheckService
  ],
  exports: [
    ProcessorService,
    LineageGenerationService,
    QualityCheckService
  ],
})
export class ProcessorModule {} 