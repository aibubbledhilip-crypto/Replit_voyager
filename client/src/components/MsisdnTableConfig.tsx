import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Table2 } from "lucide-react";

interface MsisdnTableConfigProps {
  tables: {
    sf: string;
    aria: string;
    matrix: string;
    trufinder: string;
    nokia: string;
  };
  onSave: (tables: { sf: string; aria: string; matrix: string; trufinder: string; nokia: string }) => void;
  isLoading?: boolean;
}

export default function MsisdnTableConfig({ tables, onSave, isLoading }: MsisdnTableConfigProps) {
  const [formData, setFormData] = useState(tables);

  useEffect(() => {
    setFormData(tables);
  }, [tables]);

  const handleSave = () => {
    onSave(formData);
  };

  const tableFields = [
    { key: "sf" as const, label: "SF", description: "Salesforce subscriber data" },
    { key: "aria" as const, label: "Aria", description: "Aria billing hierarchy" },
    { key: "matrix" as const, label: "Matrix", description: "Matrixx plan data" },
    { key: "trufinder" as const, label: "Trufinder", description: "True Finder raw data" },
    { key: "nokia" as const, label: "Nokia", description: "Nokia raw data" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Table2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>MSISDN Lookup Tables</CardTitle>
            <CardDescription>Configure the database tables/views used for MSISDN lookup queries</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tableFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={`table-${field.key}`}>{field.label} Table</Label>
              <Input
                id={`table-${field.key}`}
                data-testid={`input-msisdn-table-${field.key}`}
                value={formData[field.key]}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                placeholder={`Enter ${field.label} table name`}
              />
              <p className="text-xs text-muted-foreground">{field.description}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-4">
          <Button 
            onClick={handleSave} 
            disabled={isLoading}
            data-testid="button-save-msisdn-tables"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Table Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
