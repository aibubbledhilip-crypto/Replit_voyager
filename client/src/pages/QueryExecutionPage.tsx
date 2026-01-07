import { useState } from "react";
import QueryBuilder from "@/components/QueryBuilder";
import ResultsTable from "@/components/ResultsTable";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Database, Table, ChevronRight, ChevronDown, Search, RefreshCw, Loader2, Columns, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";

interface TableColumn {
  name: string;
  type: string;
}

interface TableSchema {
  name: string;
  columns: TableColumn[];
}

interface SchemaResponse {
  database: string;
  tables: TableSchema[];
  totalTables: number;
  fetchedTables: number;
}

export default function QueryExecutionPage() {
  const [results, setResults] = useState<{
    columns: string[];
    data: Record<string, any>[];
    executionTime: number;
    rowLimit: number;
  } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [tableColumns, setTableColumns] = useState<Map<string, TableColumn[]>>(new Map());
  const [loadingColumns, setLoadingColumns] = useState<Set<string>>(new Set());
  const [failedColumns, setFailedColumns] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: schema, isLoading: isLoadingSchema, error: schemaError, refetch: refetchSchema } = useQuery<SchemaResponse>({
    queryKey: ['/api/query/schema'],
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const fetchColumns = async (tableName: string) => {
    if (tableColumns.has(tableName) || loadingColumns.has(tableName)) return;
    
    setLoadingColumns(prev => new Set(prev).add(tableName));
    setFailedColumns(prev => {
      const newSet = new Set(prev);
      newSet.delete(tableName);
      return newSet;
    });
    
    try {
      const response = await apiRequest(`/api/query/schema/${tableName}/columns`);
      setTableColumns(prev => new Map(prev).set(tableName, response.columns));
    } catch (error: any) {
      console.error(`Failed to load columns for ${tableName}:`, error);
      setFailedColumns(prev => new Set(prev).add(tableName));
      toast({
        title: "Column Load Failed",
        description: `Could not load columns for ${tableName}`,
        variant: "destructive",
      });
    } finally {
      setLoadingColumns(prev => {
        const newSet = new Set(prev);
        newSet.delete(tableName);
        return newSet;
      });
    }
  };

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

  const toggleTable = (tableName: string) => {
    setExpandedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableName)) {
        newSet.delete(tableName);
      } else {
        newSet.add(tableName);
        fetchColumns(tableName);
      }
      return newSet;
    });
  };

  const filteredTables = schema?.tables.filter(table =>
    table.name.toLowerCase().includes(searchFilter.toLowerCase())
  ) || [];

  const autocompleteSuggestions = [
    ...(schema?.tables.map(t => ({ label: t.name, type: 'table' as const })) || []),
    ...Array.from(tableColumns.entries()).flatMap(([tableName, cols]) =>
      cols.map(col => ({ label: col.name, type: 'column' as const, table: tableName }))
    )
  ];

  const getTableColumns = (tableName: string) => tableColumns.get(tableName) || [];

  return (
    <div className="flex gap-4 h-full">
      <Card className="w-72 flex-shrink-0 flex flex-col" data-testid="card-schema-browser">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Schema Browser
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/query/schema'] });
                refetchSchema();
              }}
              disabled={isLoadingSchema}
              data-testid="button-refresh-schema"
            >
              {isLoadingSchema ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter tables..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 h-9"
              data-testid="input-filter-tables"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4 pb-4">
            {isLoadingSchema ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading schema...
              </div>
            ) : schemaError ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="h-5 w-5 mb-2 text-destructive" />
                <span className="text-sm">Failed to load schema</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchSchema()}
                  className="mt-1"
                >
                  Try again
                </Button>
              </div>
            ) : schema ? (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground mb-2 px-1">
                  {schema.database} ({filteredTables.length} of {schema.totalTables} tables)
                </div>
                {filteredTables.map((table) => (
                  <Collapsible
                    key={table.name}
                    open={expandedTables.has(table.name)}
                    onOpenChange={() => toggleTable(table.name)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8 px-2 font-normal"
                        data-testid={`button-table-${table.name}`}
                      >
                        {expandedTables.has(table.name) ? (
                          <ChevronDown className="h-3 w-3 mr-1 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 mr-1 flex-shrink-0" />
                        )}
                        <Table className="h-3.5 w-3.5 mr-1.5 flex-shrink-0 text-blue-500" />
                        <span className="truncate text-xs">{table.name}</span>
                        {getTableColumns(table.name).length > 0 && (
                          <Badge variant="secondary" className="ml-auto text-[10px] h-5">
                            {getTableColumns(table.name).length}
                          </Badge>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 pl-2 border-l space-y-0.5 py-1">
                        {loadingColumns.has(table.name) ? (
                          <div className="flex items-center text-xs text-muted-foreground px-2 py-1">
                            <Loader2 className="h-3 w-3 animate-spin mr-2" />
                            Loading columns...
                          </div>
                        ) : failedColumns.has(table.name) ? (
                          <div className="flex items-center justify-between text-xs text-destructive px-2 py-1">
                            <span className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Failed to load
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 text-xs px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFailedColumns(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(table.name);
                                  return newSet;
                                });
                                fetchColumns(table.name);
                              }}
                            >
                              Retry
                            </Button>
                          </div>
                        ) : getTableColumns(table.name).length > 0 ? (
                          getTableColumns(table.name).map((col) => (
                            <div
                              key={col.name}
                              className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 rounded cursor-default"
                              title={`${col.name} (${col.type})`}
                            >
                              <Columns className="h-3 w-3 flex-shrink-0 text-orange-500" />
                              <span className="truncate">{col.name}</span>
                              <span className="text-[10px] text-muted-foreground/60 ml-auto">
                                {col.type}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground/60 px-2 py-1">
                            No columns available
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                No schema data
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="flex-1 space-y-4 min-w-0 overflow-auto">
        <QueryBuilder 
          onExecute={handleExecute}
          onClear={handleClear}
          connectionStatus="connected"
          suggestions={autocompleteSuggestions}
          onTableUsed={fetchColumns}
        />
        
        {isExecuting ? (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
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
    </div>
  );
}
