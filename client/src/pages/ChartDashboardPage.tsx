import { useState, useRef } from "react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Plus, Trash2, Pencil, Play, BarChart2, BarChartHorizontal, TrendingUp, Activity, Loader2, RefreshCw, Copy, Download, MoreHorizontal, Check } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DashboardChart } from "@shared/schema";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const CHART_TYPES = [
  { value: "bar", label: "Bar (Vertical)", icon: BarChart2 },
  { value: "horizontal-bar", label: "Bar (Horizontal)", icon: BarChartHorizontal },
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

function coerceData(data: Record<string, any>[], yCols: string[]): Record<string, any>[] {
  return data.map(row => {
    const coerced: Record<string, any> = { ...row };
    for (const col of yCols) {
      const v = row[col];
      if (v !== null && v !== undefined && v !== '') {
        const n = Number(v);
        coerced[col] = isNaN(n) ? v : n;
      }
    }
    return coerced;
  });
}

function renderChart(chartType: string, data: Record<string, any>[], xCol: string, yCols: string[]) {
  if (!data.length || !xCol || !yCols.length) return null;

  const commonProps = {
    data: coerceData(data, yCols),
    margin: { top: 5, right: 20, left: 0, bottom: 60 },
  };

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
      <XAxis
        dataKey={xCol}
        interval={0}
        tick={{ fontSize: 11, angle: -35, textAnchor: "end", dy: 4 }}
        tickLine={false}
        axisLine={false}
        height={60}
      />
      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={55} />
      <Tooltip contentStyle={{ fontSize: 12 }} />
      {yCols.length > 1 && <Legend />}
    </>
  );

  if (chartType === "horizontal-bar") {
    const longestLabel = Math.max(...data.map(r => String(r[xCol] ?? '').length), 6);
    const yWidth = Math.min(Math.max(longestLabel * 7, 60), 160);
    return (
      <BarChart
        layout="vertical"
        data={coerceData(data, yCols)}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey={xCol}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={yWidth}
        />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        {yCols.length > 1 && <Legend />}
        {yCols.map((col, i) => (
          <Bar key={col} dataKey={col} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[0, 3, 3, 0]} />
        ))}
      </BarChart>
    );
  }

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

const CHART_DATA_STALE_MS = 10 * 60 * 1000; // 10 minutes

async function captureChartToBlob(containerEl: HTMLDivElement, chartName: string): Promise<Blob> {
  const svg = containerEl.querySelector('svg');
  if (!svg) throw new Error('No chart SVG found');

  const rect = svg.getBoundingClientRect();
  const svgW = rect.width || 600;
  const svgH = rect.height || 280;
  const pad = 20;
  const titleH = 36;
  const totalW = svgW + pad * 2;
  const totalH = svgH + titleH + pad * 2;

  const cloned = svg.cloneNode(true) as SVGElement;
  cloned.setAttribute('width', String(svgW));
  cloned.setAttribute('height', String(svgH));

  // Resolve stroke-border CSS class to a concrete color
  const rawBorder = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
  const borderColor = rawBorder ? `hsl(${rawBorder})` : '#e2e8f0';
  cloned.querySelectorAll('.stroke-border').forEach(el => {
    (el as SVGElement).setAttribute('stroke', borderColor);
    (el as SVGElement).removeAttribute('class');
  });

  const serialized = new XMLSerializer().serializeToString(cloned);
  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = totalW * scale;
      canvas.height = totalH * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalW, totalH);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px Inter, system-ui, sans-serif';
      ctx.fillText(chartName, pad, pad + 16, totalW - pad * 2);

      ctx.drawImage(img, pad, titleH + pad, svgW, svgH);
      URL.revokeObjectURL(svgUrl);

      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas export failed')), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(svgUrl); reject(new Error('Failed to render chart')); };
    img.src = svgUrl;
  });
}

function ChartCard({ chart, onEdit, onDelete }: { chart: DashboardChart; onEdit: () => void; onDelete: () => void }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'done'>('idle');
  const { toast } = useToast();

  const handleCopyImage = async () => {
    if (!chartContainerRef.current) return;
    setCopyState('copying');
    try {
      const blob = await captureChartToBlob(chartContainerRef.current, chart.name);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopyState('done');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (e: any) {
      setCopyState('idle');
      toast({ title: 'Copy failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleDownloadPng = async () => {
    if (!chartContainerRef.current) return;
    try {
      const blob = await captureChartToBlob(chartContainerRef.current, chart.name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chart.name.replace(/\s+/g, '_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    }
  };

  const { data, isLoading, isError, dataUpdatedAt } = useQuery<PreviewResult>({
    queryKey: ['/api/dashboard/execute', chart.id, chart.sqlQuery],
    queryFn: () => apiRequest('/api/dashboard/execute', {
      method: 'POST',
      body: JSON.stringify({ sql: chart.sqlQuery, connectionId: chart.connectionId, limit: 500 }),
    }),
    staleTime: CHART_DATA_STALE_MS,
    retry: false,
  });

  const lastFetched = dataUpdatedAt
    ? (() => {
        const diffMs = Date.now() - dataUpdatedAt;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return "just now";
        if (diffMins === 1) return "1 min ago";
        return `${diffMins} mins ago`;
      })()
    : null;

  const availableCols = data?.columns ?? [];
  const missingY = data ? chart.yAxisColumns.filter(c => !availableCols.includes(c)) : [];
  const xMissing = data ? !availableCols.includes(chart.xAxisColumn) : false;
  const hasMismatch = !!(data && data.rows.length > 0 && (missingY.length > 0 || xMissing));

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
            <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`button-edit-chart-${chart.id}`} title="Edit chart">
              <Pencil className="h-4 w-4" />
            </Button>

            {data && data.rows.length > 0 && !hasMismatch && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" data-testid={`button-export-chart-${chart.id}`} title="Export chart">
                    {copyState === 'copying' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : copyState === 'done' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCopyImage} data-testid={`menu-copy-image-${chart.id}`}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy as image
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadPng} data-testid={`menu-download-png-${chart.id}`}>
                    <Download className="h-4 w-4 mr-2" />
                    Download PNG
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="text-destructive" data-testid={`button-delete-chart-${chart.id}`} title="Delete chart">
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
        {hasMismatch && (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-4">
            <span className="text-sm text-destructive font-medium">Column mismatch</span>
            <span className="text-xs text-muted-foreground">
              {xMissing && <>X column <code className="bg-muted px-1 rounded">{chart.xAxisColumn}</code> not in results.</>}
              {missingY.length > 0 && <> Y column(s) <code className="bg-muted px-1 rounded">{missingY.join(', ')}</code> not in results.</>}
              <br />Query returns: {availableCols.join(', ')}
            </span>
            <Button size="sm" variant="outline" onClick={onEdit}>Edit Chart</Button>
          </div>
        )}
        {data && data.rows.length > 0 && !hasMismatch && (
          <div>
            <div ref={chartContainerRef}>
              <ResponsiveContainer width="100%" height={240}>
                {renderChart(chart.chartType, data.rows, chart.xAxisColumn, chart.yAxisColumns) || <div />}
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">{data.rows.length} rows</Badge>
              <Badge variant="outline" className="text-xs capitalize">{chart.chartType}</Badge>
              <span className="text-xs text-muted-foreground ml-auto">
                X: {chart.xAxisColumn} · Y: {chart.yAxisColumns.join(', ')}
                {lastFetched && <> · fetched {lastFetched}</>}
              </span>
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
    staleTime: 5 * 60 * 1000,
  });

  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/execute'] });
    queryClient.invalidateQueries({ queryKey: ['/api/dashboard/charts'] });
  };

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
        <div className="flex items-center gap-2">
          {charts.length > 0 && (
            <Button variant="outline" onClick={handleRefreshAll} data-testid="button-refresh-charts">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          )}
          <Button onClick={openAdd} data-testid="button-add-chart">
            <Plus className="h-4 w-4 mr-2" />
            Add Chart
          </Button>
        </div>
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
                onChange={e => {
                  setForm(prev => ({ ...prev, sqlQuery: e.target.value, xAxisColumn: '', yAxisColumns: [] }));
                  setPreview(null);
                }}
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
