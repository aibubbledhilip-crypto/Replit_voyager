import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Download, GitCompare, Loader2, CheckCircle2, XCircle, AlertCircle, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  matchingKeysCount: number;
  comparisonColumns: string[];
}

interface SeparateReports {
  summary: string | null;
  uniqueToFile1: string | null;
  uniqueToFile2: string | null;
  matchingKeys: string | null;
}

interface ComparisonResult {
  summary: ComparisonSummary;
  uniqueToFile1Count: number;
  uniqueToFile2Count: number;
  matchingKeysCount: number;
  separateReports: SeparateReports;
  message: string;
}

interface ColumnMapping {
  file1Column: string;
  file2Column: string;
}

export default function FileComparisonPage() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [file1Columns, setFile1Columns] = useState<string[]>([]);
  const [file2Columns, setFile2Columns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const { toast } = useToast();

  const handleFile1Change = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile1(file);
      setColumnMappings([]); // Clear column mappings when new file is uploaded
      await analyzeFile(file, 'file1');
    }
  };

  const handleFile2Change = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile2(file);
      setColumnMappings([]); // Clear column mappings when new file is uploaded
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

  const addMapping = () => {
    // Add a new empty mapping
    setColumnMappings([...columnMappings, { file1Column: '', file2Column: '' }]);
  };

  const updateMapping = (index: number, field: 'file1Column' | 'file2Column', value: string) => {
    const updated = [...columnMappings];
    updated[index][field] = value;
    setColumnMappings(updated);
  };

  const removeMapping = (index: number) => {
    setColumnMappings(columnMappings.filter((_, i) => i !== index));
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

    if (columnMappings.length === 0) {
      toast({
        title: "Column Mapping Required",
        description: "Please add at least one column mapping for comparison",
        variant: "destructive",
      });
      return;
    }

    // Validate that all mappings have both columns selected
    const incompleteMapping = columnMappings.find(m => !m.file1Column || !m.file2Column);
    if (incompleteMapping) {
      toast({
        title: "Incomplete Mapping",
        description: "Please select columns for all mappings",
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
      formData.append('columnMappings', JSON.stringify(columnMappings));
      
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
        description: `Found ${result.uniqueToFile1Count} only in file 1, ${result.uniqueToFile2Count} only in file 2, and ${result.matchingKeysCount} matching keys`,
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

  const handleDownload = (filename: string) => {
    if (!filename) return;
    
    const link = document.createElement('a');
    link.href = `/api/compare/download/${filename}`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setFile1(null);
    setFile2(null);
    setFile1Columns([]);
    setFile2Columns([]);
    setColumnMappings([]);
    setComparisonResult(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">File Comparison</h1>
        <p className="text-muted-foreground">
          Compare two CSV or Excel files to identify rows unique to each file and matching key rows
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
                className="file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer cursor-pointer"
              />
            </div>
            {isAnalyzing && file1 && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                <span className="font-medium">Analyzing {file1.name}...</span>
              </div>
            )}
            {!isAnalyzing && file1 && (
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
                className="file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer cursor-pointer"
              />
            </div>
            {isAnalyzing && file2 && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                <span className="font-medium">Analyzing {file2.name}...</span>
              </div>
            )}
            {!isAnalyzing && file2 && (
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

      {/* Column Mapping */}
      {file1 && file2 && file1Columns.length > 0 && file2Columns.length > 0 && (
        <Card data-testid="card-column-mapping">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Map Key Columns</CardTitle>
            <CardDescription>
              Map columns from File 1 to File 2 for comparison. Columns can have different names.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing Mappings */}
            {columnMappings.map((mapping, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-4 items-center p-4 border rounded-md">
                <div className="space-y-2">
                  <Label htmlFor={`file1-col-${index}`} className="text-sm text-muted-foreground">
                    File 1 Column
                  </Label>
                  <Select
                    value={mapping.file1Column}
                    onValueChange={(value) => updateMapping(index, 'file1Column', value)}
                  >
                    <SelectTrigger id={`file1-col-${index}`} data-testid={`select-file1-col-${index}`}>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {file1Columns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="hidden md:flex items-center justify-center text-muted-foreground">
                  →
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`file2-col-${index}`} className="text-sm text-muted-foreground">
                    File 2 Column
                  </Label>
                  <Select
                    value={mapping.file2Column}
                    onValueChange={(value) => updateMapping(index, 'file2Column', value)}
                  >
                    <SelectTrigger id={`file2-col-${index}`} data-testid={`select-file2-col-${index}`}>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {file2Columns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMapping(index)}
                  data-testid={`button-remove-mapping-${index}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            {/* Add Mapping Button */}
            <Button
              variant="outline"
              onClick={addMapping}
              className="w-full"
              data-testid="button-add-mapping"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Column Mapping
            </Button>
            
            {columnMappings.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>{columnMappings.length}</strong> column mapping{columnMappings.length !== 1 ? 's' : ''} defined
                </p>
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
            disabled={columnMappings.length === 0 || isComparing || isAnalyzing}
            data-testid="button-compare"
          >
            {isComparing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Comparing...
              </>
            ) : isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Files...
              </>
            ) : (
              <>
                <GitCompare className="h-4 w-4 mr-2" />
                Compare Files
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleReset} data-testid="button-reset" disabled={isAnalyzing || isComparing}>
            Reset
          </Button>
        </div>
      )}
      
      {/* Helper Text */}
      {file1 && file2 && !isAnalyzing && columnMappings.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Add at least one column mapping
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Click "Add Column Mapping" to map columns between your files. Columns can have different names in each file.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md">
                <div className="text-sm text-muted-foreground mb-1">Only in File 1</div>
                <div className="text-2xl font-semibold text-blue-700 dark:text-blue-400" data-testid="text-unique-file1">
                  {comparisonResult.uniqueToFile1Count}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Rows not in File 2
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-md">
                <div className="text-sm text-muted-foreground mb-1">Only in File 2</div>
                <div className="text-2xl font-semibold text-green-700 dark:text-green-400" data-testid="text-unique-file2">
                  {comparisonResult.uniqueToFile2Count}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Rows not in File 1
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-md">
                <div className="text-sm text-muted-foreground mb-1">Matching Keys</div>
                <div className="text-2xl font-semibold text-purple-700 dark:text-purple-400" data-testid="text-matching-keys">
                  {comparisonResult.matchingKeysCount}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Found in both files</div>
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

            {/* Download Buttons */}
            <div className="pt-4 border-t space-y-3">
              <h3 className="text-sm font-medium">Download Reports</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {comparisonResult.separateReports.summary && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(comparisonResult.separateReports.summary!)}
                    data-testid="button-download-summary"
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Summary
                  </Button>
                )}
                {comparisonResult.separateReports.uniqueToFile1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(comparisonResult.separateReports.uniqueToFile1!)}
                    data-testid="button-download-unique-file1"
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Unique to File 1 ({comparisonResult.uniqueToFile1Count})
                  </Button>
                )}
                {comparisonResult.separateReports.uniqueToFile2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(comparisonResult.separateReports.uniqueToFile2!)}
                    data-testid="button-download-unique-file2"
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Unique to File 2 ({comparisonResult.uniqueToFile2Count})
                  </Button>
                )}
                {comparisonResult.separateReports.matchingKeys && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(comparisonResult.separateReports.matchingKeys!)}
                    data-testid="button-download-matching-keys"
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Matching Keys ({comparisonResult.matchingKeysCount})
                  </Button>
                )}
              </div>
            </div>

            {/* Info Message */}
            <div className="flex items-start gap-2 p-4 bg-muted/30 rounded-md">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">About the Reports</p>
                <p className="text-muted-foreground">
                  Download individual reports for each category. Each CSV file contains specific data: 
                  rows unique to each file, matching keys with side-by-side data from both files, 
                  and a comprehensive summary.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
