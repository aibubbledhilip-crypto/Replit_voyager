import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const COMPARISON_RESULTS_DIR = path.join(__dirname, '..', 'comparison_results');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(COMPARISON_RESULTS_DIR)) {
  fs.mkdirSync(COMPARISON_RESULTS_DIR, { recursive: true });
}

export interface ParsedFile {
  columns: string[];
  data: Record<string, any>[];
  rowCount: number;
}

export interface ComparisonResult {
  uniqueToFile1: Record<string, any>[];
  uniqueToFile2: Record<string, any>[];
  commonRows: Record<string, any>[];
  deltaRows: Array<{
    key: string;
    file1Data: Record<string, any>;
    file2Data: Record<string, any>;
    differences: string[];
  }>;
  summary: {
    file1Name: string;
    file2Name: string;
    file1TotalRows: number;
    file2TotalRows: number;
    uniqueToFile1Count: number;
    uniqueToFile2Count: number;
    commonRowsCount: number;
    deltaRowsCount: number;
    comparisonColumns: string[];
  };
}

export function parseFile(filePath: string): ParsedFile {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.csv') {
    return parseCSV(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    return parseExcel(filePath);
  } else {
    throw new Error('Unsupported file format. Only CSV and XLSX files are supported.');
  }
}

function parseCSV(filePath: string): ParsedFile {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.trim().split('\n');
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }
  
  // Parse header
  const columns = lines[0].split(',').map(col => col.trim().replace(/^"|"$/g, ''));
  
  // Parse data rows
  const data: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === columns.length) {
      const row: Record<string, any> = {};
      columns.forEach((col, index) => {
        row[col] = values[index];
      });
      data.push(row);
    }
  }
  
  return {
    columns,
    data,
    rowCount: data.length,
  };
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  values.push(current.trim());
  
  return values;
}

function parseExcel(filePath: string): ParsedFile {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  
  if (jsonData.length === 0) {
    throw new Error('Excel file is empty');
  }
  
  // Extract columns from first row
  const columns = Object.keys(jsonData[0] as object);
  
  return {
    columns,
    data: jsonData as Record<string, any>[],
    rowCount: jsonData.length,
  };
}

export function compareDatasets(
  file1: ParsedFile,
  file2: ParsedFile,
  columnMappings: Array<{file1Column: string, file2Column: string}>,
  file1Name: string,
  file2Name: string
): ComparisonResult {
  // Validate that mapped columns exist in their respective files
  for (const mapping of columnMappings) {
    if (!file1.columns.includes(mapping.file1Column)) {
      throw new Error(`Column "${mapping.file1Column}" not found in file 1`);
    }
    if (!file2.columns.includes(mapping.file2Column)) {
      throw new Error(`Column "${mapping.file2Column}" not found in file 2`);
    }
  }
  
  // Create maps for quick lookup
  const file1Map = new Map<string, Record<string, any>>();
  const file2Map = new Map<string, Record<string, any>>();
  
  // Build composite keys using mapped columns
  file1.data.forEach(row => {
    const key = columnMappings.map(m => String(row[m.file1Column] || '')).join('|');
    file1Map.set(key, row);
  });
  
  file2.data.forEach(row => {
    const key = columnMappings.map(m => String(row[m.file2Column] || '')).join('|');
    file2Map.set(key, row);
  });
  
  // Find unique rows
  const uniqueToFile1: Record<string, any>[] = [];
  const uniqueToFile2: Record<string, any>[] = [];
  const commonRows: Record<string, any>[] = [];
  const deltaRows: Array<{
    key: string;
    file1Data: Record<string, any>;
    file2Data: Record<string, any>;
    differences: string[];
  }> = [];
  
  // Check file1 rows
  file1Map.forEach((row, key) => {
    if (!file2Map.has(key)) {
      uniqueToFile1.push(row);
    } else {
      const file2Row = file2Map.get(key)!;
      
      // Check if rows are identical
      const differences = findDifferences(row, file2Row, file1.columns, file2.columns);
      
      if (differences.length === 0) {
        commonRows.push(row);
      } else {
        deltaRows.push({
          key,
          file1Data: row,
          file2Data: file2Row,
          differences,
        });
      }
    }
  });
  
  // Check file2 rows for unique entries
  file2Map.forEach((row, key) => {
    if (!file1Map.has(key)) {
      uniqueToFile2.push(row);
    }
  });
  
  return {
    uniqueToFile1,
    uniqueToFile2,
    commonRows,
    deltaRows,
    summary: {
      file1Name,
      file2Name,
      file1TotalRows: file1.rowCount,
      file2TotalRows: file2.rowCount,
      uniqueToFile1Count: uniqueToFile1.length,
      uniqueToFile2Count: uniqueToFile2.length,
      commonRowsCount: commonRows.length,
      deltaRowsCount: deltaRows.length,
      comparisonColumns: columnMappings.map(m => `${m.file1Column}→${m.file2Column}`),
    },
  };
}

function findDifferences(
  row1: Record<string, any>,
  row2: Record<string, any>,
  columns1: string[],
  columns2: string[]
): string[] {
  const differences: string[] = [];
  const allColumns = new Set([...columns1, ...columns2]);
  
  allColumns.forEach(col => {
    const val1 = String(row1[col] ?? '');
    const val2 = String(row2[col] ?? '');
    
    if (val1 !== val2) {
      differences.push(col);
    }
  });
  
  return differences;
}

export function generateComparisonCSV(result: ComparisonResult): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `comparison_${timestamp}.csv`;
  const filePath = path.join(COMPARISON_RESULTS_DIR, fileName);
  
  const stream = fs.createWriteStream(filePath);
  
  // Write summary
  stream.write('=== COMPARISON SUMMARY ===\n');
  stream.write(`File 1: ${result.summary.file1Name}\n`);
  stream.write(`File 2: ${result.summary.file2Name}\n`);
  stream.write(`Total Rows in File 1: ${result.summary.file1TotalRows}\n`);
  stream.write(`Total Rows in File 2: ${result.summary.file2TotalRows}\n`);
  stream.write(`Unique to File 1: ${result.summary.uniqueToFile1Count}\n`);
  stream.write(`Unique to File 2: ${result.summary.uniqueToFile2Count}\n`);
  stream.write(`Common Rows (Identical): ${result.summary.commonRowsCount}\n`);
  stream.write(`Rows with Differences: ${result.summary.deltaRowsCount}\n`);
  stream.write(`Comparison Key Columns: ${result.summary.comparisonColumns.join(', ')}\n`);
  stream.write('\n\n');
  
  // Write unique to file 1
  if (result.uniqueToFile1.length > 0) {
    stream.write('=== UNIQUE TO FILE 1 ===\n');
    const columns = Object.keys(result.uniqueToFile1[0]);
    stream.write(csvEscape(columns) + '\n');
    result.uniqueToFile1.forEach(row => {
      const values = columns.map(col => csvEscape([String(row[col] ?? '')]));
      stream.write(values.join(',') + '\n');
    });
    stream.write('\n\n');
  }
  
  // Write unique to file 2
  if (result.uniqueToFile2.length > 0) {
    stream.write('=== UNIQUE TO FILE 2 ===\n');
    const columns = Object.keys(result.uniqueToFile2[0]);
    stream.write(csvEscape(columns) + '\n');
    result.uniqueToFile2.forEach(row => {
      const values = columns.map(col => csvEscape([String(row[col] ?? '')]));
      stream.write(values.join(',') + '\n');
    });
    stream.write('\n\n');
  }
  
  // Write delta rows (rows with differences)
  if (result.deltaRows.length > 0) {
    stream.write('=== ROWS WITH DIFFERENCES ===\n');
    stream.write('Key,Column,File 1 Value,File 2 Value\n');
    result.deltaRows.forEach(delta => {
      delta.differences.forEach(col => {
        const val1 = csvEscape([String(delta.file1Data[col] ?? '')]);
        const val2 = csvEscape([String(delta.file2Data[col] ?? '')]);
        stream.write(`"${delta.key}","${col}",${val1},${val2}\n`);
      });
    });
  }
  
  stream.end();
  
  return filePath;
}

function csvEscape(values: string[]): string {
  return values.map(val => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }).join(',');
}

export function cleanupOldFiles(directory: string, maxAgeMs: number = 24 * 60 * 60 * 1000) {
  if (!fs.existsSync(directory)) return;
  
  const files = fs.readdirSync(directory);
  const now = Date.now();
  
  files.forEach(file => {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    
    if (now - stats.mtimeMs > maxAgeMs) {
      fs.unlinkSync(filePath);
    }
  });
}
