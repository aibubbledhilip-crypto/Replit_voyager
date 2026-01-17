import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Download, Brain, X, CheckCircle, AlertTriangle, AlertCircle, HelpCircle } from "lucide-react";
import ResultsTable from "@/components/ResultsTable";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import * as XLSX from "xlsx";

interface AIIssue {
  system: string;
  field: string;
  issue_type: string;
  description: string;
  expected: string | null;
  actual: string | null;
}

interface ParsedAIAnalysis {
  msisdn: string | null;
  overall_status: "OK" | "HAS_ISSUES";
  issues: AIIssue[];
  qa?: {
    question: string | null;
    answer: string | null;
  };
}

function tryParseAnalysis(analysis: string): ParsedAIAnalysis | null {
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = analysis.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.overall_status && Array.isArray(parsed.issues)) {
      return parsed as ParsedAIAnalysis;
    }
    return null;
  } catch {
    return null;
  }
}

function getIssueTypeColor(issueType: string): string {
  switch (issueType) {
    case "STATUS_MISMATCH":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "CODE_MISMATCH":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    case "MISSING_VALUE":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "PORTED_OUT_CONFLICT":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

function getSystemColor(system: string): string {
  switch (system) {
    case "Salesforce":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "Aria":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "Matrixx":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400";
    case "Nokia":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400";
    case "TrueFinder":
      return "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400";
    case "Cross-System":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

interface QueryResult {
  name: string;
  columns: string[];
  data: Record<string, any>[];
  rowsReturned: number;
  status: 'success' | 'error';
  error: string | null;
}

interface LookupResults {
  msisdn: string;
  results: QueryResult[];
  totalRowsReturned: number;
  executionTime: number;
  rowLimit: number;
}

interface AIAnalysisResult {
  analysis: string;
  model: string;
  sourceName: string;
  rowsAnalyzed: number;
  totalRows: number;
}

export default function ExplorerPage() {
  const [msisdn, setMsisdn] = useState("");
  const [results, setResults] = useState<LookupResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("");
  const { toast } = useToast();

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!msisdn.trim()) {
      toast({
        title: "MSISDN Required",
        description: "Please enter an MSISDN to search",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await apiRequest('/api/query/msisdn-lookup', {
        method: 'POST',
        body: JSON.stringify({ msisdn: msisdn.trim() }),
      });

      setResults(response);
      if (response.results.length > 0) {
        setActiveTab(response.results[0].name);
      }
      
      const successCount = response.results.filter((r: QueryResult) => r.status === 'success').length;
      toast({
        title: "Lookup Complete",
        description: `Retrieved ${response.totalRowsReturned} total rows from ${successCount} sources in ${response.executionTime}ms`,
      });
    } catch (error: any) {
      toast({
        title: "Lookup Failed",
        description: error.message || "Failed to execute MSISDN lookup",
        variant: "destructive",
      });
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setResults(null);
    setMsisdn("");
  };

  const handleExportExcel = () => {
    if (!results) return;

    const workbook = XLSX.utils.book_new();
    const rowLimit = results.rowLimit;

    results.results.forEach((result) => {
      let sheetData: any[][] = [];
      
      if (result.status === 'success' && result.columns.length > 0) {
        sheetData.push(result.columns);
        
        const exportData = result.data.slice(0, rowLimit);
        exportData.forEach((row) => {
          const rowValues = result.columns.map((col) => row[col] ?? '');
          sheetData.push(rowValues);
        });
      } else if (result.status === 'error') {
        sheetData.push(['Error']);
        sheetData.push([result.error || 'Query failed']);
      } else {
        sheetData.push(['No data found']);
      }

      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      
      if (result.columns.length > 0) {
        const colWidths = result.columns.map((col) => ({ wch: Math.max(col.length, 15) }));
        worksheet['!cols'] = colWidths;
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, result.name);
    });

    const fileName = `MSISDN_${results.msisdn}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Export Complete",
      description: `Downloaded ${fileName}`,
    });
  };

  const handleAIAnalyze = async () => {
    if (!results) return;

    // Collect all successful results from all sources
    const allSourcesData = results.results
      .filter(r => r.status === 'success' && r.data.length > 0)
      .map(r => ({
        source: r.name,
        data: r.data,
      }));

    if (allSourcesData.length === 0) {
      toast({
        title: "No Data to Analyze",
        description: "No data found across any sources",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const response = await apiRequest('/api/ai/analyze', {
        method: 'POST',
        body: JSON.stringify({
          data: allSourcesData,
          sourceName: `MSISDN Lookup (${results.msisdn})`,
          isMultiSource: true,
        }),
      });

      setAnalysisResult(response);
      setShowAnalysisDialog(true);
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze data",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Explorer</CardTitle>
          <CardDescription>
            Search across all data sources for a specific MSISDN
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLookup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="msisdn">MSISDN</Label>
              <div className="flex gap-2">
                <Input
                  id="msisdn"
                  data-testid="input-msisdn"
                  type="text"
                  placeholder="Enter MSISDN (e.g., 18322458086)"
                  value={msisdn}
                  onChange={(e) => setMsisdn(e.target.value)}
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  data-testid="button-lookup"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Lookup
                    </>
                  )}
                </Button>
                {results && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClear}
                    data-testid="button-clear"
                    disabled={isLoading}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle>Results for {results.msisdn}</CardTitle>
                <CardDescription>
                  Found {results.totalRowsReturned} total rows across {results.results.length} sources
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Execution time: {results.executionTime}ms
                </div>
                <Button
                  variant="outline"
                  onClick={handleExportExcel}
                  data-testid="button-export-excel"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button
                  variant="default"
                  onClick={handleAIAnalyze}
                  disabled={isAnalyzing}
                  data-testid="button-ai-analyze"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      AI Analyze
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs 
              defaultValue={results.results[0]?.name} 
              className="w-full"
              onValueChange={(value) => setActiveTab(value)}
            >
              <TabsList className="w-full justify-start flex-wrap h-auto">
                {results.results.map((result) => (
                  <TabsTrigger 
                    key={result.name} 
                    value={result.name}
                    data-testid={`tab-${result.name.toLowerCase()}`}
                    className="gap-2"
                  >
                    {result.name}
                    {result.status === 'success' ? (
                      <Badge variant="secondary" className="ml-2">
                        {result.rowsReturned}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="ml-2">
                        Error
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {results.results.map((result) => (
                <TabsContent 
                  key={result.name} 
                  value={result.name}
                  data-testid={`content-${result.name.toLowerCase()}`}
                >
                  {result.status === 'error' ? (
                    <div className="py-8 text-center">
                      <div className="text-destructive font-medium mb-2">
                        Query Failed
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {result.error}
                      </div>
                    </div>
                  ) : result.rowsReturned === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No data found in {result.name}
                    </div>
                  ) : (
                    <ResultsTable
                      columns={result.columns}
                      data={result.data}
                      totalRows={result.rowsReturned}
                      rowLimit={results.rowLimit}
                      executionTime={0}
                    />
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Dialog open={showAnalysisDialog} onOpenChange={setShowAnalysisDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Analysis - {analysisResult?.sourceName}
            </DialogTitle>
            <DialogDescription>
              Analyzed {analysisResult?.rowsAnalyzed} rows using {analysisResult?.model}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            {(() => {
              const parsed = analysisResult?.analysis ? tryParseAnalysis(analysisResult.analysis) : null;
              
              if (parsed) {
                return (
                  <div className="space-y-4 p-4">
                    {/* Status Header */}
                    <div className={`flex items-center gap-3 p-4 rounded-lg ${
                      parsed.overall_status === "OK" 
                        ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" 
                        : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                    }`}>
                      {parsed.overall_status === "OK" ? (
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                      )}
                      <div>
                        <div className="font-semibold text-lg">
                          {parsed.overall_status === "OK" ? "No Issues Found" : "Issues Detected"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          MSISDN: {parsed.msisdn || "N/A"}
                          {parsed.issues.length > 0 && ` • ${parsed.issues.length} issue${parsed.issues.length > 1 ? 's' : ''} found`}
                        </div>
                      </div>
                    </div>

                    {/* Issues List */}
                    {parsed.issues.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-base flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Issues ({parsed.issues.length})
                        </h3>
                        {parsed.issues.map((issue, index) => (
                          <Card key={index} className="border-l-4 border-l-destructive">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={getSystemColor(issue.system)}>
                                  {issue.system}
                                </Badge>
                                <Badge variant="outline" className={getIssueTypeColor(issue.issue_type)}>
                                  {issue.issue_type.replace(/_/g, ' ')}
                                </Badge>
                                <span className="text-sm font-mono text-muted-foreground">
                                  {issue.field}
                                </span>
                              </div>
                              <p className="text-sm">{issue.description}</p>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="bg-muted/50 rounded p-2">
                                  <div className="text-xs text-muted-foreground mb-1">Expected</div>
                                  <div className="font-mono text-xs break-all">
                                    {issue.expected === null ? <span className="text-muted-foreground italic">null</span> : issue.expected}
                                  </div>
                                </div>
                                <div className="bg-muted/50 rounded p-2">
                                  <div className="text-xs text-muted-foreground mb-1">Actual</div>
                                  <div className="font-mono text-xs break-all">
                                    {issue.actual === null ? <span className="text-muted-foreground italic">null</span> : issue.actual}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Q&A Section */}
                    {parsed.qa && (parsed.qa.question || parsed.qa.answer) && (
                      <div className="space-y-2">
                        <Separator />
                        <h3 className="font-semibold text-base flex items-center gap-2">
                          <HelpCircle className="h-4 w-4" />
                          Q&A
                        </h3>
                        <Card>
                          <CardContent className="p-4 space-y-2">
                            {parsed.qa.question && (
                              <div>
                                <div className="text-xs text-muted-foreground">Question</div>
                                <div className="text-sm">{parsed.qa.question}</div>
                              </div>
                            )}
                            {parsed.qa.answer && (
                              <div>
                                <div className="text-xs text-muted-foreground">Answer</div>
                                <div className="text-sm">{parsed.qa.answer}</div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                );
              }
              
              // Fallback: display raw analysis if not JSON
              return (
                <div className="prose prose-sm dark:prose-invert max-w-none p-4">
                  <pre className="whitespace-pre-wrap text-sm font-normal">
                    {analysisResult?.analysis}
                  </pre>
                </div>
              );
            })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
