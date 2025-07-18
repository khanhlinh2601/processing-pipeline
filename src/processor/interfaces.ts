export interface DocumentExtraction {
  extraction: {
    extracted_data_entities: {
      logical_entities: ExtractedEntity[];
    }
    data_relationships: {
      entity_relationships: DataRelationship[];
    }	
  };
}

export interface ExtractedEntity {
  entity_id: string;
  entity_name: string;
  entity_description: string;
  attributes: EntityAttribute[];
}

export interface EntityAttribute {
  attribute_name: string;
  description: string;
  sample_values: string[];
}

export interface DataRelationship {
  source_entity: string;
  target_entity: string;
  relationship_type: string;
  description: string;
  confidence: number;
}

export interface DocumentProcessRequest {
  bucket: string;
  key: string;
  documentId: string;
}

export interface LineageNode {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  qualifiedName?: string;
  parentId?: string | null;
  metadata: {
    description: string;
    data_type?: string;
    confidence_score: number;
    last_updated: string;
  };
}

export interface LineageRelationship {
  relationshipId?: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: string;
  confidence?: number;
  businessRule: {
    description: string;
  };
}

export interface LineageMapping {
  lineageNodes: LineageNode[];
  lineageRelationships: LineageRelationship[];
}

export interface DocumentMappingResponse {
  documentId: string;
  status: string;
  mappings: {
    nodes: Array<{
      nodeId: string;
      nodeType: string;
      nodeName: string;
      qualifiedName: string;
      metadata: Record<string, any>;
      isVerified: boolean;
    }>;
    relationships: Array<{
      sourceNode: string;
      targetNode: string;
      relationshipType: string;
      businessRule: Record<string, any>;
      isVerified: boolean;
    }>;
  };
} 