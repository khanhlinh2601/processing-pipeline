import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule } from '../client/clients.module';
import { DocumentJobRepository } from './document-job.repository';
import { LineageNodeRepository } from './lineage-node.reposioty';
import { LineageRelationshipRepository } from './lineage-relation.repository';

@Module({
  imports: [ConfigModule, ClientsModule],
  providers: [
    DocumentJobRepository,
    LineageNodeRepository,
    LineageRelationshipRepository,
  ],
  exports: [
    DocumentJobRepository,
    LineageNodeRepository,
    LineageRelationshipRepository,
  ],
})
export class DbModule {} 