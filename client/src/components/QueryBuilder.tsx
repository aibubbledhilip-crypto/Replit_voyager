import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Play, Trash2, Database } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface QueryBuilderProps {
  onExecute?: (query: string) => void;
  onClear?: () => void;
  connectionStatus?: 'connected' | 'disconnected';
}

export default function QueryBuilder({ 
  onExecute, 
  onClear,
  connectionStatus = 'connected'
}: QueryBuilderProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleExecute = () => {
    if (query.trim()) {
      console.log('Executing query:', query);
      onExecute?.(query);
    }
  };

  const handleClear = () => {
    setQuery("");
    console.log('Query cleared');
    onClear?.();
  };

  return (
    <Card data-testid="card-query-builder">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-medium">SQL Query Editor</CardTitle>
          <CardDescription className="text-sm mt-1">
            Write and execute SQL queries against AWS Athena
          </CardDescription>
        </div>
        <Badge 
          variant={connectionStatus === 'connected' ? 'default' : 'destructive'}
          className="h-6"
          data-testid="badge-connection-status"
        >
          {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="mb-2 h-8" data-testid="button-toggle-connection">
              <Database className="h-3.5 w-3.5 mr-2" />
              {isOpen ? 'Hide' : 'Show'} Connection Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pb-4">
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-md">
              <div>
                <span className="text-muted-foreground">Region:</span>
                <span className="ml-2 font-mono" data-testid="text-region">us-east-1</span>
              </div>
              <div>
                <span className="text-muted-foreground">S3 Location:</span>
                <span className="ml-2 font-mono truncate block" data-testid="text-s3-location">s3://dvsum-staging-prod</span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Textarea
          placeholder="SELECT * FROM your_table LIMIT 100;"
          className="min-h-64 font-mono text-sm resize-none"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="input-sql-query"
        />

        <div className="flex gap-2 justify-end flex-wrap">
          <Button 
            variant="outline" 
            onClick={handleClear}
            disabled={!query.trim()}
            data-testid="button-clear-query"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
          <Button 
            onClick={handleExecute}
            disabled={!query.trim()}
            data-testid="button-execute-query"
          >
            <Play className="h-4 w-4 mr-2" />
            Execute Query
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}