import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Pencil, Trash2, TestTube, Eye, EyeOff, CheckCircle, XCircle,
  Database, Cloud, Star, Snowflake, BarChart3
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DB_TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  postgresql: { label: "PostgreSQL", icon: Database, color: "text-blue-500" },
  mysql: { label: "MySQL", icon: Database, color: "text-orange-500" },
  mssql: { label: "SQL Server", icon: Database, color: "text-red-500" },
  athena: { label: "AWS Athena", icon: Cloud, color: "text-yellow-500" },
  bigquery: { label: "Google BigQuery", icon: BarChart3, color: "text-green-500" },
  snowflake: { label: "Snowflake", icon: Snowflake, color: "text-cyan-500" },
  clickhouse: { label: "ClickHouse", icon: Database, color: "text-amber-500" },
};

const DEFAULT_PORTS: Record<string, number> = {
  postgresql: 5432,
  mysql: 3306,
  mssql: 1433,
  clickhouse: 8123,
};

const AWS_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
  { value: "eu-west-2", label: "Europe (London)" },
  { value: "eu-central-1", label: "Europe (Frankfurt)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { value: "sa-east-1", label: "South America (São Paulo)" },
  { value: "ca-central-1", label: "Canada (Central)" },
];

interface DbConnection {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  host: string | null;
  port: number | null;
  database: string | null;
  username: string | null;
  password: string | null;
  ssl: boolean;
  awsAccessKeyId: string | null;
  awsSecretAccessKey: string | null;
  awsRegion: string | null;
  s3OutputLocation: string | null;
  projectId: string | null;
  credentialsJson: string | null;
  dataset: string | null;
  account: string | null;
  warehouse: string | null;
  schema: string | null;
  role: string | null;
  isDefault: boolean;
  status: string;
  hasCredentials?: boolean;
}

const emptyForm: Partial<DbConnection> = {
  name: '',
  type: 'postgresql',
  host: '',
  port: 5432,
  database: '',
  username: '',
  password: '',
  ssl: false,
  awsAccessKeyId: '',
  awsSecretAccessKey: '',
  awsRegion: 'us-east-1',
  s3OutputLocation: '',
  projectId: '',
  credentialsJson: '',
  dataset: '',
  account: '',
  warehouse: '',
  schema: '',
  role: '',
  isDefault: false,
};

export default function DatabaseConnectionsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<DbConnection>>({ ...emptyForm });
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [athenaDbList, setAthenaDbList] = useState<string[]>([]);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);

  const { data: connections = [], isLoading } = useQuery<DbConnection[]>({
    queryKey: ['/api/db-connections'],
    queryFn: () => apiRequest('/api/db-connections'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<DbConnection>) =>
      apiRequest('/api/db-connections', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/db-connections'] });
      setDialogOpen(false);
      toast({ title: "Connection created", description: "Database connection has been added." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DbConnection> }) =>
      apiRequest(`/api/db-connections/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/db-connections'] });
      setDialogOpen(false);
      toast({ title: "Connection updated", description: "Database connection has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/db-connections/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/db-connections'] });
      setDeleteDialogOpen(false);
      toast({ title: "Connection deleted", description: "Database connection has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/db-connections/${id}/test`, { method: 'POST' }),
    onSuccess: (data: { success: boolean; message: string }) => {
      if (data.success) {
        toast({ title: "Connection successful", description: data.message });
      } else {
        toast({ title: "Connection failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    },
  });

  const testInlineMutation = useMutation({
    mutationFn: (data: Partial<DbConnection>) =>
      apiRequest('/api/db-connections/test-inline', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data: { success: boolean; message: string }) => {
      if (data.success) {
        toast({ title: "Connection successful", description: data.message });
      } else {
        toast({ title: "Connection failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/db-connections/${id}/set-default`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/db-connections'] });
      toast({ title: "Default updated", description: "Default connection has been changed." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to set default", description: error.message, variant: "destructive" });
    },
  });

  const openAddDialog = () => {
    setEditingId(null);
    setFormData({ ...emptyForm });
    setShowPasswords({});
    setAthenaDbList([]);
    setDialogOpen(true);
  };

  const openEditDialog = (conn: DbConnection) => {
    setEditingId(conn.id);
    setAthenaDbList([]);
    setFormData({
      name: conn.name,
      type: conn.type,
      host: conn.host || '',
      port: conn.port || DEFAULT_PORTS[conn.type] || null,
      database: conn.database || '',
      username: conn.username || '',
      password: conn.password || '',
      ssl: conn.ssl,
      awsAccessKeyId: conn.awsAccessKeyId || '',
      awsSecretAccessKey: conn.awsSecretAccessKey || '',
      awsRegion: conn.awsRegion || 'us-east-1',
      s3OutputLocation: conn.s3OutputLocation || '',
      projectId: conn.projectId || '',
      credentialsJson: conn.credentialsJson || '',
      dataset: conn.dataset || '',
      account: conn.account || '',
      warehouse: conn.warehouse || '',
      schema: conn.schema || '',
      role: conn.role || '',
      isDefault: conn.isDefault,
    });
    setShowPasswords({});
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.type) {
      toast({ title: "Validation error", description: "Name and type are required.", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleTypeChange = (type: string) => {
    setFormData(prev => ({
      ...prev,
      type,
      port: DEFAULT_PORTS[type] || null,
    }));
  };

  const togglePasswordField = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const fetchAthenaDatabases = async () => {
    if (!editingId) {
      toast({ title: "Save first", description: "Save the connection first, then edit it to fetch available databases.", variant: "destructive" });
      return;
    }
    setIsLoadingDatabases(true);
    try {
      const data = await apiRequest(`/api/query/athena-databases?connectionId=${editingId}`);
      setAthenaDbList(data.databases || []);
      if (data.databases?.length > 0) {
        toast({ title: "Databases loaded", description: `Found ${data.databases.length} database(s).` });
      } else {
        toast({ title: "No databases found", description: "No databases available in this Athena catalog.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Failed to fetch databases", description: error.message, variant: "destructive" });
    } finally {
      setIsLoadingDatabases(false);
    }
  };

  const needsStandardFields = ['postgresql', 'mysql', 'mssql', 'clickhouse'].includes(formData.type || '');
  const needsAthenaFields = formData.type === 'athena';
  const needsBigQueryFields = formData.type === 'bigquery';
  const needsSnowflakeFields = formData.type === 'snowflake';

  const isMutating = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground" data-testid="text-loading">Loading connections...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="db-connections-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Database Connections</h1>
          <p className="text-muted-foreground mt-1">
            Configure database connections for your organization. Supports PostgreSQL, MySQL, SQL Server, AWS Athena, BigQuery, Snowflake, and ClickHouse.
          </p>
        </div>
        <Button onClick={openAddDialog} data-testid="button-add-connection">
          <Plus className="h-4 w-4 mr-2" />
          Add Connection
        </Button>
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No connections configured</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add a database connection to start querying your data.
            </p>
            <Button onClick={openAddDialog} data-testid="button-add-first-connection">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connections.map((conn) => {
            const meta = DB_TYPE_META[conn.type] || { label: conn.type, icon: Database, color: "text-muted-foreground" };
            const TypeIcon = meta.icon;
            return (
              <Card key={conn.id} data-testid={`card-connection-${conn.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <TypeIcon className={`h-5 w-5 shrink-0 ${meta.color}`} />
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        {conn.name}
                        {conn.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-0.5">
                        {meta.label}
                        {conn.host && ` \u2022 ${conn.host}`}
                        {conn.port && `:${conn.port}`}
                        {conn.database && ` \u2022 ${conn.database}`}
                        {conn.account && ` \u2022 ${conn.account}`}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 flex-wrap">
                    {conn.hasCredentials ? (
                      <Badge variant="outline" className="text-xs gap-1" data-testid={`status-configured-${conn.id}`}>
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs gap-1" data-testid={`status-not-configured-${conn.id}`}>
                        <XCircle className="h-3 w-3 text-destructive" />
                        Not configured
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => testMutation.mutate(conn.id)}
                      disabled={testMutation.isPending || !conn.hasCredentials}
                      data-testid={`button-test-${conn.id}`}
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                    {!conn.isDefault && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDefaultMutation.mutate(conn.id)}
                        disabled={setDefaultMutation.isPending}
                        data-testid={`button-set-default-${conn.id}`}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(conn)}
                      data-testid={`button-edit-${conn.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setDeletingId(conn.id); setDeleteDialogOpen(true); }}
                      data-testid={`button-delete-${conn.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Connection' : 'Add Connection'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update the database connection details.' : 'Configure a new database connection for your organization.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Connection Name</Label>
              <Input
                data-testid="input-connection-name"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My Database"
              />
            </div>

            <div className="space-y-2">
              <Label>Database Type</Label>
              <Select
                value={formData.type || 'postgresql'}
                onValueChange={handleTypeChange}
                disabled={!!editingId}
              >
                <SelectTrigger data-testid="select-db-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DB_TYPE_META).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <meta.icon className={`h-4 w-4 ${meta.color}`} />
                        {meta.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsStandardFields && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label>Host</Label>
                    <Input
                      data-testid="input-host"
                      value={formData.host || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                      placeholder="localhost"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input
                      data-testid="input-port"
                      type="number"
                      value={formData.port || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || null }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Database</Label>
                  <Input
                    data-testid="input-database"
                    value={formData.database || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, database: e.target.value }))}
                    placeholder="mydb"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    data-testid="input-username"
                    value={formData.username || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      data-testid="input-password"
                      type={showPasswords['password'] ? 'text' : 'password'}
                      value={formData.password || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      onFocus={() => {
                        if (editingId && formData.password === '********') {
                          setFormData(prev => ({ ...prev, password: '' }));
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      onClick={() => togglePasswordField('password')}
                    >
                      {showPasswords['password'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    data-testid="switch-ssl"
                    checked={formData.ssl || false}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ssl: checked }))}
                  />
                  <Label>Enable SSL</Label>
                </div>
              </>
            )}

            {needsAthenaFields && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label>Athena Database Name</Label>
                    {editingId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={fetchAthenaDatabases}
                        disabled={isLoadingDatabases}
                        data-testid="button-fetch-databases"
                      >
                        <Database className="h-3 w-3 mr-1" />
                        {isLoadingDatabases ? 'Loading...' : 'Fetch Databases'}
                      </Button>
                    )}
                  </div>
                  {athenaDbList.length > 0 ? (
                    <Select
                      value={formData.database || ''}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, database: value }))}
                    >
                      <SelectTrigger data-testid="select-athena-database">
                        <SelectValue placeholder="Select a database" />
                      </SelectTrigger>
                      <SelectContent>
                        {athenaDbList.map((db) => (
                          <SelectItem key={db} value={db}>{db}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      data-testid="input-athena-database"
                      value={formData.database || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, database: e.target.value }))}
                      placeholder={editingId ? "Click 'Fetch Databases' or type manually" : "my_athena_database"}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Access Key ID</Label>
                  <Input
                    data-testid="input-aws-access-key"
                    value={formData.awsAccessKeyId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, awsAccessKeyId: e.target.value }))}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    onFocus={() => {
                      if (editingId && (formData.awsAccessKeyId || '').includes('****')) {
                        setFormData(prev => ({ ...prev, awsAccessKeyId: '' }));
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secret Access Key</Label>
                  <div className="relative">
                    <Input
                      data-testid="input-aws-secret-key"
                      type={showPasswords['awsSecret'] ? 'text' : 'password'}
                      value={formData.awsSecretAccessKey || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, awsSecretAccessKey: e.target.value }))}
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                      onFocus={() => {
                        if (editingId && formData.awsSecretAccessKey === '********') {
                          setFormData(prev => ({ ...prev, awsSecretAccessKey: '' }));
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      onClick={() => togglePasswordField('awsSecret')}
                    >
                      {showPasswords['awsSecret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>AWS Region</Label>
                  <Select
                    value={formData.awsRegion || 'us-east-1'}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, awsRegion: value }))}
                  >
                    <SelectTrigger data-testid="select-aws-region">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AWS_REGIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label} ({r.value})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>S3 Output Location</Label>
                  <Input
                    data-testid="input-s3-output"
                    value={formData.s3OutputLocation || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, s3OutputLocation: e.target.value }))}
                    placeholder="s3://your-bucket/athena-results/"
                  />
                </div>
              </>
            )}

            {needsBigQueryFields && (
              <>
                <div className="space-y-2">
                  <Label>Project ID</Label>
                  <Input
                    data-testid="input-project-id"
                    value={formData.projectId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
                    placeholder="my-gcp-project"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dataset</Label>
                  <Input
                    data-testid="input-dataset"
                    value={formData.dataset || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, dataset: e.target.value }))}
                    placeholder="my_dataset"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Service Account Credentials (JSON)</Label>
                  <Textarea
                    data-testid="input-credentials-json"
                    value={formData.credentialsJson || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, credentialsJson: e.target.value }))}
                    placeholder='Paste your service account JSON key...'
                    rows={4}
                    onFocus={() => {
                      if (editingId && formData.credentialsJson === '********') {
                        setFormData(prev => ({ ...prev, credentialsJson: '' }));
                      }
                    }}
                  />
                </div>
              </>
            )}

            {needsSnowflakeFields && (
              <>
                <div className="space-y-2">
                  <Label>Account Identifier</Label>
                  <Input
                    data-testid="input-account"
                    value={formData.account || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, account: e.target.value }))}
                    placeholder="myorg-myaccount"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    data-testid="input-sf-username"
                    value={formData.username || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      data-testid="input-sf-password"
                      type={showPasswords['sfPassword'] ? 'text' : 'password'}
                      value={formData.password || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      onFocus={() => {
                        if (editingId && formData.password === '********') {
                          setFormData(prev => ({ ...prev, password: '' }));
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      onClick={() => togglePasswordField('sfPassword')}
                    >
                      {showPasswords['sfPassword'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Warehouse</Label>
                  <Input
                    data-testid="input-warehouse"
                    value={formData.warehouse || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, warehouse: e.target.value }))}
                    placeholder="COMPUTE_WH"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Database</Label>
                    <Input
                      data-testid="input-sf-database"
                      value={formData.database || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, database: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Schema</Label>
                    <Input
                      data-testid="input-sf-schema"
                      value={formData.schema || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, schema: e.target.value }))}
                      placeholder="PUBLIC"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Role (optional)</Label>
                  <Input
                    data-testid="input-sf-role"
                    value={formData.role || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="SYSADMIN"
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <Switch
                data-testid="switch-is-default"
                checked={formData.isDefault || false}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
              />
              <Label>Set as default connection</Label>
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => testInlineMutation.mutate(formData)}
              disabled={testInlineMutation.isPending || !formData.type}
              data-testid="button-test-connection"
            >
              {testInlineMutation.isPending ? (
                <>Testing...</>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-1" />
                  Test Connection
                </>
              )}
            </Button>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isMutating} data-testid="button-save-connection">
                {isMutating ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this database connection? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
