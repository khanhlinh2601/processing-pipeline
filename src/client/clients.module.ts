import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SQSService } from './sqs.client';
import { DynamoDBService } from './dynamo.client';
import { BedrockService } from './bedrock.client';
import { S3Service } from './s3.client';

@Module({
  imports: [ConfigModule],
  providers: [S3Service, SQSService, BedrockService, DynamoDBService],
  exports: [S3Service, SQSService, BedrockService, DynamoDBService],
})
export class ClientsModule {} 