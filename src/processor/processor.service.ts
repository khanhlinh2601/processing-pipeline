import { Injectable } from '@nestjs/common';
import { S3Service } from '../client/s3.client';
import { DocumentJobRepository } from '../db/document-job.repository';
import { LineageNodeRepository } from '../db/lineage-node.reposioty';
import { LineageRelationshipRepository } from '../db/lineage-relation.repository';
import { DocumentStatus } from '../shared/constants';
import { CustomLogger } from '../shared/logger';
import { DocumentExtraction, DocumentProcessRequest, LineageMapping, DocumentMappingResponse } from './interfaces';
import { LineageGenerationService } from './lineage-generation.service';
import * as fs from 'fs';
import * as path from 'path';

export interface LineageNodeResponse {
  id: string;
  type: string;
  data: {
    label: string;
    columns?: Array<{
      name: string;
      type: string;
      classification: string;
    }>;
    metadata: Record<string, any>;
  };
  position: {
    x: number;
    y: number;
  };
}

export interface LineageEdgeResponse {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
}

export interface LineageResponse {
  nodes: LineageNodeResponse[];
  edges: LineageEdgeResponse[];
}

@Injectable()
export class ProcessorService {
  private readonly logger = new CustomLogger(ProcessorService.name);
  private readonly CONFIDENCE_THRESHOLD = 0.7; // Confidence threshold for verification

  constructor(
    private readonly s3Client: S3Service,
    private readonly documentJobRepo: DocumentJobRepository,
    private readonly lineageNodeRepo: LineageNodeRepository,
    private readonly lineageRelationshipRepo: LineageRelationshipRepository,
    private readonly lineageGenerationService: LineageGenerationService
  ) {}

  /**
   * Main method to process a document with lineage enrichment
   */
  async processDocument(request: DocumentProcessRequest): Promise<void> {
    const { bucket, key, documentId } = request;

    try {
      // Step 1: Update job status to ENRICHMENTING
      await this.documentJobRepo.updateStatus(documentId, DocumentStatus.ENRICHMENTING);

      // Step 2: Download and parse the extraction data
      const extractionData = await this.fetchExtractionData(bucket, key);
      
      // Step 3: Generate lineage mapping using LineageGenerationService
      this.logger.log(`Generating lineage mapping for document ${documentId}`);
      const lineageMapping = await this.lineageGenerationService.generateLineageMapping(extractionData);

      // Save lineage mapping to a JSON file
      await this.saveLineageMappingToFile(documentId, lineageMapping);
      
      // Step 4: Always save lineage data regardless of review status
      await this.saveLineageData(documentId, lineageMapping);

      //Check all nodes isVerified is true
      const allNodesVerified = lineageMapping.lineageNodes.every(node => node.metadata.confidence_score >= this.CONFIDENCE_THRESHOLD);
      if (!allNodesVerified) {
        await this.documentJobRepo.updateStatus(documentId, DocumentStatus.MANUAL_REVIEW);
      } else {
        await this.documentJobRepo.updateStatus(documentId, DocumentStatus.ENRICHMENTED);
      }
      this.logger.log(`Document ${documentId} processing completed successfully`);
      
    } catch (error) {
      this.logger.error(`Error processing document ${documentId}: ${error.message}`);
      await this.documentJobRepo.updateStatus(documentId, DocumentStatus.FAILED, error.message);
      throw error;
    }
  }

  /**
   * Get lineage data for a specific table
   */
  async getLineage(tableName: string): Promise<LineageResponse> {
    try {
      this.logger.log(`Fetching lineage data for table: ${tableName}`);
      
      // Get all nodes from the database
      const allNodes = await this.lineageNodeRepo.findByNodeType('table');
      
      // Find the target table node
      const targetNode = allNodes.find(node => 
        node.nodeName.toLowerCase() === tableName.toLowerCase() || 
        node.qualifiedName.toLowerCase().includes(tableName.toLowerCase())
      );
      
      if (!targetNode) {
        this.logger.warn(`Table ${tableName} not found in lineage data`);
        return { nodes: [], edges: [] };
      }
      
      // Get all relationships from the database
      const allRelationships = await this.lineageRelationshipRepo.findAll();
      
      // Filter relationships related to the target node
      const relatedRelationships = allRelationships.filter(rel => 
        rel.sourceNodeId === targetNode.nodeId || rel.targetNodeId === targetNode.nodeId
      );
      
      // Get all related node IDs
      const relatedNodeIds = new Set<string>();
      relatedNodeIds.add(targetNode.nodeId);
      
      relatedRelationships.forEach(rel => {
        relatedNodeIds.add(rel.sourceNodeId);
        relatedNodeIds.add(rel.targetNodeId);
      });
      
      // Filter nodes to only include related ones
      const relatedTableNodes = allNodes.filter(node => relatedNodeIds.has(node.nodeId));
      
      // Get all column nodes for these tables
      const columnNodes = await this.lineageNodeRepo.findByNodeType('column');
      const relatedColumnNodes = columnNodes.filter(col => 
        relatedTableNodes.some(table => col.parentId === table.nodeId)
      );
      
      // Format the response
      const nodeResponses: LineageNodeResponse[] = relatedTableNodes.map((node, index) => {
        // Assign x, y coordinates based on position in array
        // Primary node at 0,0, others positioned in a grid-like layout
        const isTargetNode = node.nodeId === targetNode.nodeId;
        const x = isTargetNode ? 0 : 400 * ((index % 3) + 1);
        const y = isTargetNode ? 0 : 300 * Math.floor(index / 3);
        
        // Get columns for this table
        const tableColumns = relatedColumnNodes.filter(col => col.parentId === node.nodeId);
        
        return {
          id: `tbl_${node.nodeName.toLowerCase().replace(/\s+/g, '_')}`,
          type: 'table',
          data: {
            label: node.nodeName,
            columns: tableColumns.map(col => ({
              name: col.nodeName,
              type: col.metadata?.data_type || 'string',
              classification: col.metadata?.classification || 'DESCRIPTIVE'
            })),
            metadata: {
              businessOwner: node.metadata?.businessOwner || 'Unknown',
              description: node.metadata?.description || 'No description available'
            }
          },
          position: { x, y }
        };
      });
      
      // Format the edges
      const edgeResponses: LineageEdgeResponse[] = relatedRelationships.map(rel => {
        const sourceNode = relatedTableNodes.find(node => node.nodeId === rel.sourceNodeId);
        const targetNode = relatedTableNodes.find(node => node.nodeId === rel.targetNodeId);
        
        if (!sourceNode || !targetNode) {
          return null;
        }
        
        // Find column relationships if they exist
        const sourceColumnId = rel.businessRule?.sourceColumn;
        const targetColumnId = rel.businessRule?.targetColumn;
        
        let sourceColumnName = '';
        let targetColumnName = '';
        
        // If we have specific column references, use them
        if (sourceColumnId && targetColumnId) {
          const sourceColumn = relatedColumnNodes.find(col => col.nodeId === sourceColumnId);
          const targetColumn = relatedColumnNodes.find(col => col.nodeId === targetColumnId);
          
          if (sourceColumn) sourceColumnName = sourceColumn.nodeName;
          if (targetColumn) targetColumnName = targetColumn.nodeName;
        } else {
          // If not, try to infer from relationship type
          // For example, if we have a relationship between tables, look for matching column names
          const sourceColumns = relatedColumnNodes.filter(col => col.parentId === sourceNode.nodeId);
          const targetColumns = relatedColumnNodes.filter(col => col.parentId === targetNode.nodeId);
          
          // Try to find matching column pairs
          for (const sourceCol of sourceColumns) {
            for (const targetCol of targetColumns) {
              if (sourceCol.nodeName === targetCol.nodeName) {
                sourceColumnName = sourceCol.nodeName;
                targetColumnName = targetCol.nodeName;
                break;
              }
            }
            if (sourceColumnName) break;
          }
        }
        
        // If we still don't have column names, just use the first column of each table
        if (!sourceColumnName && !targetColumnName) {
          const sourceColumns = relatedColumnNodes.filter(col => col.parentId === sourceNode.nodeId);
          const targetColumns = relatedColumnNodes.filter(col => col.parentId === targetNode.nodeId);
          
          if (sourceColumns.length > 0) sourceColumnName = sourceColumns[0].nodeName;
          if (targetColumns.length > 0) targetColumnName = targetColumns[0].nodeName;
        }
        
        const sourceTableId = `tbl_${sourceNode.nodeName.toLowerCase().replace(/\s+/g, '_')}`;
        const targetTableId = `tbl_${targetNode.nodeName.toLowerCase().replace(/\s+/g, '_')}`;
        
        return {
          id: `${sourceTableId}-${sourceColumnName}-${targetTableId}-${targetColumnName}`,
          source: sourceTableId,
          target: targetTableId,
          type: 'smoothstep',
          label: sourceColumnName && targetColumnName ? `${sourceColumnName} → ${targetColumnName}` : rel.relationshipType
        };
      }).filter(Boolean) as LineageEdgeResponse[];
      
      return {
        nodes: nodeResponses,
        edges: edgeResponses
      };
    } catch (error) {
      this.logger.error(`Error fetching lineage data for table ${tableName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get document with its list of table mappings by documentId
   * @param documentId The ID of the document to retrieve
   * @returns Document with status and mappings data
   */
  async getDocumentWithMappings(documentId: string): Promise<DocumentMappingResponse> {
    try {
      this.logger.log(`Fetching document with mappings for documentId: ${documentId}`);
      
      // Get the document job information
      const documentJobs = await this.documentJobRepo.findByDocumentId(documentId);
      if (!documentJobs || documentJobs.length === 0) {
        throw new Error(`Document with ID ${documentId} not found`);
      }
      
      // Get the latest job for this document
      const latestJob = documentJobs[0]; // Assuming the jobs are sorted by timestamp in descending order
      
      // Get all lineage nodes for this document
      const nodes = await this.lineageNodeRepo.findByJobId(documentId);
      
      // Get all lineage relationships for this document
      const relationships = await this.lineageRelationshipRepo.findByJobId(documentId);
      
      // Format the relationships for the response
      const formattedRelationships = relationships.map(rel => {
        // Find source and target node names for better readability
        const sourceNode = nodes.find(node => node.nodeId === rel.sourceNodeId);
        const targetNode = nodes.find(node => node.nodeId === rel.targetNodeId);
        
        return {
          sourceNode: sourceNode ? sourceNode.nodeName : rel.sourceNodeId,
          targetNode: targetNode ? targetNode.nodeName : rel.targetNodeId,
          relationshipType: rel.relationshipType,
          businessRule: rel.businessRule || {},
          isVerified: rel.isVerified,
        };
      });
      
      return {
        documentId,
        status: latestJob.status,
        mappings: {
          nodes: nodes.map(node => ({
            nodeId: node.nodeId,
            nodeType: node.nodeType,
            nodeName: node.nodeName,
            qualifiedName: node.qualifiedName,
            metadata: node.metadata || {},
            isVerified: node.isVerified,
          })),
          relationships: formattedRelationships,
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching document with mappings for documentId ${documentId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch and parse extraction data from S3
   */
  private async fetchExtractionData(bucket: string, key: string): Promise<DocumentExtraction> {
    try {
      const data = await this.s3Client.getObject(bucket, key);
      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch extraction data: ${error.message}`);
      throw new Error(`Failed to fetch extraction data: ${error.message}`);
    }
  }

  /**
   * Save lineage nodes and relationships to the database
   */
  private async saveLineageData(jobId: string, lineageMapping: LineageMapping): Promise<void> {
    try {
      // Convert lineage nodes to database format
      const nodeEntities = lineageMapping.lineageNodes.map(node => ({
        nodeType: node.nodeType,
        nodeName: node.nodeName,
        qualifiedName: node.qualifiedName || `${node.nodeType}.${node.nodeName}`,
        metadata: {
          ...node.metadata
        },
        jobId,
        system: node.qualifiedName?.split('.')[0] || 'default',
        isVerified: (node.metadata?.confidence_score || 0) >= this.CONFIDENCE_THRESHOLD,
        parentId: node.parentId || null,
        nodeId: node.nodeId
      }));
      
      // Save nodes to get generated IDs
      const savedNodes = await this.lineageNodeRepo.bulkCreate(nodeEntities);
      
      // Create a map of node ids from the mapping to database IDs
      const nodeIdMap = new Map<string, string>();
      lineageMapping.lineageNodes.forEach((node, index) => {
        nodeIdMap.set(node.nodeId, savedNodes[index].nodeId);
      });
      
      // Convert lineage edges to database format and make sure all references exist
      const relationEntities = lineageMapping.lineageRelationships
        .filter(edge => nodeIdMap.has(edge.sourceNodeId) && nodeIdMap.has(edge.targetNodeId))
        .map(edge => ({
          relationshipId: `${nodeIdMap.get(edge.sourceNodeId)}-${nodeIdMap.get(edge.targetNodeId)}`, // Generate unique ID
          sourceNodeId: nodeIdMap.get(edge.sourceNodeId)!,
          targetNodeId: nodeIdMap.get(edge.targetNodeId)!,
          relationshipType: edge.relationshipType,
          businessRule: edge.businessRule,
          isVerified: (edge.confidence || 0) >= this.CONFIDENCE_THRESHOLD,
          jobId
        }));
      
      // Save relationships
      await this.lineageRelationshipRepo.bulkCreate(relationEntities);
      
      this.logger.log(`Saved ${savedNodes.length} nodes and ${relationEntities.length} relationships for job ${jobId}`);
    } catch (error) {
      this.logger.error(`Failed to save lineage data: ${error.message}`);
      throw new Error(`Failed to save lineage data: ${error.message}`);
    }
  }

  /**
   * Save lineage mapping data to a JSON file
   */
  private async saveLineageMappingToFile(documentId: string, lineageMapping: LineageMapping): Promise<void> {
    try {
      const filePath = path.join(__dirname, '..', '..', 'lineage-mappings', `${documentId}-lineage-mapping.json`);
      
      // Ensure the directory exists
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      
      // Write the lineage mapping to a JSON file
      fs.writeFileSync(filePath, JSON.stringify(lineageMapping, null, 2));
      
      this.logger.log(`Lineage mapping saved to file: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to save lineage mapping to file: ${error.message}`);
      throw new Error(`Failed to save lineage mapping to file: ${error.message}`);
    }
  }
}