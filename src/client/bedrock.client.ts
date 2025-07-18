import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { CustomLogger } from '../shared/logger';

interface ClaudeModelParams {
  prompt: string;
  max_tokens_to_sample: number;
  temperature: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
}

interface ClaudeMessagesParams {
  anthropic_version: string;
  max_tokens: number;
  temperature: number;
  messages: Array<{
    role: string;
    content: Array<{
      type: string;
      text: string;
    }> | string;
  }>;
}

interface AnthropicResponse {
  completion: string;
}

interface AnthropicMessagesResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

@Injectable()
export class BedrockService {
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly bedrockAgentClient: BedrockAgentRuntimeClient;
  private readonly logger = new CustomLogger(BedrockService.name);

  constructor(private configService: ConfigService) {
    this.bedrockClient = new BedrockRuntimeClient({
      region: 'ap-southeast-1',
    });
    this.bedrockAgentClient = new BedrockAgentRuntimeClient({
      region: 'us-east-1',
    });
  }

  async invokeModel(prompt: string): Promise<string> {
    try {
      const modelId = 'anthropic.claude-3-haiku-20240307-v1:0';
      
      // Use the Messages API format for Claude 3 models
      const params: ClaudeMessagesParams = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 400000, // Increased from 200000 to handle longer responses
        temperature: 0.5,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ]
      };
      
      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(params),
      });
      
      const response = await this.bedrockClient.send(command);
      
      const responseBody = new TextDecoder().decode(response.body);
      
      try {
        // Try parsing the JSON response
        this.logger.debug(`Received LLM response: ${(responseBody)}`);

        const parsedResponse = JSON.parse(this.sanitizeJsonString(responseBody)) as AnthropicMessagesResponse;
        
        // Extract text from the response
        let responseText = '';
        if (parsedResponse.content && Array.isArray(parsedResponse.content)) {
          responseText = parsedResponse.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('');
        }
        
        return responseText.trim();
      } catch (parseError) {
        // Log the parsing error and fallback to string manipulation
        this.logger.warn(`Error parsing Bedrock response as JSON: ${parseError.message}. Falling back to string extraction.`);
        
        // Attempt to extract content with regex
        const contentMatch = responseBody.match(/"text"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/g);
        if (contentMatch) {
          const extractedTexts = contentMatch.map(match => {
            const textContent = match.substring(match.indexOf(':') + 1).trim();
            // Remove leading/trailing quotes and handle escaped quotes
            return JSON.parse(textContent);
          });
          return extractedTexts.join('').trim();
        }
        
        // If all else fails, return the raw response with a warning
        this.logger.warn('Could not extract structured content from response, returning raw text');
        return responseBody.trim();
      }
    } catch (error) {
      this.logger.error(`Error invoking Bedrock model: ${error.message}`, error.stack);
      throw new Error(`Failed to invoke AI model: ${error.message}`);
    }
  }

  /**
   * Sanitizes a potentially malformed JSON string by fixing common issues
   * @param jsonString The JSON string to sanitize
   * @returns A sanitized JSON string
   */
  private sanitizeJsonString(jsonString: string): string {
    try {
      // First check if it's already valid
      JSON.parse(jsonString);
      return jsonString;
    } catch (e) {
      // Handle unterminated strings
      let sanitized = jsonString;
      
      // Fix unterminated strings by adding missing quotes
      const openQuoteMatch = sanitized.match(/"([^"\\]|\\.)*$/g);
      if (openQuoteMatch) {
        sanitized = sanitized + '"';
      }
      
      // Replace invalid control characters
      sanitized = sanitized.replace(/[\u0000-\u001F]+/g, ' ');
      
      // Balance braces and brackets
      let openBraces = (sanitized.match(/{/g) || []).length;
      let closeBraces = (sanitized.match(/}/g) || []).length;
      let openBrackets = (sanitized.match(/\[/g) || []).length;
      let closeBrackets = (sanitized.match(/\]/g) || []).length;
      
      // Add missing closing braces/brackets
      while (openBraces > closeBraces) {
        sanitized += '}';
        closeBraces++;
      }
      
      while (openBrackets > closeBrackets) {
        sanitized += ']';
        closeBrackets++;
      }
      
      // Try parsing again to make sure it's valid
      try {
        JSON.parse(sanitized);
        this.logger.log('Successfully sanitized malformed JSON');
        return sanitized;
      } catch (err) {
        // If still invalid, log and return the original
        this.logger.warn(`JSON sanitization failed: ${err.message}`);
        return jsonString;
      }
    }
  }

  /**
   * Retrieve context from Bedrock Knowledge Base using vectorstore
   * @param userQuery The user query string
   * @returns The retrieved context as a string
   */
  async retrieveKnowledgeBaseContext(userQuery: string): Promise<string> {
    try {
      const knowledgeBaseId = 'MHCVIJVGRZ';
      const command = new RetrieveCommand({
        knowledgeBaseId,
        retrievalQuery: { text: userQuery },
      });
      const response = await this.bedrockAgentClient.send(command);
      if (!response.retrievalResults || response.retrievalResults.length === 0) {
        return '';
      }
      // Concatenate all retrieved document contents
      return response.retrievalResults.map(doc => doc.content?.text || doc.content).join('\n');
    } catch (error) {
      this.logger.error(`Error retrieving from Bedrock Knowledge Base: ${error.message}`, error.stack);
      throw new Error(`Failed to retrieve from Knowledge Base: ${error.message}`);
    }
  }
}