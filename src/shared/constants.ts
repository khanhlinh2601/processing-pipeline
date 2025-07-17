export enum DocumentStatus {
  
  UPLOADED = 'UPLOADED', // Document has been uploaded to S3
  EXTRACTING = 'EXTRACTING', // Textract is extracting the document
  EXTRACTED = 'EXTRACTED', // Textract has extracted the document
  CLASSIFYING = 'CLASSIFYING', // Bedrock is classifying the document
  CLASSIFIED = 'CLASSIFIED', // Bedrock has classified the document
  ENRICHMENTING = 'ENRICHMENTING', // Bedrock is enriching the document
  ENRICHMENTED = 'ENRICHMENTED', // Bedrock has enriched the document
  MANUAL_REVIEW = 'MANUAL_REVIEW', // Manual review is required
  FAILED = 'FAILED' // Textract or Bedrock failed to process the document
}

export enum SourceType {
  LLM = 'LLM',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  CORRECTED = 'CORRECTED',
}

export const MAX_POLLING_ATTEMPTS = 10;
export const POLLING_INTERVAL_MS = 2000;

export const LLM_MODELS = {
  CLAUDE: 'anthropic.claude-3-sonnet-20240229-v1:0',
  TITAN: 'amazon.titan-text-express-v1',
};

export const AWS_REGIONS = {
  DEFAULT: 'us-east-1',
}; 