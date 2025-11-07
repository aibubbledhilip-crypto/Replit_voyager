import { useState } from "react";
import QueryBuilder from "@/components/QueryBuilder";
import ResultsTable from "@/components/ResultsTable";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function QueryExecutionPage() {
  const [results, setResults] = useState<{
    columns: string[];
    data: Record<string, any>[];
    executionTime: number;
    rowLimit: number;
  } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const { toast } = useToast();

  const handleExecute = async (query: string) => {
    setIsExecuting(true);
    
    try {
      const response = await apiRequest('/api/query/execute', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });

      setResults(response);
      toast({
        title: "Query Executed",
        description: `Retrieved ${response.data.length} rows in ${response.executionTime}ms`,
      });
    } catch (error: any) {
      toast({
        title: "Query Failed",
        description: error.message || "Failed to execute query",
        variant: "destructive",
      });
      setResults(null);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClear = () => {
    setResults(null);
  };

  return (
    <div className="space-y-6">
      <QueryBuilder 
        onExecute={handleExecute}
        onClear={handleClear}
        connectionStatus="connected"
      />
      
      {isExecuting ? (
        <div className="text-center py-12 text-muted-foreground">
          Executing query...
        </div>
      ) : results ? (
        <ResultsTable 
          columns={results.columns}
          data={results.data}
          totalRows={results.data.length}
          rowLimit={results.rowLimit}
          executionTime={results.executionTime}
        />
      ) : (
        <ResultsTable />
      )}
    </div>
  );
}