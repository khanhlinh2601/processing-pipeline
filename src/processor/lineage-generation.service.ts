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
      // Step 1: Build the LLM prompt
      const prompt = this.buildLLMPrompt(extractionData);
      
      // Step 2: Invoke Bedrock LLM
      const llmResponse = await this.invokeBedrockLLM(prompt);
      
      // Step 3: Parse the LLM response
      return this.parseLineageMapping(llmResponse);
    } catch (error) {
      this.logger.error(`Failed to generate lineage mapping: ${error.message}`);
      throw new Error(`Failed to generate lineage mapping: ${error.message}`);
    }
  }

  /**
   * Build the prompt for the LLM based on extraction data
   */
  private buildLLMPrompt(extractionData: DocumentExtraction): string {
    const { extracted_data_entities, document_metadata } = extractionData;
    
    return `

## SYSTEM CONTEXT

You are a data architecture assistant helping a data engineering team design lineage-aware data models. Your task is to transform extracted entities and relationships into a structured lineage graph format.

## INPUT DATA SCHEMA

The following JSON structures will be provided:

### 1. Extracted Data Entities
\`\`\`json
[
  {
    "entity_id": "string",              // Unique identifier for the entity
    "entity_name": "string",            // Human-readable name (may contain spaces)
    "entity_description": "string",     // Description of the entity's purpose
    "attributes": [
      {
        "attribute_name": "string",     // Name of the attribute (column)
        "description": "string",        // Description of the attribute's purpose
        "sample_values": ["string"]     // Example values for type inference
      }
    ]
  }
]
\`\`\`

### 2. Data Relationships
\`\`\`json
[
  {
    "source_entity": "string",         // entity_id of the source entity
    "target_entity": "string",         // entity_id of the target entity
    "relationship_type": "string",     // Type of relationship (e.g., "contains", "references")
    "description": "string",           // Description of the relationship
    "confidence": number              // Confidence score (0.0-1.0)
  }
]
\`\`\`

### 3. Lineage Schema Structures

#### LineageNode
\`\`\`json
{
  "nodeId": "string",                  // Unique identifier for the node: "{jobId}_{entity_id}"
  "nodeType": "string",                // Either "table" or "column"
  "nodeName": "string",                // Human-readable name
  "qualifiedName": "string",           // Fully qualified name (domain.entity_name)
  "parentId": "string",                // For columns, the parent table nodeId (null for tables)
  "metadata": {
    "description": "string",           // Description text
    "data_type": "string",             // For columns: "string", "number", "boolean", "date"
    "confidence_score": number,        // 0.0-1.0 indicating extraction confidence
    "last_updated": "string"           // ISO datetime of extraction
  }
}
\`\`\`

#### LineageRelationship
\`\`\`json
{
  "relationshipId": "string",          // Unique identifier: "{jobId}_{source}_{target}"
  "sourceNodeId": "string",            // NodeId of the source node
  "targetNodeId": "string",            // NodeId of the target node
  "relationshipType": "string",        // "business_reference", "technical_reference", etc.
  "confidence": number,                // 0.0-1.0 indicating extraction confidence
  "businessRule": {
    "description": "string"            // Human-readable description of the relationship
  }
}
\`\`\`

## INSTRUCTIONS

Using the provided input data, create a comprehensive lineage graph by following these steps:

1. **Entity Processing**:
   - For each entity in the extracted_data_entities array:
     - Create a LineageNode with nodeType="table"
     - Set nodeId as "{jobId}_{entity_id}" (use "job1" as default jobId if not provided)
     - Set nodeName to the entity_name, normalized to snake_case if needed
     - Set qualifiedName to "domain.{entity_id}" (use "domain" as default if not specified)
     - Set metadata.description to entity_description
     - Set metadata.confidence_score based on completeness (see rules below)
     - Set metadata.last_updated to "2025-07-17T08:32:49Z"

2. **Attribute Processing**:
   - For each attribute in an entity:
     - Create a LineageNode with nodeType="column"
     - Set nodeId as "{parent_nodeId}_{attribute_name}"
     - Set nodeName to attribute_name in snake_case
     - Set qualifiedName to "{parent_qualifiedName}.{attribute_name}"
     - Set parentId to the parent table's nodeId
     - Determine data_type using the inference rules below
     - Set metadata.description to the attribute's description
     - Set metadata.confidence_score based on the rules below

3. **Relationship Processing**:
   - For each relationship in data_relationships:
     - Create a LineageRelationship
     - Set relationshipId as "{jobId}_{source_entity}_{target_entity}"
     - Set sourceNodeId to the corresponding source entity's nodeId
     - Set targetNodeId to the corresponding target entity's nodeId
     - Set relationshipType to "business_reference" (default) or the specified type
     - Set confidence to the provided confidence value
     - Set businessRule.description to the relationship description or "Relationship derived from LLM extraction"

4. **Output Generation**:
   - Return a JSON object containing:
     - lineageNodes: Array of all generated LineageNode objects
     - lineageRelationships: Array of all generated LineageRelationship objects

## DATA TYPE INFERENCE RULES

Determine data_type for each attribute using these rules in order:
- If all sample_values are numeric (can contain decimals): assign "number"
- If all sample_values match common date patterns (YYYY-MM-DD, MM/DD/YYYY): assign "date"
- If all sample_values are "true" or "false" (case insensitive): assign "boolean"
- For all other cases: assign "string"

## CONFIDENCE SCORE RULES

Calculate confidence_score using these guidelines:
- For entities with complete descriptions and all attributes defined: 0.9-1.0
- For entities with partial descriptions or attributes with unclear names: 0.7-0.9
- For attributes with clear descriptions and sample values: 0.8-1.0
- For attributes with minimal information: 0.6-0.8
- For relationships with clear source/target and description: 0.8-1.0
- For relationships with ambiguous descriptions: 0.6-0.8

## ERROR HANDLING

- If an entity references attributes not defined in the input, mark with confidence_score of 0.5
- If a relationship references entities not in the input data, exclude it from output
- If data type cannot be reasonably inferred, default to "string" and set confidence_score to 0.7
- Normalize inconsistent naming (convert spaces to underscores, lowercase)
- Use reasonable defaults rather than failing when information is incomplete

## EXAMPLE INPUT/OUTPUT

### Example Input:
\`\`\`json
{
  "extracted_data_entities": [
    {
      "entity_id": "material_inventory",
      "entity_name": "Material Inventory at Location",
      "entity_description": "Inventory of materials stored at specific locations",
      "attributes": [
        {
          "attribute_name": "inventory_id",
          "description": "Unique identifier for inventory entry",
          "sample_values": ["INV001", "INV002"]
        },
        {
          "attribute_name": "quantity",
          "description": "Amount of material available",
          "sample_values": ["100", "250"]
        }
      ]
    }
  ],
  "data_relationships": [
    {
      "source_entity": "material_inventory",
      "target_entity": "sales_order",
      "relationship_type": "fulfills",
      "description": "Inventory items fulfill sales orders",
      "confidence": 0.92
    }
  ]
}
\`\`\`

### Example Output:
\`\`\`json
{
  "lineageNodes": [
    {
      "nodeId": "job1_material_inventory",
      "nodeType": "table",
      "nodeName": "material_inventory_at_location",
      "qualifiedName": "domain.material_inventory",
      "parentId": null,
      "metadata": {
        "description": "Inventory of materials stored at specific locations",
        "confidence_score": 0.95,
        "last_updated": "2025-07-17T08:32:49Z"
      }
    },
    {
      "nodeId": "job1_material_inventory_inventory_id",
      "nodeType": "column",
      "nodeName": "inventory_id",
      "qualifiedName": "domain.material_inventory.inventory_id",
      "parentId": "job1_material_inventory",
      "metadata": {
        "description": "Unique identifier for inventory entry",
        "data_type": "string",
        "confidence_score": 0.9,
        "last_updated": "2025-07-17T08:32:49Z"
      }
    },
    {
      "nodeId": "job1_material_inventory_quantity",
      "nodeType": "column",
      "nodeName": "quantity",
      "qualifiedName": "domain.material_inventory.quantity",
      "parentId": "job1_material_inventory",
      "metadata": {
        "description": "Amount of material available",
        "data_type": "number",
        "confidence_score": 0.95,
        "last_updated": "2025-07-17T08:32:49Z"
      }
    }
  ],
  "lineageRelationships": [
    {
      "relationshipId": "job1_material_inventory_sales_order",
      "sourceNodeId": "job1_material_inventory",
      "targetNodeId": "job1_sales_order",
      "relationshipType": "business_reference",
      "confidence": 0.92,
      "businessRule": {
        "description": "Inventory items fulfill sales orders"
      }
    }
  ]
}
\`\`\`

## MODEL CONSIDERATIONS

- This prompt is optimized for Claude Haiku on AWS Bedrock
- Keep responses concise and focused on the data transformation task
- Follow JSON schema exactly as specified above
- Use consistent naming conventions throughout
- Prioritize data consistency over creative interpretations

Now, process the following extracted data:

Document Details:
${document_metadata ? JSON.stringify(document_metadata, null, 2) : 'No metadata available'}

Extracted Entities:
${JSON.stringify(extracted_data_entities, null, 2)}
`;
  }

  /**
   * Invoke Bedrock LLM with the prepared prompt
   */
  private async invokeBedrockLLM(prompt: string): Promise<string> {
    try {
      const response = await this.bedrockClient.invokeModel(prompt);
      return response;
    } catch (error) {
      this.logger.error(`Failed to invoke Bedrock LLM: ${error.message}`);
      throw new Error(`Failed to invoke Bedrock LLM: ${error.message}`);
    }
  }

  /**
   * Parse the LLM response into a structured lineage mapping
   */
  private parseLineageMapping(llmResponse: string): LineageMapping {
    try {
      // Extract JSON from LLM response (might have surrounding text)
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Could not extract valid JSON from LLM response');
      }
      
      const jsonResponse = JSON.parse(jsonMatch[0]);
      
      // Validate the structure
      if (!jsonResponse.lineageNodes || !jsonResponse.lineageRelationships) {
        throw new Error('LLM response missing required lineageNodes or lineageRelationships arrays');
      }
      
      return jsonResponse as LineageMapping;
    } catch (error) {
      this.logger.error(`Failed to parse LLM response: ${error.message}`);
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }
} 