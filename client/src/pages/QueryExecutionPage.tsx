import { useState } from "react";
import QueryBuilder from "@/components/QueryBuilder";
import ResultsTable from "@/components/ResultsTable";

export default function QueryExecutionPage() {
  const [results, setResults] = useState<{
    columns: string[];
    data: Record<string, any>[];
    executionTime: number;
  } | null>(null);

  const handleExecute = (query: string) => {
    console.log('Executing query:', query);
    
    setTimeout(() => {
      const mockColumns = ['id', 'name', 'email', 'department', 'created_at'];
      const mockData = Array.from({ length: 15 }, (_, i) => ({
        id: `${1000 + i}`,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        department: ['Engineering', 'Sales', 'Marketing', 'HR'][i % 4],
        created_at: `2025-01-${String(i + 1).padStart(2, '0')}`
      }));

      setResults({
        columns: mockColumns,
        data: mockData,
        executionTime: Math.floor(Math.random() * 500) + 100
      });
    }, 500);
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
      
      {results ? (
        <ResultsTable 
          columns={results.columns}
          data={results.data}
          totalRows={results.data.length}
          rowLimit={1000}
          executionTime={results.executionTime}
        />
      ) : (
        <ResultsTable />
      )}
    </div>
  );
}