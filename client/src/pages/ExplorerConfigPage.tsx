import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Search } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DataSourceConfig {
  table: string;
  column: string;
}

interface ExplorerConfig {
  sf: DataSourceConfig;
  aria: DataSourceConfig;
  matrix: DataSourceConfig;
  trufinder: DataSourceConfig;
  nokia: DataSourceConfig;
}

const dataSourceLabels = {
  sf: { name: "SF", description: "Salesforce subscriber data" },
  aria: { name: "Aria", description: "Aria billing hierarchy" },
  matrix: { name: "Matrix", description: "Matrixx plan data" },
  trufinder: { name: "Trufinder", description: "True Finder raw data" },
  nokia: { name: "Nokia", description: "Nokia raw data" },
};

export default function ExplorerConfigPage() {
  const { toast } = useToast();

  const { data: sfTable } = useQuery({
    queryKey: ['/api/settings', 'explorer_table_sf'],
    queryFn: () => apiRequest('/api/settings/explorer_table_sf'),
  });
  const { data: sfColumn } = useQuery({
    queryKey: ['/api/settings', 'explorer_column_sf'],
    queryFn: () => apiRequest('/api/settings/explorer_column_sf'),
  });
  const { data: ariaTable } = useQuery({
    queryKey: ['/api/settings', 'explorer_table_aria'],
    queryFn: () => apiRequest('/api/settings/explorer_table_aria'),
  });
  const { data: ariaColumn } = useQuery({
    queryKey: ['/api/settings', 'explorer_column_aria'],
    queryFn: () => apiRequest('/api/settings/explorer_column_aria'),
  });
  const { data: matrixTable } = useQuery({
    queryKey: ['/api/settings', 'explorer_table_matrix'],
    queryFn: () => apiRequest('/api/settings/explorer_table_matrix'),
  });
  const { data: matrixColumn } = useQuery({
    queryKey: ['/api/settings', 'explorer_column_matrix'],
    queryFn: () => apiRequest('/api/settings/explorer_column_matrix'),
  });
  const { data: trufinderTable } = useQuery({
    queryKey: ['/api/settings', 'explorer_table_trufinder'],
    queryFn: () => apiRequest('/api/settings/explorer_table_trufinder'),
  });
  const { data: trufinderColumn } = useQuery({
    queryKey: ['/api/settings', 'explorer_column_trufinder'],
    queryFn: () => apiRequest('/api/settings/explorer_column_trufinder'),
  });
  const { data: nokiaTable } = useQuery({
    queryKey: ['/api/settings', 'explorer_table_nokia'],
    queryFn: () => apiRequest('/api/settings/explorer_table_nokia'),
  });
  const { data: nokiaColumn } = useQuery({
    queryKey: ['/api/settings', 'explorer_column_nokia'],
    queryFn: () => apiRequest('/api/settings/explorer_column_nokia'),
  });

  const [config, setConfig] = useState<ExplorerConfig>({
    sf: { table: '', column: '' },
    aria: { table: '', column: '' },
    matrix: { table: '', column: '' },
    trufinder: { table: '', column: '' },
    nokia: { table: '', column: '' },
  });

  useEffect(() => {
    setConfig({
      sf: { 
        table: sfTable?.value || 'vw_sf_all_segment_hierarchy', 
        column: sfColumn?.value || 'msisdn' 
      },
      aria: { 
        table: ariaTable?.value || 'vw_aria_hierarchy_all_status_reverse', 
        column: ariaColumn?.value || 'msisdn' 
      },
      matrix: { 
        table: matrixTable?.value || 'vw_matrixx_plan', 
        column: matrixColumn?.value || 'msisdn' 
      },
      trufinder: { 
        table: trufinderTable?.value || 'vw_true_finder_raw', 
        column: trufinderColumn?.value || 'msisdn' 
      },
      nokia: { 
        table: nokiaTable?.value || 'vw_nokia_raw', 
        column: nokiaColumn?.value || 'msisdn' 
      },
    });
  }, [sfTable, sfColumn, ariaTable, ariaColumn, matrixTable, matrixColumn, trufinderTable, trufinderColumn, nokiaTable, nokiaColumn]);

  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: ExplorerConfig) => {
      const updates = [
        { key: 'explorer_table_sf', value: newConfig.sf.table },
        { key: 'explorer_column_sf', value: newConfig.sf.column },
        { key: 'explorer_table_aria', value: newConfig.aria.table },
        { key: 'explorer_column_aria', value: newConfig.aria.column },
        { key: 'explorer_table_matrix', value: newConfig.matrix.table },
        { key: 'explorer_column_matrix', value: newConfig.matrix.column },
        { key: 'explorer_table_trufinder', value: newConfig.trufinder.table },
        { key: 'explorer_column_trufinder', value: newConfig.trufinder.column },
        { key: 'explorer_table_nokia', value: newConfig.nokia.table },
        { key: 'explorer_column_nokia', value: newConfig.nokia.column },
      ];
      
      for (const update of updates) {
        await apiRequest('/api/settings', {
          method: 'PUT',
          body: JSON.stringify(update),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Success",
        description: "Explorer configuration updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update configuration",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateConfigMutation.mutate(config);
  };

  const updateDataSource = (key: keyof ExplorerConfig, field: 'table' | 'column', value: string) => {
    setConfig(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Explorer Configuration</h1>
        <p className="text-muted-foreground">Configure the data sources used by the Explorer feature</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Data Source Configuration</CardTitle>
              <CardDescription>
                Configure the table name and WHERE condition column for each data source
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {(Object.keys(dataSourceLabels) as Array<keyof typeof dataSourceLabels>).map((key) => (
            <div key={key} className="border rounded-lg p-4 space-y-4">
              <div>
                <h3 className="font-medium">{dataSourceLabels[key].name}</h3>
                <p className="text-sm text-muted-foreground">{dataSourceLabels[key].description}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`table-${key}`}>Table/View Name</Label>
                  <Input
                    id={`table-${key}`}
                    data-testid={`input-explorer-table-${key}`}
                    value={config[key].table}
                    onChange={(e) => updateDataSource(key, 'table', e.target.value)}
                    placeholder="Enter table or view name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`column-${key}`}>WHERE Condition Column</Label>
                  <Input
                    id={`column-${key}`}
                    data-testid={`input-explorer-column-${key}`}
                    value={config[key].column}
                    onChange={(e) => updateDataSource(key, 'column', e.target.value)}
                    placeholder="Enter column name for WHERE clause"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSave} 
              disabled={updateConfigMutation.isPending}
              data-testid="button-save-explorer-config"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
