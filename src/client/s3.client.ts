import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { CustomLogger } from '../shared/logger';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly logger = new CustomLogger(S3Service.name);

  constructor(private configService: ConfigService) {
    const awsConfig = this.configService.get('aws');
    
    // Create client configuration
    const clientConfig: any = {
      region: awsConfig.region,
    };

    // Add credentials if they exist
    if (awsConfig.credentials?.accessKeyId && awsConfig.credentials?.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: awsConfig.credentials.accessKeyId,
        secretAccessKey: awsConfig.credentials.secretAccessKey,
        ...(awsConfig.credentials.sessionToken && { sessionToken: awsConfig.credentials.sessionToken }),
      };
    }

    this.s3Client = new S3Client(clientConfig);
  }

  async getObject(bucket: string, key: string): Promise<any> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const streamToString = await this.streamToString(response.Body as Readable);
      return JSON.parse(streamToString);
    } catch (error) {
      this.logger.error(`Error getting object from S3: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
  }
} 