import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Save } from "lucide-react";

interface QueryLimitControlProps {
  currentLimit?: number;
  onUpdate?: (newLimit: number) => void;
}

export default function QueryLimitControl({ currentLimit = 1000, onUpdate }: QueryLimitControlProps) {
  const [limit, setLimit] = useState(currentLimit);

  const handleUpdate = () => {
    console.log('Update limit to:', limit);
    onUpdate?.(limit);
  };

  return (
    <Card data-testid="card-query-limit">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-medium">Query Row Limit</CardTitle>
        </div>
        <CardDescription>
          Set the maximum number of rows that can be extracted per query
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="row-limit">Maximum Rows</Label>
          <div className="flex gap-2">
            <Input
              id="row-limit"
              type="number"
              min="1"
              max="100000"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
              className="max-w-xs"
              data-testid="input-row-limit"
            />
            <Button onClick={handleUpdate} data-testid="button-update-limit">
              <Save className="h-4 w-4 mr-2" />
              Update Limit
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Current limit: <span className="font-semibold" data-testid="text-current-limit">{currentLimit} rows</span>
        </p>
      </CardContent>
    </Card>
  );
}