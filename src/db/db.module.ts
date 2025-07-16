import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocumentRepository } from './document.repository';
import { ClientsModule } from '../client/clients.module';

@Module({
  imports: [ConfigModule, ClientsModule],
  providers: [DocumentRepository],
  exports: [DocumentRepository],
})
export class DbModule {} 