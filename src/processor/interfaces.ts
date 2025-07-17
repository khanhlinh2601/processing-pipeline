export interface ExtractedEntity {
  name: string;
  type: string;
  value: string;
  metadata?: Record<string, any>;
}

export interface Attribute {
  attribute_id: string;
  attribute_name: string;
  data_type: string;
}

export interface LogicalEntity {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  description: string;
  attributes: Attribute[];
  confidence_score: number;
}

export interface EntityRelationship {
  relationship_id: string;
  source_entity: string;
  target_entity: string;
  relationship_type: string;
}

export interface DataRelationships {
  entity_relationships: EntityRelationship[];
}

export interface ExtractionCompleteness {
  entities_extracted: number;
  completeness_score: number;
}

export interface QualityAssessment {
  extraction_completeness: ExtractionCompleteness;
}

export interface ExtractedDataEntities {
  logical_entities: LogicalEntity[];
}

export interface ProcessedDocument {
  extracted_data_entities: ExtractedDataEntities;
  data_relationships: DataRelationships;
  quality_assessment: QualityAssessment;
}

export interface DocumentExtraction {
  extracted_data_entities: ExtractedEntity[];
  document_metadata?: Record<string, any>;
}

export interface LineageNode {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  qualifiedName: string;
  parentId: string | null;
  metadata: {
    description: string;
    data_type?: string;
    confidence_score: number;
    last_updated: string;
  };
}

export interface LineageRelationship {
  relationshipId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: string;
  confidence: number;
  businessRule: {
    description: string;
  };
}

export interface LineageMapping {
  lineageNodes: LineageNode[];
  lineageRelationships: LineageRelationship[];
}

export interface DocumentProcessRequest {
  bucket: string;
  key: string;
  documentId: string;
} 