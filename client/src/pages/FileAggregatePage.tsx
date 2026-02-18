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
import { FileText, Upload, Download, Layers, Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";
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
    matchedColumn: string;
    matchType: string;
    columnMatches: Array<{ fileName: string; matchedColumnName: string }>;
  };
  detailCount: number;
  frequencyCount: number;
  downloadFile: string;
  message: string;
}

export default function FileAggregatePage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [columnName, setColumnName] = useState("");
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

  const handleAggregate = async () => {
    if (files.length < 2) {
      toast({ title: "Not enough files", description: "Please upload at least 2 files.", variant: "destructive" });
      return;
    }
    if (!columnName.trim()) {
      toast({ title: "Column name required", description: "Please enter a column name to aggregate on.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f.file));
      formData.append('columnName', columnName.trim());
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

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto" data-testid="file-aggregate-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">File Aggregate</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload multiple CSV or Excel files, specify a column name, and aggregate matching values across all files.
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
            <Input
              id="file-input"
              type="file"
              accept=".csv,.xlsx,.xls"
              multiple
              onChange={handleFilesChange}
              data-testid="input-file-upload"
            />
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
            Specify the column name to aggregate across all uploaded files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Column Name</Label>
              <Input
                placeholder="Enter column name..."
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                data-testid="input-column-name"
              />
              {allColumns.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {allColumns.slice(0, 15).map(col => (
                    <Badge
                      key={col}
                      variant="outline"
                      className="text-xs cursor-pointer"
                      onClick={() => setColumnName(col)}
                      data-testid={`badge-column-${col}`}
                    >
                      {col}
                    </Badge>
                  ))}
                  {allColumns.length > 15 && (
                    <span className="text-xs text-muted-foreground self-center">
                      +{allColumns.length - 15} more
                    </span>
                  )}
                </div>
              )}
            </div>

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
                  ? 'Column name must match exactly (case-insensitive).'
                  : 'Column name can be a substring of the actual column name.'}
              </p>
            </div>
          </div>

          <Button
            onClick={handleAggregate}
            disabled={isProcessing || files.length < 2 || !columnName.trim()}
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
                <div className="text-xs text-muted-foreground">Match Type</div>
                <div className="text-lg font-semibold capitalize" data-testid="text-match-type">{result.summary.matchType}</div>
              </div>
            </div>

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

            {result.summary.columnMatches.length < result.summary.totalFiles && (
              <div className="flex items-start gap-2 p-3 rounded-md border border-yellow-500/30 bg-yellow-500/5">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">Warning:</span> Column "{result.summary.matchedColumn}" was not found in{' '}
                  {result.summary.totalFiles - result.summary.columnMatches.length} file(s).
                  Those files were skipped.
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              The downloaded file contains two sheets:
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li><span className="font-medium">Values by File</span> - Each row shows the file name, matched column, and its values.</li>
                <li><span className="font-medium">Value Frequency</span> - Shows how many files each value appears in.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
