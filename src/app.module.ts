import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProcessorModule } from './processor/processor.module';
import { ClientsModule } from './client/clients.module';
import { DbModule } from './db/db.module';
import { awsConfig, appConfig } from './shared/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [awsConfig, appConfig],
    }),
    ClientsModule,
    DbModule,
    ProcessorModule,
  ],
})
export class AppModule {}
