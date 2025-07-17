import { Injectable } from '@nestjs/common';
import { S3Service } from '../client/s3.client';
import { DocumentJobRepository } from '../db/document-job.repository';
import { LineageNodeRepository } from '../db/lineage-node.reposioty';
import { LineageRelationshipRepository } from '../db/lineage-relation.repository';
import { DocumentStatus } from '../shared/constants';
import { CustomLogger } from '../shared/logger';
import { DocumentExtraction, DocumentProcessRequest, LineageMapping } from './interfaces';
import { LineageGenerationService } from './lineage-generation.service';

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
      const lineageMapping = await this.lineageGenerationService.generateLineageMapping(extractionData);
      
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
        qualifiedName: `${node.nodeType}.${node.nodeName}`,
        metadata: {
          ...node.metadata
        },
        jobId,
        system: node.qualifiedName || 'default',
        isVerified: (node.metadata?.confidence_score || 0) >= this.CONFIDENCE_THRESHOLD,
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
          sourceNodeId: nodeIdMap.get(edge.sourceNodeId)!,
          targetNodeId: nodeIdMap.get(edge.targetNodeId)!,
          relationshipType: edge.relationshipType,
          businessRule: { description: edge.businessRule },
          isVerified: (edge.confidence || 0) >= this.CONFIDENCE_THRESHOLD,
          jobId,
        }));
      
      // Save relationships
      await this.lineageRelationshipRepo.bulkCreate(relationEntities);
      
      this.logger.log(`Saved ${savedNodes.length} nodes and ${relationEntities.length} relationships for job ${jobId}`);
    } catch (error) {
      this.logger.error(`Failed to save lineage data: ${error.message}`);
      throw new Error(`Failed to save lineage data: ${error.message}`);
    }
  }
} 