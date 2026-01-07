import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Save, Monitor, Download } from "lucide-react";

interface QueryLimitControlProps {
  displayLimit?: number;
  exportLimit?: number;
  onUpdateDisplayLimit?: (newLimit: number) => void;
  onUpdateExportLimit?: (newLimit: number) => void;
}

export default function QueryLimitControl({ 
  displayLimit = 10000, 
  exportLimit = 1000,
  onUpdateDisplayLimit,
  onUpdateExportLimit
}: QueryLimitControlProps) {
  const [localDisplayLimit, setLocalDisplayLimit] = useState(displayLimit);
  const [localExportLimit, setLocalExportLimit] = useState(exportLimit);

  useEffect(() => {
    setLocalDisplayLimit(displayLimit);
  }, [displayLimit]);

  useEffect(() => {
    setLocalExportLimit(exportLimit);
  }, [exportLimit]);

  const handleUpdateDisplay = () => {
    onUpdateDisplayLimit?.(localDisplayLimit);
  };

  const handleUpdateExport = () => {
    onUpdateExportLimit?.(localExportLimit);
  };

  return (
    <Card data-testid="card-query-limit">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-medium">Query Row Limits</CardTitle>
        </div>
        <CardDescription>
          Configure separate limits for displaying results and exporting data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="display-limit" className="font-medium">Display Limit</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Maximum rows to show in query results table
          </p>
          <div className="flex gap-2">
            <Input
              id="display-limit"
              type="number"
              min="100"
              max="100000"
              value={localDisplayLimit}
              onChange={(e) => setLocalDisplayLimit(parseInt(e.target.value) || 0)}
              className="max-w-xs"
              data-testid="input-display-limit"
            />
            <Button onClick={handleUpdateDisplay} data-testid="button-update-display-limit">
              <Save className="h-4 w-4 mr-2" />
              Update
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Current: <span className="font-semibold" data-testid="text-current-display-limit">{displayLimit.toLocaleString()} rows</span>
          </p>
        </div>

        <div className="border-t pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="export-limit" className="font-medium">Export Limit</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Maximum rows users can download via CSV export
          </p>
          <div className="flex gap-2">
            <Input
              id="export-limit"
              type="number"
              min="1"
              max="100000"
              value={localExportLimit}
              onChange={(e) => setLocalExportLimit(parseInt(e.target.value) || 0)}
              className="max-w-xs"
              data-testid="input-export-limit"
            />
            <Button onClick={handleUpdateExport} data-testid="button-update-export-limit">
              <Save className="h-4 w-4 mr-2" />
              Update
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Current: <span className="font-semibold" data-testid="text-current-export-limit">{exportLimit.toLocaleString()} rows</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
