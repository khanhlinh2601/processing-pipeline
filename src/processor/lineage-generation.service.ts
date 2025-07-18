import { Injectable } from '@nestjs/common';
import { CustomLogger } from '../shared/logger';
import { BedrockService } from '../client/bedrock.client';
import { DocumentExtraction, LineageMapping } from './interfaces';

@Injectable()
export class LineageGenerationService {
  private readonly logger = new CustomLogger(LineageGenerationService.name);

  constructor(
    private readonly bedrockClient: BedrockService,
  ) {}

  /**
   * Generate lineage mapping from extraction data using LLM
   */
  async generateLineageMapping(extractionData: DocumentExtraction): Promise<LineageMapping> {
    try {
      this.logger.debug(`Generating lineage mapping for document ID`);
      
      const { extracted_data_entities, data_relationships } = extractionData.extraction;
      
      // Process entities one at a time and collect results
      const lineageMappings: LineageMapping[] = [];
      
      // Ensure logical_entities exists and is an array
      const logicalEntities = extracted_data_entities?.logical_entities || [];
      this.logger.debug(`Found ${logicalEntities.length} logical entities to process`);
      
      for (const entity of logicalEntities) {
        this.logger.debug(`Processing entity: ${entity.entity_name} (ID: ${entity.entity_id})`);
        
        // Create a focused extraction for this single entity
        const singleEntityExtraction: DocumentExtraction = {
          extraction: {
            extracted_data_entities: {
              logical_entities: [entity]
            },
            // Include only relationships relevant to this entity
            data_relationships: {
              entity_relationships: data_relationships.entity_relationships.filter(rel =>
                rel.source_entity === entity.entity_id || rel.target_entity === entity.entity_id
              )
            }
          }
        };
        
        try {
          // Build the LLM prompt for this entity
          const prompt = this.buildLLMPrompt(singleEntityExtraction);
          
          // Invoke Bedrock LLM for this entity with retry logic for rate limiting
          const llmResponse = await this.invokeBedrockLLM(prompt);
          
          // Parse the LLM response for this entity
          const entityLineageMapping = this.parseLineageMapping(llmResponse);
          lineageMappings.push(entityLineageMapping);
        } catch (entityError) {
          // Log the error but continue with other entities
          this.logger.error(`Failed to process entity ${entity.entity_id}: ${entityError.message}`);
        }
      }
      
      if (lineageMappings.length === 0) {
        throw new Error('Failed to generate any lineage mappings from the entities');
      }
      
      // Merge all entity lineage mappings
      return this.mergeLineageMappings(lineageMappings);
    } catch (error) {
      this.logger.error(`Failed to generate lineage mapping: ${error.message}`);
      throw new Error(`Failed to generate lineage mapping: ${error.message}`);
    }
  }
  
  /**
   * Merge multiple lineage mappings into a single mapping
   */
  private mergeLineageMappings(mappings: LineageMapping[]): LineageMapping {
    const mergedMapping: LineageMapping = {
      lineageNodes: [],
      lineageRelationships: []
    };
    
    // Track node IDs to avoid duplicates when merging
    const nodeIdMap = new Map<string, string>();
    
    // Merge all nodes
    for (const mapping of mappings) {
      for (const node of mapping.lineageNodes) {
        // Check if we've already added this node (by qualifiedName)
        const existingNodeId = nodeIdMap.get(node.qualifiedName || node.nodeId);
        
        if (!existingNodeId) {
          // Add the node to the merged mapping
          mergedMapping.lineageNodes.push(node);
          // Map the node's ID to enable relationship merging
          nodeIdMap.set(node.qualifiedName || node.nodeId, node.nodeId);
        }
      }
    }
    
    // Merge all relationships, updating node IDs if needed
    for (const mapping of mappings) {
      for (const relationship of mapping.lineageRelationships) {
        // Find the correct source and target node IDs in the merged mapping
        const sourceNode = mapping.lineageNodes.find(n => n.nodeId === relationship.sourceNodeId);
        const targetNode = mapping.lineageNodes.find(n => n.nodeId === relationship.targetNodeId);
        
        if (sourceNode && targetNode) {
          const sourceNodeId = nodeIdMap.get(sourceNode.qualifiedName || sourceNode.nodeId);
          const targetNodeId = nodeIdMap.get(targetNode.qualifiedName || targetNode.nodeId);
          
          if (sourceNodeId && targetNodeId) {
            // Add the relationship with the updated node IDs
            //check existing relationships to avoid duplicates
            const existingRelationship = mergedMapping.lineageRelationships.find(rel =>
              rel.sourceNodeId === sourceNodeId &&
              rel.targetNodeId === targetNodeId &&
              rel.relationshipType === relationship.relationshipType
            );
            if (!existingRelationship) {
              mergedMapping.lineageRelationships.push({
                ...relationship,
                sourceNodeId,
                targetNodeId,
                relationshipId: `${sourceNodeId}-${targetNodeId}`, // Generate unique ID
              });
            }
          }
        }
      }
    }
    
    this.logger.debug(`Merged ${mappings.length} lineage mappings into one with ${mergedMapping.lineageNodes.length} nodes and ${mergedMapping.lineageRelationships.length} relationships`);
    
    return mergedMapping;
  }

  /**
   * Build the prompt for the LLM based on extraction data
   */
  private buildLLMPrompt(extractionData: DocumentExtraction): string {
    const { extracted_data_entities, data_relationships } = extractionData.extraction;
    // Enhanced prompt optimized for Claude Haiku to produce correct JSON output
    return `
## TASK

Transform the provided extracted data entities and relationships into a structured lineage graph.

## INPUT DATA

Extracted Entities:
${JSON.stringify(extracted_data_entities, null, 2)}

${data_relationships ? `Data Relationships:\n${JSON.stringify(data_relationships, null, 2)}` : 'No explicit relationships provided.'}

## OUTPUT FORMAT

You MUST respond ONLY with a valid JSON object in exactly this format:

{
  "lineageNodes": [
    {
      "nodeId": "tbl_account",
      "nodeType": "table",
      "nodeName": "account",
      "qualifiedName": "tbl_account",
      "parentId": null,
      "metadata": {
        "description": "Main production database for customer data",
        "businessOwner": "xWyvernPx"
      }
    },
    {
      "nodeId": "tbl_account_id",
      "nodeType": "column",
      "nodeName": "id",
      "qualifiedName": "tbl_account.id",
      "parentId": "tbl_account",
      "metadata": {
        "data_type": "bigint",
        "classification": "IDENTIFIER"
      }
    },
    {
      "nodeId": "tbl_account_full_name",
      "nodeType": "column",
      "nodeName": "full_name",
      "qualifiedName": "tbl_account.full_name",
      "parentId": "tbl_account",
      "metadata": {
        "data_type": "string",
        "classification": "DESCRIPTIVE"
      }
    },
    {
      "nodeId": "tbl_payment",
      "nodeType": "table",
      "nodeName": "payment",
      "qualifiedName": "tbl_payment",
      "parentId": null,
      "metadata": {
        "description": "Main production database for customer data",
        "businessOwner": "xWyvernPx"
      }
    },
    {
      "nodeId": "tbl_payment_user_id",
      "nodeType": "column",
      "nodeName": "user_id",
      "qualifiedName": "tbl_payment.user_id",
      "parentId": "tbl_payment",
      "metadata": {
        "data_type": "int",
        "classification": "IDENTIFIER"
      }
    },
    {
      "nodeId": "tbl_payment_transaction_id",
      "nodeType": "column",
      "nodeName": "transaction_id",
      "qualifiedName": "tbl_payment.transaction_id",
      "parentId": "tbl_payment",
      "metadata": {
        "data_type": "string",
        "classification": "IDENTIFIER"
      }
    }
  ],
  "lineageRelationships": [
    {
      "relationshipId": "tbl_payment_user_id_tbl_account_id",
      "sourceNodeId": "tbl_payment_user_id",
      "targetNodeId": "tbl_account_id",
      "relationshipType": "business_reference",
      "confidence": 0.9,
      "businessRule": {
        "description": "user_id references id"
      }
    }
  ]
}


## REQUIREMENTS

1. Return ONLY the JSON object with no markdown formatting, explanation, or other text
2. Ensure all nodeId values are unique
3. For tables: nodeType must be "table" and parentId must be null
4. For columns: nodeType must be "column" and parentId must be the parent table's nodeId
5. All number values must be actual numbers without quotes
6. All property names and string values must use double quotes
7. Include all required fields and follow the exact structure shown above
8. Do not include any text outside the JSON object
9. Must be flow sneak_case;

## PROCESS

1. Create a table node for each entity in extracted_data_entities
2. Create column nodes for each attribute in each entity's attributes array
3. Create relationships between entities based on data_relationships
4. Set confidence_score values between 0.7 and 1.0
5. Use "2025-07-18T00:00:00Z" as the last_updated value
6. Infer appropriate data_type values for column attributes based on sample_values`;
  }

  /**
   * Invoke Bedrock LLM with the prepared prompt, with retry logic for rate limiting
   */
  private async invokeBedrockLLM(prompt: string): Promise<string> {
    const maxRetries = 5;
    const initialBackoffMs = 1000; // Start with 1 second
    
    let retryCount = 0;
    
    while (true) {
      try {
        const response = await this.bedrockClient.invokeModel(prompt);
        return response;
      } catch (error) {
        // Check if it's a rate limit error
        if (error.message.includes('Too many requests') || 
            error.message.includes('rate limit') || 
            error.message.includes('throttling') ||
            error.name === 'ThrottlingException') {
          
          retryCount++;
          
          if (retryCount > maxRetries) {
            this.logger.error(`Failed to invoke Bedrock LLM after ${maxRetries} retries: ${error.message}`);
            throw new Error(`Failed to invoke Bedrock LLM after ${maxRetries} retries: ${error.message}`);
          }
          
          // Calculate backoff time with exponential backoff and jitter
          const backoffMs = initialBackoffMs * Math.pow(2, retryCount - 1);
          // Add random jitter (±20%) to prevent synchronized retries
          const jitterMs = backoffMs * 0.2 * (Math.random() * 2 - 1);
          const waitTime = Math.floor(backoffMs + jitterMs);
          
          this.logger.warn(`Rate limit hit when invoking Bedrock LLM. Retrying in ${waitTime}ms (retry ${retryCount}/${maxRetries})`);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Continue to next iteration of the loop to retry
          continue;
        }
        
        // If it's not a rate limit error, throw it
        this.logger.error(`Failed to invoke Bedrock LLM: ${error.message}`);
        throw new Error(`Failed to invoke Bedrock LLM: ${error.message}`);
      }
    }
  }

  /**
   * Parse the LLM response into a structured lineage mapping
   */
  private parseLineageMapping(llmResponse: string): LineageMapping {
    try {
      // Extract JSON from the response if needed
      let jsonString = llmResponse.trim();
      
      // Handle cases where the LLM might include explanatory text before/after the JSON
      const jsonStart = jsonString.indexOf('{');
      const jsonEnd = jsonString.lastIndexOf('}');
      
      if (jsonStart >= 0 && jsonEnd >= 0) {
        jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
      }
      
      // Parse the JSON
      const parsedResponse = JSON.parse(jsonString);
      
      this.logger.debug('Successfully parsed lineage mapping from LLM response');
      
      // Extract lineage nodes and relationships
      return {
        lineageNodes: parsedResponse.lineageNodes || [],
        lineageRelationships: parsedResponse.lineageRelationships || []
      };
    } catch (error) {
      this.logger.error(`Failed to parse LLM response: ${error.message}`);
      this.logger.debug(`Full LLM response: ${llmResponse}`);
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }

}