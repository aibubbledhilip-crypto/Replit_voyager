import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AGGREGATE_RESULTS_DIR = path.join(__dirname, '..', 'aggregate_results');

if (!fs.existsSync(AGGREGATE_RESULTS_DIR)) {
  fs.mkdirSync(AGGREGATE_RESULTS_DIR, { recursive: true });
}

export interface ParsedFile {
  fileName: string;
  columns: string[];
  data: Record<string, any>[];
  rowCount: number;
}

export interface AggregateResult {
  columnarRows: Array<Record<string, string>>;
  resolvedColumns: string[];
  frequencyRows: Array<{ value: string; column: string; fileCount: number; fileNames: string }>;
  summary: {
    totalFiles: number;
    totalValues: number;
    uniqueValues: number;
    matchedColumns: string[];
    matchType: 'exact' | 'partial';
    columnMatches: Array<{ fileName: string; matchedColumnName: string; searchColumn: string }>;
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
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCSV(filePath: string, fileName: string): ParsedFile {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.trim().split('\n');

  if (lines.length === 0) {
    throw new Error(`CSV file "${fileName}" is empty`);
  }

  const columns = lines[0].split(',').map(col => col.trim().replace(/^"|"$/g, ''));
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

  return { fileName, columns, data, rowCount: data.length };
}

function parseExcel(filePath: string, fileName: string): ParsedFile {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
  const columns = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

  return { fileName, columns, data: jsonData, rowCount: jsonData.length };
}

export function parseFile(filePath: string, fileName: string): ParsedFile {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    return parseCSV(filePath, fileName);
  } else if (ext === '.xlsx' || ext === '.xls') {
    return parseExcel(filePath, fileName);
  } else {
    throw new Error(`Unsupported file format for "${fileName}". Only CSV and XLSX files are supported.`);
  }
}

export function findMatchingColumn(
  columns: string[],
  searchColumn: string,
  matchType: 'exact' | 'partial'
): string | null {
  const searchLower = searchColumn.toLowerCase().trim();
  if (matchType === 'exact') {
    return columns.find(c => c.toLowerCase().trim() === searchLower) || null;
  } else {
    return columns.find(c => c.toLowerCase().trim().includes(searchLower) || searchLower.includes(c.toLowerCase().trim())) || null;
  }
}

export function aggregateFiles(
  parsedFiles: ParsedFile[],
  columnNames: string[],
  matchType: 'exact' | 'partial'
): AggregateResult {
  const columnMatches: AggregateResult['summary']['columnMatches'] = [];
  const resolvedColumnsSet = new Set<string>();
  const fileColumnMap: Map<string, Map<string, string>> = new Map();

  for (const file of parsedFiles) {
    for (const colName of columnNames) {
      const matchedCol = findMatchingColumn(file.columns, colName, matchType);
      if (!matchedCol) continue;

      columnMatches.push({ fileName: file.fileName, matchedColumnName: matchedCol, searchColumn: colName });
      resolvedColumnsSet.add(colName);
      if (!fileColumnMap.has(file.fileName)) {
        fileColumnMap.set(file.fileName, new Map());
      }
      fileColumnMap.get(file.fileName)!.set(colName, matchedCol);
    }
  }

  const resolvedColumns = columnNames.filter(c => resolvedColumnsSet.has(c));

  const columnarRows: Array<Record<string, string>> = [];
  let totalValues = 0;
  const allValuesSet = new Set<string>();
  const valueFileMapByCol: Map<string, Map<string, Set<string>>> = new Map();

  for (const file of parsedFiles) {
    const colMapping = fileColumnMap.get(file.fileName);
    if (!colMapping || colMapping.size === 0) continue;

    const maxRows = file.data.length;
    for (let i = 0; i < maxRows; i++) {
      const row = file.data[i];
      const outputRow: Record<string, string> = { 'File Name': file.fileName };
      let hasAnyValue = false;

      for (const colName of resolvedColumns) {
        const actualCol = colMapping.get(colName);
        if (actualCol) {
          const val = String(row[actualCol] ?? '').trim();
          outputRow[colName] = val;
          if (val) {
            hasAnyValue = true;
            totalValues++;
            allValuesSet.add(val);

            if (!valueFileMapByCol.has(colName)) {
              valueFileMapByCol.set(colName, new Map());
            }
            const vfm = valueFileMapByCol.get(colName)!;
            if (!vfm.has(val)) {
              vfm.set(val, new Set());
            }
            vfm.get(val)!.add(file.fileName);
          }
        } else {
          outputRow[colName] = '';
        }
      }

      if (hasAnyValue) {
        columnarRows.push(outputRow);
      }
    }
  }

  const frequencyRows: AggregateResult['frequencyRows'] = [];
  const colEntries = Array.from(valueFileMapByCol.entries());
  for (const [colName, vfm] of colEntries) {
    const valEntries = Array.from(vfm.entries());
    for (const [value, fileSet] of valEntries) {
      frequencyRows.push({
        value,
        column: colName,
        fileCount: fileSet.size,
        fileNames: Array.from(fileSet).join(', '),
      });
    }
  }
  frequencyRows.sort((a, b) => b.fileCount - a.fileCount);

  return {
    columnarRows,
    resolvedColumns,
    frequencyRows,
    summary: {
      totalFiles: parsedFiles.length,
      totalValues,
      uniqueValues: allValuesSet.size,
      matchedColumns: columnNames,
      matchType,
      columnMatches,
    },
  };
}

export function generateAggregateXLSX(result: AggregateResult): string {
  const workbook = XLSX.utils.book_new();

  const headers = ['File Name', ...result.resolvedColumns];
  if (result.columnarRows.length > 0) {
    const detailSheet = XLSX.utils.json_to_sheet(result.columnarRows, { header: headers });
    const colWidths = headers.map(h => {
      const maxLen = Math.max(h.length, ...result.columnarRows.map(r => (r[h] || '').length).slice(0, 200));
      return { wch: Math.min(maxLen + 2, 60) };
    });
    detailSheet['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Values by File');
  } else {
    const emptyRow: Record<string, string> = {};
    headers.forEach(h => emptyRow[h] = '');
    const detailSheet = XLSX.utils.json_to_sheet([emptyRow], { header: headers });
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Values by File');
  }

  const freqData = result.frequencyRows.map(r => ({
    'Value': r.value,
    'Column': r.column,
    'Appears in # Files': r.fileCount,
    'File Names': r.fileNames,
  }));
  const freqSheet = XLSX.utils.json_to_sheet(freqData.length > 0 ? freqData : [{ 'Value': '', 'Column': '', 'Appears in # Files': '', 'File Names': '' }]);

  if (freqData.length > 0) {
    const freqColWidths = [
      { wch: Math.max(8, ...freqData.map(r => r['Value'].length).slice(0, 100)) },
      { wch: Math.max(8, ...freqData.map(r => r['Column'].length).slice(0, 100)) },
      { wch: 18 },
      { wch: Math.max(12, ...freqData.map(r => r['File Names'].length).slice(0, 100)) },
    ];
    freqSheet['!cols'] = freqColWidths;
  }
  XLSX.utils.book_append_sheet(workbook, freqSheet, 'Value Frequency');

  const timestamp = Date.now();
  const outputFileName = `aggregate_${timestamp}.xlsx`;
  const outputPath = path.join(AGGREGATE_RESULTS_DIR, outputFileName);
  XLSX.writeFile(workbook, outputPath);

  return outputFileName;
}

export function cleanupOldAggregateFiles(): void {
  const dir = AGGREGATE_RESULTS_DIR;
  if (!fs.existsSync(dir)) return;

  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  }
}
