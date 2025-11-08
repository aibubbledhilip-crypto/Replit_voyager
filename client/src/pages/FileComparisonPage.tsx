import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Download, GitCompare, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from 'xlsx';
import { getCsrfToken } from "@/lib/api";

interface ComparisonSummary {
  file1Name: string;
  file2Name: string;
  file1TotalRows: number;
  file2TotalRows: number;
  uniqueToFile1Count: number;
  uniqueToFile2Count: number;
  commonRowsCount: number;
  deltaRowsCount: number;
  comparisonColumns: string[];
}

interface ComparisonResult {
  summary: ComparisonSummary;
  uniqueToFile1Count: number;
  uniqueToFile2Count: number;
  commonRowsCount: number;
  deltaRowsCount: number;
  downloadFileName: string;
  message: string;
}

export default function FileComparisonPage() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [file1Columns, setFile1Columns] = useState<string[]>([]);
  const [file2Columns, setFile2Columns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const { toast } = useToast();

  const handleFile1Change = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile1(file);
      setSelectedColumns([]); // Clear selected columns when new file is uploaded
      await analyzeFile(file, 'file1');
    }
  };

  const handleFile2Change = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile2(file);
      setSelectedColumns([]); // Clear selected columns when new file is uploaded
      await analyzeFile(file, 'file2');
    }
  };

  const analyzeFile = async (file: File, fileType: 'file1' | 'file2') => {
    setIsAnalyzing(true);
    
    try {
      if (file.name.endsWith('.csv')) {
        // For CSV files, parse on the client side
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          const firstLine = content.split('\n')[0];
          const columns = firstLine.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
          
          if (fileType === 'file1') {
            setFile1Columns(columns);
          } else {
            setFile2Columns(columns);
          }
          setIsAnalyzing(false);
        };
        
        reader.onerror = () => {
          toast({
            title: "Analysis Failed",
            description: "Failed to read CSV file",
            variant: "destructive",
          });
          setIsAnalyzing(false);
        };
        
        reader.readAsText(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // For XLSX files, use XLSX library to extract columns
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length > 0) {
              const columns = (jsonData[0] as any[]).map(col => String(col || ''));
              
              if (fileType === 'file1') {
                setFile1Columns(columns);
              } else {
                setFile2Columns(columns);
              }
            } else {
              throw new Error('XLSX file appears to be empty');
            }
            setIsAnalyzing(false);
          } catch (error: any) {
            toast({
              title: "XLSX Analysis Failed",
              description: error.message || "Failed to parse XLSX file",
              variant: "destructive",
            });
            setIsAnalyzing(false);
          }
        };
        
        reader.onerror = () => {
          toast({
            title: "Analysis Failed",
            description: "Failed to read XLSX file",
            variant: "destructive",
          });
          setIsAnalyzing(false);
        };
        
        reader.readAsArrayBuffer(file);
      } else {
        toast({
          title: "Unsupported File Type",
          description: "Please upload a CSV or XLSX file",
          variant: "destructive",
        });
        setIsAnalyzing(false);
      }
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze file columns",
        variant: "destructive",
      });
      setIsAnalyzing(false);
    }
  };

  const handleColumnToggle = (column: string) => {
    setSelectedColumns(prev => {
      if (prev.includes(column)) {
        return prev.filter(c => c !== column);
      } else {
        return [...prev, column];
      }
    });
  };

  const handleCompare = async () => {
    if (!file1 || !file2) {
      toast({
        title: "Files Required",
        description: "Please upload both files before comparing",
        variant: "destructive",
      });
      return;
    }

    if (selectedColumns.length === 0) {
      toast({
        title: "Columns Required",
        description: "Please select at least one key column for comparison",
        variant: "destructive",
      });
      return;
    }

    setIsComparing(true);
    
    try {
      // Get CSRF token
      const csrfToken = await getCsrfToken();
      
      const formData = new FormData();
      formData.append('file1', file1);
      formData.append('file2', file2);
      formData.append('keyColumns', JSON.stringify(selectedColumns));
      
      const response = await fetch('/api/compare/execute', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Comparison failed');
      }

      const result = await response.json();
      setComparisonResult(result);
      
      toast({
        title: "Comparison Complete",
        description: `Found ${result.uniqueToFile1Count} unique to file 1, ${result.uniqueToFile2Count} unique to file 2, and ${result.deltaRowsCount} differences`,
      });
    } catch (error: any) {
      toast({
        title: "Comparison Failed",
        description: error.message || "Failed to compare files",
        variant: "destructive",
      });
    } finally {
      setIsComparing(false);
    }
  };

  const handleDownload = () => {
    if (!comparisonResult) return;
    
    const link = document.createElement('a');
    link.href = `/api/compare/download/${comparisonResult.downloadFileName}`;
    link.setAttribute('download', comparisonResult.downloadFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setFile1(null);
    setFile2(null);
    setFile1Columns([]);
    setFile2Columns([]);
    setSelectedColumns([]);
    setComparisonResult(null);
  };

  const commonColumns = file1Columns.filter(col => file2Columns.includes(col));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">File Comparison</h1>
        <p className="text-muted-foreground">
          Compare two CSV or Excel files to identify unique rows, common rows, and data differences
        </p>
      </div>

      {/* File Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="card-file1-upload">
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              File 1
            </CardTitle>
            <CardDescription>Upload the first file (CSV or XLSX)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file1-input">Choose File</Label>
              <Input
                id="file1-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFile1Change}
                data-testid="input-file1"
              />
            </div>
            {file1 && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-medium">{file1.name}</span>
                <Badge variant="secondary" className="ml-auto">
                  {file1Columns.length} columns
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-file2-upload">
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              File 2
            </CardTitle>
            <CardDescription>Upload the second file (CSV or XLSX)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file2-input">Choose File</Label>
              <Input
                id="file2-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFile2Change}
                data-testid="input-file2"
              />
            </div>
            {file2 && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-medium">{file2.name}</span>
                <Badge variant="secondary" className="ml-auto">
                  {file2Columns.length} columns
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Column Selection */}
      {file1 && file2 && commonColumns.length > 0 && (
        <Card data-testid="card-column-selection">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Select Key Columns</CardTitle>
            <CardDescription>
              Choose one or more columns to use as the comparison key (must exist in both files)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {commonColumns.map(column => (
                <div key={column} className="flex items-center space-x-2">
                  <Checkbox
                    id={`col-${column}`}
                    checked={selectedColumns.includes(column)}
                    onCheckedChange={() => handleColumnToggle(column)}
                    data-testid={`checkbox-column-${column}`}
                  />
                  <Label
                    htmlFor={`col-${column}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {column}
                  </Label>
                </div>
              ))}
            </div>
            {selectedColumns.length > 0 && (
              <div className="mt-4 flex gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Selected:</span>
                {selectedColumns.map(col => (
                  <Badge key={col} variant="default">{col}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {file1 && file2 && (
        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={handleCompare}
            disabled={selectedColumns.length === 0 || isComparing}
            data-testid="button-compare"
          >
            {isComparing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                <GitCompare className="h-4 w-4 mr-2" />
                Compare Files
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleReset} data-testid="button-reset">
            Reset
          </Button>
        </div>
      )}

      {/* Comparison Results */}
      {comparisonResult && (
        <Card data-testid="card-comparison-results">
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-primary" />
              Comparison Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md">
                <div className="text-sm text-muted-foreground mb-1">Unique to File 1</div>
                <div className="text-2xl font-semibold text-blue-700 dark:text-blue-400" data-testid="text-unique-file1">
                  {comparisonResult.uniqueToFile1Count}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {comparisonResult.summary.file1Name}
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-md">
                <div className="text-sm text-muted-foreground mb-1">Unique to File 2</div>
                <div className="text-2xl font-semibold text-green-700 dark:text-green-400" data-testid="text-unique-file2">
                  {comparisonResult.uniqueToFile2Count}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {comparisonResult.summary.file2Name}
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-md">
                <div className="text-sm text-muted-foreground mb-1">Common Rows</div>
                <div className="text-2xl font-semibold text-purple-700 dark:text-purple-400" data-testid="text-common-rows">
                  {comparisonResult.commonRowsCount}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Identical</div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-md">
                <div className="text-sm text-muted-foreground mb-1">Differences</div>
                <div className="text-2xl font-semibold text-orange-700 dark:text-orange-400" data-testid="text-delta-rows">
                  {comparisonResult.deltaRowsCount}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Rows with changes</div>
              </div>
            </div>

            {/* File Information */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">File 1 Total Rows:</span>
                <span className="font-medium">{comparisonResult.summary.file1TotalRows}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">File 2 Total Rows:</span>
                <span className="font-medium">{comparisonResult.summary.file2TotalRows}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Comparison Key:</span>
                <span className="font-medium">{comparisonResult.summary.comparisonColumns.join(', ')}</span>
              </div>
            </div>

            {/* Download Button */}
            <Button onClick={handleDownload} data-testid="button-download-results">
              <Download className="h-4 w-4 mr-2" />
              Download Detailed Report (CSV)
            </Button>

            {/* Info Message */}
            <div className="flex items-start gap-2 p-4 bg-muted/30 rounded-md">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">About the Report</p>
                <p className="text-muted-foreground">
                  The CSV report includes: unique rows from each file, rows with differences showing which 
                  columns changed, and a comprehensive summary. All data is organized into separate sections.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
