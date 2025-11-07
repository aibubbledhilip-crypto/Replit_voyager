import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Download, Search, ChevronDown, ChevronUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface QueryLog {
  id: string;
  timestamp: string;
  user: string;
  queryPreview: string;
  fullQuery: string;
  rowsReturned: number;
  executionTime: number;
  status: 'success' | 'error';
}

interface UsageLogsTableProps {
  logs?: QueryLog[];
}

export default function UsageLogsTable({ logs = [] }: UsageLogsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filteredLogs = logs.filter(log => 
    log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.queryPreview.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    console.log('Export logs to CSV');
  };

  return (
    <Card data-testid="card-usage-logs">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-medium">Usage Logs</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Track all query executions and user activity
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-logs">
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
        </div>

        <div className="flex gap-2 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by user or query..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-logs"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold w-12"></TableHead>
                <TableHead className="font-semibold">Timestamp</TableHead>
                <TableHead className="font-semibold">User</TableHead>
                <TableHead className="font-semibold">Query Preview</TableHead>
                <TableHead className="font-semibold text-right">Rows</TableHead>
                <TableHead className="font-semibold text-right">Time (ms)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <Collapsible
                  key={log.id}
                  open={expandedRow === log.id}
                  onOpenChange={(isOpen) => setExpandedRow(isOpen ? log.id : null)}
                  asChild
                >
                  <>
                    <TableRow data-testid={`row-log-${log.id}`}>
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-expand-${log.id}`}>
                            {expandedRow === log.id ? 
                              <ChevronUp className="h-3 w-3" /> : 
                              <ChevronDown className="h-3 w-3" />
                            }
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell className="text-sm">{log.timestamp}</TableCell>
                      <TableCell className="text-sm font-medium">{log.user}</TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground truncate max-w-xs">
                        {log.queryPreview}
                      </TableCell>
                      <TableCell className="text-sm text-right">{log.rowsReturned}</TableCell>
                      <TableCell className="text-sm text-right">{log.executionTime}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} className="p-0 border-0">
                        <CollapsibleContent>
                          <div className="bg-muted/30 p-4 border-t">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Full Query:</p>
                            <pre className="text-xs font-mono bg-background p-3 rounded border overflow-x-auto">
                              {log.fullQuery}
                            </pre>
                          </div>
                        </CollapsibleContent>
                      </TableCell>
                    </TableRow>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No logs found matching your search
          </div>
        )}
      </CardContent>
    </Card>
  );
}