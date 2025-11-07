import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ResultsTableProps {
  columns?: string[];
  data?: Record<string, any>[];
  totalRows?: number;
  rowLimit?: number;
  executionTime?: number;
}

export default function ResultsTable({ 
  columns = [],
  data = [],
  totalRows = 0,
  rowLimit = 1000,
  executionTime = 0
}: ResultsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const totalPages = Math.ceil(data.length / rowsPerPage);
  
  const currentData = data.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleExport = () => {
    console.log('Export to CSV triggered');
  };

  if (columns.length === 0) {
    return (
      <Card data-testid="card-results-empty">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">Execute a query to see results</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-results-table">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4 flex-wrap">
        <div>
          <CardTitle className="text-lg font-medium">Query Results</CardTitle>
          <div className="flex gap-3 mt-2 flex-wrap">
            <span className="text-sm text-muted-foreground" data-testid="text-row-count">
              Showing {currentData.length} of {data.length} rows
            </span>
            <Badge variant="secondary" className="h-5 text-xs" data-testid="badge-row-limit">
              Limit: {rowLimit}
            </Badge>
            {executionTime > 0 && (
              <span className="text-sm text-muted-foreground" data-testid="text-execution-time">
                Executed in {executionTime}ms
              </span>
            )}
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleExport}
          data-testid="button-export-csv"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </CardHeader>

      <CardContent>
        <div className="border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col, idx) => (
                    <TableHead key={idx} className="font-semibold uppercase text-xs tracking-wide" data-testid={`header-${col}`}>
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.map((row, rowIdx) => (
                  <TableRow key={rowIdx} data-testid={`row-${rowIdx}`}>
                    {columns.map((col, colIdx) => (
                      <TableCell key={colIdx} className="text-sm font-mono" data-testid={`cell-${rowIdx}-${col}`}>
                        {row[col]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}