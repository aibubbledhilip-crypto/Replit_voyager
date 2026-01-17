import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Download } from "lucide-react";
import ResultsTable from "@/components/ResultsTable";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

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

export default function ExplorerPage() {
  const [msisdn, setMsisdn] = useState("");
  const [results, setResults] = useState<LookupResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={results.results[0]?.name} className="w-full">
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
    </div>
  );
}
