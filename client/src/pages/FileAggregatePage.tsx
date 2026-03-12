import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Upload, Download, Layers, Loader2, X, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCsrfToken } from "@/lib/api";
import * as XLSX from 'xlsx';

interface UploadedFile {
  file: File;
  columns: string[];
}

interface AggregateResultData {
  summary: {
    totalFiles: number;
    totalValues: number;
    uniqueValues: number;
    matchedColumns: string[];
    matchType: string;
    columnMatches: Array<{ fileName: string; matchedColumnName: string; searchColumn: string }>;
  };
  resolvedColumns: string[];
  detailCount: number;
  frequencyCount: number;
  downloadFile: string;
  message: string;
}

export default function FileAggregatePage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [columnInput, setColumnInput] = useState("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [matchType, setMatchType] = useState<"exact" | "partial">("exact");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AggregateResultData | null>(null);
  const { toast } = useToast();

  const analyzeFileColumns = (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      if (file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          const firstLine = content.split('\n')[0];
          const columns = firstLine.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
          resolve(columns);
        };
        reader.onerror = () => reject(new Error('Failed to read CSV file'));
        reader.readAsText(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 });
          const columns = jsonData.length > 0 ? (jsonData[0] as string[]).map(String) : [];
          resolve(columns);
        };
        reader.onerror = () => reject(new Error('Failed to read Excel file'));
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Unsupported file type'));
      }
    });
  };

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      try {
        const columns = await analyzeFileColumns(file);
        newFiles.push({ file, columns });
      } catch (err: any) {
        toast({
          title: "File Error",
          description: `Could not read "${file.name}": ${err.message}`,
          variant: "destructive",
        });
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
    setResult(null);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setResult(null);
  };

  const addColumn = () => {
    const trimmed = columnInput.trim();
    if (!trimmed) return;
    if (selectedColumns.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Duplicate", description: `"${trimmed}" is already added.`, variant: "destructive" });
      return;
    }
    setSelectedColumns(prev => [...prev, trimmed]);
    setColumnInput("");
    setResult(null);
  };

  const addColumnFromBadge = (col: string) => {
    if (selectedColumns.some(c => c.toLowerCase() === col.toLowerCase())) {
      return;
    }
    setSelectedColumns(prev => [...prev, col]);
    setResult(null);
  };

  const removeColumn = (index: number) => {
    setSelectedColumns(prev => prev.filter((_, i) => i !== index));
    setResult(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addColumn();
    }
  };

  const handleAggregate = async () => {
    if (files.length < 2) {
      toast({ title: "Not enough files", description: "Please upload at least 2 files.", variant: "destructive" });
      return;
    }
    if (selectedColumns.length === 0) {
      toast({ title: "No columns selected", description: "Please add at least one column name to aggregate on.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f.file));
      formData.append('columnNames', JSON.stringify(selectedColumns));
      formData.append('matchType', matchType);

      const csrfToken = await getCsrfToken();
      const response = await fetch('/api/aggregate/execute', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'x-csrf-token': csrfToken,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Aggregation failed');
      }

      setResult(data);
      toast({ title: "Aggregation Complete", description: data.message });
    } catch (error: any) {
      toast({ title: "Aggregation Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (result?.downloadFile) {
      window.open(`/api/aggregate/download/${result.downloadFile}`, '_blank');
    }
  };

  const allColumns = Array.from(
    new Set(files.flatMap(f => f.columns))
  );

  const availableColumns = allColumns.filter(
    col => !selectedColumns.some(sc => sc.toLowerCase() === col.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto" data-testid="file-aggregate-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">File Aggregate</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload multiple CSV or Excel files, specify one or more column names, and aggregate matching values across all files.
        </p>
      </div>

      <Card data-testid="card-file-upload">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Files
          </CardTitle>
          <CardDescription>
            Upload two or more CSV or Excel files to aggregate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-input">Select Files</Label>
            <div className="flex items-center gap-3 border rounded-md px-3 h-9">
              <Button
                type="button"
                size="sm"
                onClick={() => document.getElementById('file-input')?.click()}
                data-testid="button-choose-files"
              >
                Choose Files
              </Button>
              <span className="text-sm text-muted-foreground truncate">
                {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'No files chosen'}
              </span>
              <input
                id="file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                multiple
                onChange={handleFilesChange}
                data-testid="input-file-upload"
                className="hidden"
              />
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <Label>Uploaded Files ({files.length})</Label>
              <div className="space-y-2">
                {files.map((f, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 rounded-md border"
                    data-testid={`file-item-${index}`}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{f.file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.columns.length} columns
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      data-testid={`button-remove-file-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-column-config">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Column Configuration
          </CardTitle>
          <CardDescription>
            Add one or more column names to extract and aggregate across all uploaded files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Add Column</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Type a column name and press Enter..."
                  value={columnInput}
                  onChange={(e) => setColumnInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  data-testid="input-column-name"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={addColumn}
                  disabled={!columnInput.trim()}
                  data-testid="button-add-column"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              {availableColumns.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Click a column from the uploaded files to add it:</p>
                  <div className="flex flex-wrap gap-1">
                    {availableColumns.slice(0, 20).map(col => (
                      <Badge
                        key={col}
                        variant="outline"
                        className="text-xs cursor-pointer"
                        onClick={() => addColumnFromBadge(col)}
                        data-testid={`badge-available-column-${col}`}
                      >
                        {col}
                      </Badge>
                    ))}
                    {availableColumns.length > 20 && (
                      <span className="text-xs text-muted-foreground self-center">
                        +{availableColumns.length - 20} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedColumns.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Columns ({selectedColumns.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedColumns.map((col, index) => (
                    <Badge
                      key={`${col}-${index}`}
                      variant="secondary"
                      className="text-sm gap-1 pr-1"
                      data-testid={`badge-selected-column-${index}`}
                    >
                      {col}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 rounded-full"
                        onClick={() => removeColumn(index)}
                        data-testid={`button-remove-column-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Match Type</Label>
              <Select value={matchType} onValueChange={(v) => setMatchType(v as 'exact' | 'partial')}>
                <SelectTrigger data-testid="select-match-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Exact Match</SelectItem>
                  <SelectItem value="partial">Partial Match</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {matchType === 'exact'
                  ? 'Column names must match exactly (case-insensitive).'
                  : 'Column names can be a substring of the actual column name.'}
              </p>
            </div>
          </div>

          <Button
            onClick={handleAggregate}
            disabled={isProcessing || files.length < 2 || selectedColumns.length === 0}
            data-testid="button-aggregate"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Layers className="h-4 w-4 mr-2" />
                Aggregate Files
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card data-testid="card-results">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Results
              </CardTitle>
              <Button onClick={handleDownload} data-testid="button-download">
                <Download className="h-4 w-4 mr-2" />
                Download XLSX
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Files Processed</div>
                <div className="text-lg font-semibold" data-testid="text-total-files">{result.summary.totalFiles}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Total Values Found</div>
                <div className="text-lg font-semibold" data-testid="text-total-values">{result.summary.totalValues}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Unique Values</div>
                <div className="text-lg font-semibold" data-testid="text-unique-values">{result.summary.uniqueValues}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Columns Matched</div>
                <div className="text-lg font-semibold" data-testid="text-columns-matched">{result.summary.matchedColumns.length}</div>
              </div>
            </div>

            {result.summary.matchedColumns.length > 0 && (
              <div className="space-y-1">
                <Label className="text-sm">Searched Columns</Label>
                <div className="flex flex-wrap gap-1">
                  {result.summary.matchedColumns.map((col, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{col}</Badge>
                  ))}
                </div>
              </div>
            )}

            {result.summary.columnMatches.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Column Matches by File</Label>
                <div className="space-y-1">
                  {result.summary.columnMatches.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{m.fileName}</span>
                      <span className="text-muted-foreground shrink-0">-</span>
                      <Badge variant="secondary" className="text-xs shrink-0">{m.matchedColumnName}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.summary.columnMatches.length < (result.summary.totalFiles * result.summary.matchedColumns.length) && (
              <div className="flex items-start gap-2 p-3 rounded-md border border-yellow-500/30 bg-yellow-500/5">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">Note:</span> Some columns were not found in all files.
                  Files without a matching column were skipped for that column.
                </div>
              </div>
            )}

            {result.resolvedColumns && result.resolvedColumns.length > 0 && (
              <div className="space-y-1">
                <Label className="text-sm">Output Columns</Label>
                <p className="text-xs text-muted-foreground">
                  The spreadsheet has "File Name" plus these columns:
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.resolvedColumns.map((col, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{col}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              The downloaded file contains two sheets:
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li><span className="font-medium">Values by File</span> - Each row has the file name and the selected columns as separate columns.</li>
                <li><span className="font-medium">Value Frequency</span> - Shows how many files each value appears in, grouped by column.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
