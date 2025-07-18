import { registerAs } from '@nestjs/config';

export const awsConfig = registerAs('aws', () => ({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN, // Optional for temporary credentials
  },
  s3: {
    bucketName: process.env.S3_BUCKET_NAME,
  },
  sqs: {
    queueUrl: process.env.SQS_QUEUE_URL,
    processingDelay: parseInt(process.env.SQS_PROCESSING_DELAY || '0', 10),
    manualReviewQueueUrl: process.env.SQS_MANUAL_REVIEW_QUEUE_URL,
  },
  dynamodb: {
    documentTableName: process.env.DYNAMODB_DOCUMENT_TABLE,
    lineageNodesTableName: process.env.DYNAMODB_LINEAGE_NODES_TABLE,
    lineageRelationshipsTableName: process.env.DYNAMODB_LINEAGE_RELATIONSHIPS_TABLE,
  },
  bedrock: {
    modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-v2',
    region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-southeast-1',
  },
}));

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  schemaApiUrl: process.env.SCHEMA_API_URL,
})); 