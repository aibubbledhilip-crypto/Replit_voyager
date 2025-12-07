import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { getCsrfToken } from "@/lib/api";
import { Plus, Edit, Trash2, Server, Loader2, TestTube, Upload, Key, FolderOpen, X } from "lucide-react";

interface SftpConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: string;
  remotePaths: string[];
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
    authType: "password" as "password" | "key",
    privateKey: "",
    passphrase: "",
    remotePaths: ["/"],
    status: "active",
  });
  const [isTesting, setIsTesting] = useState(false);
  const [keyFileName, setKeyFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const { data: configs = [], isLoading } = useQuery<SftpConfig[]>({
    queryKey: ["/api/sftp/configs"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/sftp/configs", data);
      return res.json();
    },
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
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await apiRequest("PUT", `/api/sftp/configs/${id}`, data);
      return res.json();
    },
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
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/sftp/configs/${id}`);
      return res.json();
    },
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
      authType: "password" as "password" | "key",
      privateKey: "",
      passphrase: "",
      remotePaths: ["/"],
      status: "active",
    });
    setEditingConfig(null);
    setKeyFileName("");
  };

  const handleOpenDialog = (config?: SftpConfig) => {
    if (config) {
      setEditingConfig(config);
      const paths = config.remotePaths && config.remotePaths.length > 0 
        ? config.remotePaths.map(p => p || "/")
        : ["/"];
      setFormData({
        name: config.name,
        host: config.host,
        port: config.port,
        username: config.username,
        password: "",
        authType: (config.authType || "password") as "password" | "key",
        privateKey: "",
        passphrase: "",
        remotePaths: paths,
        status: config.status,
      });
      setKeyFileName(config.authType === 'key' ? '(existing key)' : '');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pem') && !file.name.endsWith('.key')) {
      toast({
        title: "Invalid File",
        description: "Please upload a .pem or .key file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFormData({ ...formData, privateKey: content });
      setKeyFileName(file.name);
      toast({
        title: "File Loaded",
        description: `Private key loaded from ${file.name}`,
      });
    };
    reader.onerror = () => {
      toast({
        title: "Error",
        description: "Failed to read the file",
        variant: "destructive",
      });
    };
    reader.readAsText(file);
  };

  const handleAddPath = () => {
    setFormData({
      ...formData,
      remotePaths: [...formData.remotePaths, "/"],
    });
  };

  const handleRemovePath = (index: number) => {
    if (formData.remotePaths.length <= 1) {
      toast({
        title: "Cannot Remove",
        description: "At least one path is required",
        variant: "destructive",
      });
      return;
    }
    const newPaths = formData.remotePaths.filter((_, i) => i !== index);
    setFormData({ ...formData, remotePaths: newPaths });
  };

  const handlePathChange = (index: number, value: string) => {
    const newPaths = [...formData.remotePaths];
    newPaths[index] = value || "";
    setFormData({ ...formData, remotePaths: newPaths });
  };
  
  const ensureValidPaths = (paths: string[] | undefined | null): string[] => {
    if (!paths || paths.length === 0) {
      return ["/"];
    }
    return paths.map(p => p || "");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validPaths = formData.remotePaths.filter(p => p.trim() !== "");
    if (validPaths.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one valid path is required",
        variant: "destructive",
      });
      return;
    }

    const submitData = { ...formData, remotePaths: validPaths };
    
    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleTest = async () => {
    if (!formData.host || !formData.username) {
      toast({
        title: "Validation Error",
        description: "Please fill in host and username",
        variant: "destructive",
      });
      return;
    }

    if (formData.authType === "password" && !formData.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in password",
        variant: "destructive",
      });
      return;
    }

    if (formData.authType === "key" && !formData.privateKey && !editingConfig) {
      toast({
        title: "Validation Error",
        description: "Please upload a private key file",
        variant: "destructive",
      });
      return;
    }

    const validPaths = formData.remotePaths.filter(p => p.trim() !== "");
    if (validPaths.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one path is required",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch("/api/sftp/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify({
          host: formData.host,
          port: formData.port,
          username: formData.username,
          password: formData.authType === "password" ? formData.password : undefined,
          authType: formData.authType,
          privateKey: formData.authType === "key" ? formData.privateKey : undefined,
          passphrase: formData.authType === "key" ? formData.passphrase : undefined,
          remotePaths: validPaths,
        }),
      });
      const result: { success: boolean; error?: string } = await res.json();

      if (result.success) {
        toast({
          title: "Connection Successful",
          description: `SFTP server is accessible. Verified ${validPaths.length} path(s).`,
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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? "Edit SFTP Configuration" : "Add SFTP Configuration"}
              </DialogTitle>
              <DialogDescription>
                Configure SFTP server connection details and paths to monitor
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
                <Label>Authentication Type</Label>
                <RadioGroup
                  value={formData.authType}
                  onValueChange={(value) => setFormData({ ...formData, authType: value as "password" | "key" })}
                  className="flex gap-4"
                  data-testid="radio-auth-type"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="password" id="auth-password" data-testid="radio-auth-password" />
                    <Label htmlFor="auth-password" className="font-normal cursor-pointer">Password</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="key" id="auth-key" data-testid="radio-auth-key" />
                    <Label htmlFor="auth-key" className="font-normal cursor-pointer flex items-center gap-1">
                      <Key className="h-3 w-3" />
                      Private Key (PEM)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.authType === "password" ? (
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
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Private Key File (.pem)</Label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".pem,.key"
                      className="hidden"
                      data-testid="input-sftp-key-file"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1"
                        data-testid="button-upload-key"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {keyFileName || "Upload .pem File"}
                      </Button>
                      {keyFileName && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setFormData({ ...formData, privateKey: "" });
                            setKeyFileName("");
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          data-testid="button-clear-key"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {editingConfig && !keyFileName && (
                      <p className="text-xs text-muted-foreground">
                        Leave blank to keep the existing key
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passphrase">Passphrase (optional)</Label>
                    <Input
                      id="passphrase"
                      type="password"
                      value={formData.passphrase}
                      onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                      placeholder="Leave blank if key is not encrypted"
                      data-testid="input-sftp-passphrase"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Remote Paths to Monitor
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddPath}
                    data-testid="button-add-path"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Path
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.remotePaths.map((path, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={path || ""}
                        onChange={(e) => handlePathChange(index, e.target.value)}
                        placeholder="/path/to/monitor"
                        data-testid={`input-sftp-path-${index}`}
                      />
                      {formData.remotePaths.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemovePath(index)}
                          data-testid={`button-remove-path-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Add multiple paths to monitor different directories on the same server
                </p>
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
                    <TableHead>Auth</TableHead>
                    <TableHead>Paths</TableHead>
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
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          {config.authType === 'key' ? (
                            <><Key className="h-3 w-3" /> Key</>
                          ) : (
                            'Password'
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <FolderOpen className="h-3 w-3" />
                          {config.remotePaths?.length || 1} path(s)
                        </Badge>
                      </TableCell>
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
