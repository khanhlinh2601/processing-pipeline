import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomLogger } from '../shared/logger';
import axios from 'axios';

export interface Schema {
  version: string;
  tables: SchemaTable[];
  lastUpdated: string;
}

export interface SchemaTable {
  name: string;
  logicalName: string;
  description?: string;
  columns: SchemaColumn[];
}

export interface SchemaColumn {
  name: string;
  logicalName: string;
  dataType: string;
  description?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

@Injectable()
export class FetchSchemaService {
  private readonly logger = new CustomLogger(FetchSchemaService.name);

  constructor(private configService: ConfigService) {}

  async fetchSchema(): Promise<Schema> {
    try {
      const schemaApiUrl = this.configService.get<string>('app.schemaApiUrl');
      
      if (!schemaApiUrl) {
        throw new Error('Schema API URL is not configured');
      }
      
      this.logger.log(`Fetching schema from ${schemaApiUrl}`);
      
      const response = await axios.get<Schema>(schemaApiUrl);
      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching schema: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Helper method to format schema into a SQL-like representation for LLM prompt
  formatSchemaForPrompt(schema: Schema): string {
    let formattedSchema = `-- Schema Version: ${schema.version}\n-- Last Updated: ${schema.lastUpdated}\n\n`;
    
    for (const table of schema.tables) {
      formattedSchema += `-- ${table.description || 'No description'}\n`;
      formattedSchema += `CREATE TABLE ${table.name} ( -- Logical name: ${table.logicalName}\n`;
      
      const columns = table.columns.map(col => {
        let colDef = `  ${col.name} ${col.dataType} -- Logical name: ${col.logicalName}`;
        
        if (col.isPrimaryKey) {
          colDef += ', PRIMARY KEY';
        }
        
        if (col.isForeignKey && col.references) {
          colDef += `, FOREIGN KEY REFERENCES ${col.references.table}(${col.references.column})`;
        }
        
        if (col.description) {
          colDef += `, ${col.description}`;
        }
        
        return colDef;
      });
      
      formattedSchema += columns.join(',\n');
      formattedSchema += '\n);\n\n';
    }
    
    return formattedSchema;
  }
} 