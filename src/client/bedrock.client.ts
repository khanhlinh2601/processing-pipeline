import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { CustomLogger } from '../shared/logger';

interface ClaudeModelParams {
  prompt: string;
  max_tokens_to_sample: number;
  temperature: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
}

interface AnthropicResponse {
  completion: string;
}

@Injectable()
export class BedrockService {
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly logger = new CustomLogger(BedrockService.name);

  constructor(private configService: ConfigService) {
    this.bedrockClient = new BedrockRuntimeClient({
      region: this.configService.get<string>('aws.bedrock.region'),
    });
  }

  async invokeModel(prompt: string): Promise<string> {
    try {
      const modelId = this.configService.get<string>('aws.bedrock.modelId');
      
      // Claude-specific parameters
      const params: ClaudeModelParams = {
        prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
        max_tokens_to_sample: 2000,
        temperature: 0.7,
        top_p: 0.9,
        stop_sequences: ["\n\nHuman:"],
      };

      const command = new InvokeModelCommand({
        modelId,
        body: JSON.stringify(params),
        contentType: 'application/json',
        accept: 'application/json',
      });

      const response = await this.bedrockClient.send(command);
      
      // Parse the binary response
      const responseBody = Buffer.from(response.body).toString('utf-8');
      const parsedResponse = JSON.parse(responseBody) as AnthropicResponse;
      
      return parsedResponse.completion.trim();
    } catch (error) {
      this.logger.error(`Error invoking Bedrock model: ${error.message}`, error.stack);
      throw error;
    }
  }
} 