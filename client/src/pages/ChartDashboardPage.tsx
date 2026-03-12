import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Plus, Trash2, Pencil, Play, BarChart2, TrendingUp, Activity, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DashboardChart } from "@shared/schema";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const CHART_TYPES = [
  { value: "bar", label: "Bar Chart", icon: BarChart2 },
  { value: "line", label: "Line Chart", icon: TrendingUp },
  { value: "area", label: "Area Chart", icon: Activity },
];

interface PreviewResult {
  columns: string[];
  rows: Record<string, any>[];
}

interface ChartFormState {
  name: string;
  description: string;
  sqlQuery: string;
  chartType: string;
  xAxisColumn: string;
  yAxisColumns: string[];
  connectionId: string;
}

const emptyForm: ChartFormState = {
  name: "",
  description: "",
  sqlQuery: "",
  chartType: "bar",
  xAxisColumn: "",
  yAxisColumns: [],
  connectionId: "",
};

function renderChart(chartType: string, data: Record<string, any>[], xCol: string, yCols: string[]) {
  if (!data.length || !xCol || !yCols.length) return null;

  const commonProps = {
    data,
    margin: { top: 5, right: 20, left: 0, bottom: 5 },
  };

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
      <XAxis dataKey={xCol} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={45} />
      <Tooltip contentStyle={{ fontSize: 12 }} />
      {yCols.length > 1 && <Legend />}
    </>
  );

  if (chartType === "line") {
    return (
      <LineChart {...commonProps}>
        {axes}
        {yCols.map((col, i) => (
          <Line key={col} type="monotone" dataKey={col} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={false} strokeWidth={2} />
        ))}
      </LineChart>
    );
  }

  if (chartType === "area") {
    return (
      <AreaChart {...commonProps}>
        {axes}
        {yCols.map((col, i) => (
          <Area key={col} type="monotone" dataKey={col} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
        ))}
      </AreaChart>
    );
  }

  return (
    <BarChart {...commonProps}>
      {axes}
      {yCols.map((col, i) => (
        <Bar key={col} dataKey={col} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
      ))}
    </BarChart>
  );
}

function ChartCard({ chart, onEdit, onDelete }: { chart: DashboardChart; onEdit: () => void; onDelete: () => void }) {
  const { data, isLoading, isError } = useQuery<PreviewResult>({
    queryKey: ['/api/dashboard/execute', chart.id, chart.sqlQuery],
    queryFn: () => apiRequest('/api/dashboard/execute', {
      method: 'POST',
      body: JSON.stringify({ sql: chart.sqlQuery, connectionId: chart.connectionId, limit: 500 }),
    }),
    retry: false,
  });

  const TypeIcon = CHART_TYPES.find(t => t.value === chart.chartType)?.icon || BarChart2;

  return (
    <Card data-testid={`chart-card-${chart.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              {chart.name}
            </CardTitle>
            {chart.description && (
              <CardDescription className="mt-0.5 text-xs">{chart.description}</CardDescription>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`button-edit-chart-${chart.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="text-destructive" data-testid={`button-delete-chart-${chart.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Chart</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{chart.name}"? This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Running query...</span>
          </div>
        )}
        {isError && (
          <div className="flex items-center justify-center h-48 text-destructive text-sm">
            Query failed. Check the SQL or connection.
          </div>
        )}
        {data && data.rows.length === 0 && (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No data returned
          </div>
        )}
        {data && data.rows.length > 0 && (
          <div>
            <ResponsiveContainer width="100%" height={240}>
              {renderChart(chart.chartType, data.rows, chart.xAxisColumn, chart.yAxisColumns) || <div />}
            </ResponsiveContainer>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">{data.rows.length} rows</Badge>
              <Badge variant="outline" className="text-xs capitalize">{chart.chartType}</Badge>
              <span className="text-xs text-muted-foreground ml-auto">X: {chart.xAxisColumn} · Y: {chart.yAxisColumns.join(', ')}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ChartDashboardPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<DashboardChart | null>(null);
  const [form, setForm] = useState<ChartFormState>(emptyForm);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const { data: charts = [], isLoading } = useQuery<DashboardChart[]>({
    queryKey: ['/api/dashboard/charts'],
    queryFn: () => apiRequest('/api/dashboard/charts'),
  });

  const { data: connections = [] } = useQuery<any[]>({
    queryKey: ['/api/db-connections'],
    queryFn: () => apiRequest('/api/db-connections'),
  });

  const createMutation = useMutation({
    mutationFn: (data: ChartFormState) => apiRequest('/api/dashboard/charts', {
      method: 'POST',
      body: JSON.stringify({ ...data, connectionId: data.connectionId || null }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/charts'] });
      toast({ title: "Chart saved" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: ChartFormState) => apiRequest(`/api/dashboard/charts/${editingChart!.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, connectionId: data.connectionId || null }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/charts'] });
      toast({ title: "Chart updated" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/dashboard/charts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/charts'] });
      toast({ title: "Chart deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openAdd = () => {
    setEditingChart(null);
    setForm(emptyForm);
    setPreview(null);
    setDialogOpen(true);
  };

  const openEdit = (chart: DashboardChart) => {
    setEditingChart(chart);
    setForm({
      name: chart.name,
      description: chart.description || "",
      sqlQuery: chart.sqlQuery,
      chartType: chart.chartType,
      xAxisColumn: chart.xAxisColumn,
      yAxisColumns: chart.yAxisColumns,
      connectionId: chart.connectionId || "",
    });
    setPreview(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingChart(null);
    setForm(emptyForm);
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!form.sqlQuery.trim()) {
      toast({ title: "SQL required", description: "Enter a SQL query to preview", variant: "destructive" });
      return;
    }
    setIsPreviewing(true);
    setPreview(null);
    try {
      const result = await apiRequest('/api/dashboard/execute', {
        method: 'POST',
        body: JSON.stringify({ sql: form.sqlQuery, connectionId: form.connectionId || null, limit: 500 }),
      });
      setPreview(result);
      if (!form.xAxisColumn && result.columns.length > 0) {
        setForm(prev => ({ ...prev, xAxisColumn: result.columns[0] }));
      }
      if (form.yAxisColumns.length === 0 && result.columns.length > 1) {
        setForm(prev => ({ ...prev, yAxisColumns: [result.columns[1]] }));
      }
    } catch (e: any) {
      toast({ title: "Query failed", description: e.message, variant: "destructive" });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast({ title: "Name required", variant: "destructive" });
    if (!form.sqlQuery.trim()) return toast({ title: "SQL required", variant: "destructive" });
    if (!form.xAxisColumn) return toast({ title: "X-axis column required", description: "Run a preview first, then select columns", variant: "destructive" });
    if (form.yAxisColumns.length === 0) return toast({ title: "At least one Y-axis column required", variant: "destructive" });

    if (editingChart) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  const toggleYAxis = (col: string) => {
    setForm(prev => ({
      ...prev,
      yAxisColumns: prev.yAxisColumns.includes(col)
        ? prev.yAxisColumns.filter(c => c !== col)
        : [...prev.yAxisColumns, col],
    }));
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-depiction-title">Depiction</h1>
          <p className="text-muted-foreground mt-1">Visualize query results as bar, line, or area charts</p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-chart">
          <Plus className="h-4 w-4 mr-2" />
          Add Chart
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading charts...
        </div>
      )}

      {!isLoading && charts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <BarChart2 className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No charts yet. Click "Add Chart" to create your first visualization.</p>
          </CardContent>
        </Card>
      )}

      {charts.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {charts.map(chart => (
            <ChartCard
              key={chart.id}
              chart={chart}
              onEdit={() => openEdit(chart)}
              onDelete={() => deleteMutation.mutate(chart.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingChart ? "Edit Chart" : "Add Chart"}</DialogTitle>
            <DialogDescription>
              Write a SQL query, preview the results, then configure your chart axes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="chart-name">Chart Name</Label>
                <Input
                  id="chart-name"
                  data-testid="input-chart-name"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Daily Query Volume"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chart-type">Chart Type</Label>
                <Select value={form.chartType} onValueChange={v => setForm(prev => ({ ...prev, chartType: v }))}>
                  <SelectTrigger id="chart-type" data-testid="select-chart-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHART_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chart-description">Description (optional)</Label>
              <Input
                id="chart-description"
                data-testid="input-chart-description"
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this chart"
              />
            </div>

            {connections.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="chart-connection">Database Connection</Label>
                <Select
                  value={form.connectionId || "default"}
                  onValueChange={v => setForm(prev => ({ ...prev, connectionId: v === "default" ? "" : v }))}
                >
                  <SelectTrigger id="chart-connection" data-testid="select-chart-connection">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default (Athena)</SelectItem>
                    {connections.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="chart-sql">SQL Query</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={isPreviewing}
                  data-testid="button-preview-sql"
                >
                  {isPreviewing ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running...</>
                  ) : (
                    <><Play className="h-3 w-3 mr-1" />Preview</>
                  )}
                </Button>
              </div>
              <Textarea
                id="chart-sql"
                data-testid="textarea-chart-sql"
                value={form.sqlQuery}
                onChange={e => setForm(prev => ({ ...prev, sqlQuery: e.target.value }))}
                placeholder="SELECT date, count FROM my_table ORDER BY date"
                className="font-mono text-sm min-h-[100px]"
              />
            </div>

            {preview && preview.rows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Preview</span>
                  <Badge variant="secondary">{preview.rows.length} rows · {preview.columns.length} columns</Badge>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="x-axis">X Axis Column</Label>
                    <Select value={form.xAxisColumn} onValueChange={v => setForm(prev => ({ ...prev, xAxisColumn: v }))}>
                      <SelectTrigger id="x-axis" data-testid="select-x-axis">
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {preview.columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Y Axis Columns</Label>
                    <div className="flex flex-wrap gap-2 border rounded-md p-2 min-h-9">
                      {preview.columns.filter(c => c !== form.xAxisColumn).map(col => (
                        <Badge
                          key={col}
                          variant={form.yAxisColumns.includes(col) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleYAxis(col)}
                          data-testid={`badge-y-axis-${col}`}
                        >
                          {col}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Click columns to toggle them on/off</p>
                  </div>
                </div>

                {form.xAxisColumn && form.yAxisColumns.length > 0 && (
                  <div className="border rounded-md p-3">
                    <ResponsiveContainer width="100%" height={200}>
                      {renderChart(form.chartType, preview.rows, form.xAxisColumn, form.yAxisColumns) || <div />}
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {preview && preview.rows.length === 0 && (
              <p className="text-sm text-muted-foreground">Query returned no rows.</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-chart">Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-chart">
                {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Chart"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
