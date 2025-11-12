import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Server, Loader2, TestTube } from "lucide-react";

interface SftpConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  remotePath: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function SftpConfigPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SftpConfig | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    host: "",
    port: 22,
    username: "",
    password: "",
    remotePath: "/",
    status: "active",
  });
  const [isTesting, setIsTesting] = useState(false);

  const { toast } = useToast();

  const { data: configs = [], isLoading } = useQuery<SftpConfig[]>({
    queryKey: ["/api/sftp/configs"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest("/api/sftp/configs", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sftp/configs"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "SFTP configuration created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create configuration",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      apiRequest(`/api/sftp/configs/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sftp/configs"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "SFTP configuration updated successfully",
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/sftp/configs/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sftp/configs"] });
      toast({
        title: "Success",
        description: "SFTP configuration deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete configuration",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      host: "",
      port: 22,
      username: "",
      password: "",
      remotePath: "/",
      status: "active",
    });
    setEditingConfig(null);
  };

  const handleOpenDialog = (config?: SftpConfig) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        name: config.name,
        host: config.host,
        port: config.port,
        username: config.username,
        password: "", // Don't populate password for security
        remotePath: config.remotePath,
        status: config.status,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleTest = async () => {
    if (!formData.host || !formData.username || !formData.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in host, username, and password",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const result: { success: boolean; error?: string } = await apiRequest("/api/sftp/test", {
        method: "POST",
        body: JSON.stringify({
          host: formData.host,
          port: formData.port,
          username: formData.username,
          password: formData.password,
          remotePath: formData.remotePath,
        }),
      });

      if (result.success) {
        toast({
          title: "Connection Successful",
          description: "SFTP server is accessible",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.error || "Unable to connect to SFTP server",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test connection",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold mb-2">SFTP Configuration</h1>
          <p className="text-muted-foreground">
            Manage SFTP server connections for file monitoring
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-sftp">
              <Plus className="h-4 w-4 mr-2" />
              Add SFTP Server
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? "Edit SFTP Configuration" : "Add SFTP Configuration"}
              </DialogTitle>
              <DialogDescription>
                Configure SFTP server connection details
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Configuration Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Production Server"
                  required
                  data-testid="input-sftp-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="sftp.example.com"
                    required
                    data-testid="input-sftp-host"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    required
                    data-testid="input-sftp-port"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="sftpuser"
                  required
                  data-testid="input-sftp-username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingConfig ? "Leave blank to keep current" : "Enter password"}
                  required={!editingConfig}
                  data-testid="input-sftp-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="remotePath">Remote Path</Label>
                <Input
                  id="remotePath"
                  value={formData.remotePath}
                  onChange={(e) => setFormData({ ...formData, remotePath: e.target.value })}
                  placeholder="/path/to/monitor"
                  required
                  data-testid="input-sftp-path"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTest}
                  disabled={isTesting}
                  className="flex-1"
                  data-testid="button-test-connection"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-sftp"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingConfig ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            SFTP Servers
          </CardTitle>
          <CardDescription>
            Configured SFTP servers for file monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No SFTP servers configured. Click "Add SFTP Server" to get started.
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config) => (
                    <TableRow key={config.id} data-testid={`row-sftp-${config.id}`}>
                      <TableCell className="font-medium">{config.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {config.host}:{config.port}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{config.username}</TableCell>
                      <TableCell className="font-mono text-sm">{config.remotePath}</TableCell>
                      <TableCell>
                        <Badge variant={config.status === 'active' ? 'default' : 'secondary'}>
                          {config.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(config)}
                            data-testid={`button-edit-${config.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Delete SFTP configuration "${config.name}"?`)) {
                                deleteMutation.mutate(config.id);
                              }
                            }}
                            data-testid={`button-delete-${config.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
