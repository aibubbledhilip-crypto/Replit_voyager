import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-athena";
import * as fs from 'fs';
import * as path from 'path';

const EXPORTS_DIR = path.join(process.cwd(), 'exports');

export interface PaginatedQueryResult {
  columns: string[];
  data: Record<string, any>[];
  totalRows: number;
  filePath?: string;
}

export interface ProgressCallback {
  (progress: number, total: number): void;
}

/**
 * Sanitize and validate export file path
 * Ensures path is within exports directory and creates parent dirs
 */
function prepareExportPath(fileName: string): string {
  // Remove any path traversal attempts and validate
  let sanitized = path.basename(fileName);
  
  // Ensure non-empty filename
  if (!sanitized || sanitized.trim() === '') {
    throw new Error('Invalid export filename');
  }
  
  // Enforce .csv extension
  if (!sanitized.endsWith('.csv')) {
    sanitized += '.csv';
  }
  
  const fullPath = path.join(EXPORTS_DIR, sanitized);
  
  // Ensure exports directory exists
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
  
  return fullPath;
}

/**
 * Execute Athena query with pagination support
 * Fetches all pages up to the specified row limit
 * If exportToFile is provided, streams to CSV and doesn't accumulate in memory
 */
export async function executeAthenaQueryWithPagination(
  athenaClient: AthenaClient,
  query: string,
  s3OutputLocation: string,
  rowLimit: number,
  exportToFile?: string,
  onProgress?: ProgressCallback
): Promise<PaginatedQueryResult> {
  // Start query execution
  const startCommand = new StartQueryExecutionCommand({
    QueryString: query,
    ResultConfiguration: {
      OutputLocation: s3OutputLocation,
    },
  });

  const startResponse = await athenaClient.send(startCommand);
  const queryExecutionId = startResponse.QueryExecutionId;

  if (!queryExecutionId) {
    throw new Error('Failed to start query execution');
  }

  // Poll for query completion
  let queryStatus = 'RUNNING';
  const getExecutionCommand = new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId });

  while (queryStatus === 'RUNNING' || queryStatus === 'QUEUED') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const executionResponse = await athenaClient.send(getExecutionCommand);
    queryStatus = executionResponse.QueryExecution?.Status?.State || 'FAILED';
  }

  if (queryStatus !== 'SUCCEEDED') {
    throw new Error(`Query failed with status: ${queryStatus}`);
  }

  // Fetch results with pagination
  let nextToken: string | undefined = undefined;
  let allData: Record<string, any>[] = [];
  let columns: string[] = [];
  let totalFetched = 0;
  let isFirstPage = true;
  let csvWriter: fs.WriteStream | null = null;
  let finalFilePath: string | undefined = undefined;
  let exportError: Error | null = null;

  // Initialize CSV writer if exporting to file
  if (exportToFile) {
    finalFilePath = prepareExportPath(exportToFile);
    csvWriter = fs.createWriteStream(finalFilePath, { flags: 'w' });
  }

  try {
    do {
      // AWS Athena has a max of 1000 rows per request
      const pageSize = Math.min(1000, rowLimit - totalFetched);
      
      const getResultsCommand: GetQueryResultsCommand = new GetQueryResultsCommand({
        QueryExecutionId: queryExecutionId,
        MaxResults: pageSize,
        NextToken: nextToken,
      });

      const resultsResponse = await athenaClient.send(getResultsCommand);
      const rows = resultsResponse.ResultSet?.Rows || [];
      nextToken = resultsResponse.NextToken;

      if (isFirstPage && rows.length > 0) {
        // Extract column names from first row
        columns = rows[0].Data?.map((col: any) => col.VarCharValue || '') || [];
        
        // Write CSV header if exporting
        if (csvWriter) {
          csvWriter.write(columns.map(col => `"${col.replace(/"/g, '""')}"`).join(',') + '\n');
        }
        
        // Skip header row for data
        rows.shift();
        isFirstPage = false;
      }

      // Parse rows
      const pageData = rows.map((row: any) => {
        const rowData: Record<string, any> = {};
        row.Data?.forEach((cell: any, idx: number) => {
          rowData[columns[idx]] = cell.VarCharValue || '';
        });
        return rowData;
      });

      // Write to CSV if exporting, otherwise accumulate in memory
      if (csvWriter && pageData.length > 0) {
        for (const row of pageData) {
          const values = columns.map(col => {
            const value = String(row[col] || '');
            return `"${value.replace(/"/g, '""')}"`;
          });
          csvWriter.write(values.join(',') + '\n');
        }
      } else {
        // Only accumulate in memory if not exporting
        pageData.forEach(row => allData.push(row));
      }
      
      totalFetched += pageData.length;

      // Report progress
      if (onProgress) {
        onProgress(totalFetched, rowLimit);
      }

      // Check if we've reached the limit
      if (totalFetched >= rowLimit) {
        break;
      }

      // Throttle to avoid rate limiting
      if (nextToken) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } while (nextToken && totalFetched < rowLimit);

  } catch (error) {
    exportError = error as Error;
  } finally {
    // Close CSV writer once
    if (csvWriter) {
      await new Promise<void>((resolve) => {
        csvWriter!.end(() => resolve());
      });
    }
    
    // Clean up partial file on error
    if (exportError && finalFilePath && fs.existsSync(finalFilePath)) {
      try {
        fs.unlinkSync(finalFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }
    
    // Re-throw the original error
    if (exportError) {
      throw exportError;
    }
  }

  return {
    columns,
    data: allData,
    totalRows: totalFetched,
    filePath: finalFilePath,
  };
}
