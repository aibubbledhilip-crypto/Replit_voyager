import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Search, Database, Trash2, Plus, SlidersHorizontal } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DataSourceConfig {
  key: string;
  label: string;
  description: string;
  table: string;
  column: string;
}


export default function ExplorerConfigPage() {
  const { toast } = useToast();

  const { data: athenaDatabase } = useQuery({
    queryKey: ['/api/settings', 'athena_database'],
    queryFn: () => apiRequest('/api/settings/athena_database'),
  });

  const { data: allSettings, isLoading: settingsLoading } = useQuery<Array<{ key: string; value: string }>>({
    queryKey: ['/api/settings'],
    queryFn: () => apiRequest('/api/settings'),
  });

  const [databaseName, setDatabaseName] = useState('');
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSource, setNewSource] = useState({ key: "", label: "", description: "", table: "", column: "" });

  const [lookupLabel, setLookupLabel] = useState('MSISDN');
  const [lookupPlaceholder, setLookupPlaceholder] = useState('Enter MSISDN (e.g., 18322458086)');
  const [lookupValidation, setLookupValidation] = useState('digits_only');

  useEffect(() => {
    setDatabaseName(athenaDatabase?.value || '');
  }, [athenaDatabase]);

  useEffect(() => {
    if (!allSettings) return;

    const settingsMap = new Map<string, string>();
    if (Array.isArray(allSettings)) {
      allSettings.forEach((s: { key: string; value: string }) => {
        settingsMap.set(s.key, s.value);
      });
    }

    if (settingsMap.has('explorer_lookup_label')) setLookupLabel(settingsMap.get('explorer_lookup_label')!);
    if (settingsMap.has('explorer_lookup_placeholder')) setLookupPlaceholder(settingsMap.get('explorer_lookup_placeholder')!);
    if (settingsMap.has('explorer_lookup_validation')) setLookupValidation(settingsMap.get('explorer_lookup_validation')!);

    const explorerKeys = new Set<string>();
    settingsMap.forEach((_, key) => {
      const match = key.match(/^explorer_table_(.+)$/);
      if (match) explorerKeys.add(match[1]);
    });

    if (explorerKeys.size === 0) {
      setDataSources([]);
      return;
    }

    const sources: DataSourceConfig[] = [];
    explorerKeys.forEach((sourceKey) => {
      const table = settingsMap.get(`explorer_table_${sourceKey}`) || '';
      const column = settingsMap.get(`explorer_column_${sourceKey}`) || '';
      const label = settingsMap.get(`explorer_label_${sourceKey}`) || sourceKey.toUpperCase();
      const description = settingsMap.get(`explorer_desc_${sourceKey}`) || '';
      sources.push({ key: sourceKey, label, description, table, column });
    });

    sources.sort((a, b) => a.label.localeCompare(b.label));

    setDataSources(sources);
  }, [allSettings]);

  const updateDatabaseMutation = useMutation({
    mutationFn: async (dbName: string) => {
      await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: 'athena_database', value: dbName }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({ title: "Success", description: "Athena database updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update database", variant: "destructive" });
    },
  });

  const saveLookupFieldMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: 'explorer_lookup_label', value: lookupLabel },
        { key: 'explorer_lookup_placeholder', value: lookupPlaceholder },
        { key: 'explorer_lookup_validation', value: lookupValidation },
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
      toast({ title: "Success", description: "Lookup field settings saved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save lookup field settings", variant: "destructive" });
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (sources: DataSourceConfig[]) => {
      for (const source of sources) {
        const updates = [
          { key: `explorer_table_${source.key}`, value: source.table },
          { key: `explorer_column_${source.key}`, value: source.column },
          { key: `explorer_label_${source.key}`, value: source.label },
          { key: `explorer_desc_${source.key}`, value: source.description },
        ];
        for (const update of updates) {
          await apiRequest('/api/settings', {
            method: 'PUT',
            body: JSON.stringify(update),
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({ title: "Success", description: "Explorer configuration saved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save configuration", variant: "destructive" });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (sourceKey: string) => {
      const keysToDelete = [
        `explorer_table_${sourceKey}`,
        `explorer_column_${sourceKey}`,
        `explorer_label_${sourceKey}`,
        `explorer_desc_${sourceKey}`,
      ];
      for (const key of keysToDelete) {
        await apiRequest(`/api/settings/${key}`, { method: 'DELETE' });
      }
    },
    onSuccess: (_data, sourceKey) => {
      setDataSources(prev => prev.filter(s => s.key !== sourceKey));
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({ title: "Success", description: "Data source removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete data source", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveConfigMutation.mutate(dataSources);
  };

  const updateDataSource = (key: string, field: keyof DataSourceConfig, value: string) => {
    setDataSources(prev =>
      prev.map(s => s.key === key ? { ...s, [field]: value } : s)
    );
  };

  const handleAddSource = () => {
    const sanitizedKey = newSource.key.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    if (!sanitizedKey) {
      toast({ title: "Error", description: "Please provide a valid key (letters, numbers, underscores)", variant: "destructive" });
      return;
    }
    if (dataSources.some(s => s.key === sanitizedKey)) {
      toast({ title: "Error", description: "A data source with this key already exists", variant: "destructive" });
      return;
    }
    if (!newSource.table) {
      toast({ title: "Error", description: "Table/View name is required", variant: "destructive" });
      return;
    }
    if (!newSource.column) {
      toast({ title: "Error", description: "WHERE condition column is required", variant: "destructive" });
      return;
    }

    const source: DataSourceConfig = {
      key: sanitizedKey,
      label: newSource.label || sanitizedKey.toUpperCase(),
      description: newSource.description,
      table: newSource.table,
      column: newSource.column,
    };
    setDataSources(prev => [...prev, source]);
    setNewSource({ key: "", label: "", description: "", table: "", column: "" });
    setShowAddForm(false);
    toast({ title: "Added", description: `Data source "${source.label}" added. Click "Save Configuration" to persist.` });
  };

  const handleClearAll = () => {
    setDataSources([]);
    toast({ title: "Cleared", description: "All data sources cleared. Click \"Save Configuration\" to persist." });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2" data-testid="text-explorer-config-title">Explorer Configuration</h1>
        <p className="text-muted-foreground">Configure the data sources used by the Explorer feature</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Athena Database</CardTitle>
              <CardDescription>
                Configure the AWS Athena database name used for all queries
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label htmlFor="athena-database">Database Name</Label>
              <Input
                id="athena-database"
                data-testid="input-athena-database"
                value={databaseName}
                onChange={(e) => setDatabaseName(e.target.value)}
                placeholder="Enter Athena database name"
              />
            </div>
            <Button
              onClick={() => updateDatabaseMutation.mutate(databaseName)}
              disabled={updateDatabaseMutation.isPending}
              data-testid="button-save-database"
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Lookup Field</CardTitle>
              <CardDescription>
                Configure the search field shown in the Explorer — its label, placeholder, and input validation
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lookup-label">Field Label</Label>
              <Input
                id="lookup-label"
                data-testid="input-lookup-label"
                value={lookupLabel}
                onChange={(e) => setLookupLabel(e.target.value)}
                placeholder="e.g. MSISDN, Subscriber ID, Device ID"
              />
              <p className="text-xs text-muted-foreground">Shown as the input label in Explorer</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lookup-placeholder">Placeholder Text</Label>
              <Input
                id="lookup-placeholder"
                data-testid="input-lookup-placeholder"
                value={lookupPlaceholder}
                onChange={(e) => setLookupPlaceholder(e.target.value)}
                placeholder="e.g. Enter MSISDN (e.g., 18322458086)"
              />
              <p className="text-xs text-muted-foreground">Hint text shown inside the input field</p>
            </div>
          </div>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="lookup-validation">Input Validation</Label>
            <Select value={lookupValidation} onValueChange={setLookupValidation}>
              <SelectTrigger id="lookup-validation" data-testid="select-lookup-validation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="digits_only">Digits only (e.g. phone numbers)</SelectItem>
                <SelectItem value="alphanumeric">Alphanumeric (letters and numbers)</SelectItem>
                <SelectItem value="any">Any input (no format restriction)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Controls what characters are accepted at lookup time</p>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => saveLookupFieldMutation.mutate()}
              disabled={saveLookupFieldMutation.isPending}
              data-testid="button-save-lookup-field"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveLookupFieldMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Data Source Configuration</CardTitle>
                <CardDescription>
                  Configure, add, or remove the table name and WHERE condition column for each data source
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={handleClearAll}
                disabled={dataSources.length === 0}
                data-testid="button-clear-all"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddForm(!showAddForm)}
                data-testid="button-add-datasource"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Data Source
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New Data Source</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-key">Key (unique identifier)</Label>
                    <Input
                      id="new-key"
                      data-testid="input-new-source-key"
                      value={newSource.key}
                      onChange={(e) => setNewSource(prev => ({ ...prev, key: e.target.value }))}
                      placeholder="e.g. hubspot, custom_crm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-label">Display Name</Label>
                    <Input
                      id="new-label"
                      data-testid="input-new-source-label"
                      value={newSource.label}
                      onChange={(e) => setNewSource(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="e.g. HubSpot, Custom CRM"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-description">Description</Label>
                  <Input
                    id="new-description"
                    data-testid="input-new-source-description"
                    value={newSource.description}
                    onChange={(e) => setNewSource(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this data source"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-table">Table/View Name</Label>
                    <Input
                      id="new-table"
                      data-testid="input-new-source-table"
                      value={newSource.table}
                      onChange={(e) => setNewSource(prev => ({ ...prev, table: e.target.value }))}
                      placeholder="Enter table or view name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-column">WHERE Condition Column</Label>
                    <Input
                      id="new-column"
                      data-testid="input-new-source-column"
                      value={newSource.column}
                      onChange={(e) => setNewSource(prev => ({ ...prev, column: e.target.value }))}
                      placeholder="e.g. msisdn"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setShowAddForm(false); setNewSource({ key: "", label: "", description: "", table: "", column: "" }); }} data-testid="button-cancel-add">
                    Cancel
                  </Button>
                  <Button onClick={handleAddSource} data-testid="button-confirm-add">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {settingsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading configuration...</div>
          ) : dataSources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No data sources configured. Click "Add Data Source" or "Reset to Defaults" to get started.
            </div>
          ) : (
            dataSources.map((source) => (
              <div key={source.key} className="border rounded-md p-4 space-y-4" data-testid={`datasource-card-${source.key}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`label-${source.key}`}>Display Name</Label>
                        <Input
                          id={`label-${source.key}`}
                          data-testid={`input-explorer-label-${source.key}`}
                          value={source.label}
                          onChange={(e) => updateDataSource(source.key, 'label', e.target.value)}
                          placeholder="Display name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`desc-${source.key}`}>Description</Label>
                        <Input
                          id={`desc-${source.key}`}
                          data-testid={`input-explorer-desc-${source.key}`}
                          value={source.description}
                          onChange={(e) => updateDataSource(source.key, 'description', e.target.value)}
                          placeholder="Brief description"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`table-${source.key}`}>Table/View Name</Label>
                        <Input
                          id={`table-${source.key}`}
                          data-testid={`input-explorer-table-${source.key}`}
                          value={source.table}
                          onChange={(e) => updateDataSource(source.key, 'table', e.target.value)}
                          placeholder="Enter table or view name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`column-${source.key}`}>WHERE Condition Column</Label>
                        <Input
                          id={`column-${source.key}`}
                          data-testid={`input-explorer-column-${source.key}`}
                          value={source.column}
                          onChange={(e) => updateDataSource(source.key, 'column', e.target.value)}
                          placeholder="Enter column name for WHERE clause"
                        />
                      </div>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive shrink-0 mt-6"
                        data-testid={`button-delete-datasource-${source.key}`}
                        disabled={deleteSourceMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Data Source</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove the "{source.label}" data source? This will delete its table and column configuration. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteSourceMutation.mutate(source.key)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-testid="button-confirm-delete"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={saveConfigMutation.isPending || dataSources.length === 0}
              data-testid="button-save-explorer-config"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveConfigMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
