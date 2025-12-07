import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, RefreshCw, FileCheck, FileX, Server, AlertCircle, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";

interface SftpFileInfo {
  name: string;
  size: number;
  modifyTime: number;
  hasCurrentDate: boolean;
}

interface PathResult {
  path: string;
  files: SftpFileInfo[];
  allFilesHaveCurrentDate: boolean;
  totalFiles: number;
  filesWithCurrentDate: number;
  error?: string;
}

interface SftpMonitorResult {
  configId: string;
  configName: string;
  paths: PathResult[];
  allPathsHealthy: boolean;
  totalPaths: number;
  healthyPaths: number;
  error?: string;
}

export default function SftpMonitorPage() {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const { data: results = [], isLoading, refetch } = useQuery<SftpMonitorResult[]>({
    queryKey: ["/api/sftp/monitor"],
    refetchInterval: autoRefresh ? 60000 : false,
  });

  const handleRefresh = () => {
    refetch();
  };

  const toggleServer = (serverId: string) => {
    const newExpanded = new Set(expandedServers);
    if (newExpanded.has(serverId)) {
      newExpanded.delete(serverId);
    } else {
      newExpanded.add(serverId);
    }
    setExpandedServers(newExpanded);
  };

  const togglePath = (pathKey: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(pathKey)) {
      newExpanded.delete(pathKey);
    } else {
      newExpanded.add(pathKey);
    }
    setExpandedPaths(newExpanded);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold mb-2">SFTP File Monitor</h1>
          <p className="text-muted-foreground">
            Monitor SFTP servers for files with current date
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
            data-testid="button-toggle-refresh"
          >
            {autoRefresh ? "Disable" : "Enable"} Auto-Refresh
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={isLoading}
            data-testid="button-refresh-monitor"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Server Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : results.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Server className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No SFTP servers configured. Go to SFTP Configuration to add servers.
              </p>
            </CardContent>
          </Card>
        ) : (
          results.map((result) => (
            <Card
              key={result.configId}
              className="border-l-4"
              style={{
                borderLeftColor: result.error
                  ? "hsl(var(--destructive))"
                  : result.allPathsHealthy
                  ? "#22c55e"
                  : "#ef4444",
              }}
              data-testid={`card-server-${result.configId}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{result.configName}</CardTitle>
                  </div>
                  {result.error ? (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  ) : result.allPathsHealthy ? (
                    <FileCheck className="h-6 w-6" style={{ color: "#22c55e" }} />
                  ) : (
                    <FileX className="h-6 w-6" style={{ color: "#ef4444" }} />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.error ? (
                  <div className="text-sm text-destructive">
                    <p className="font-medium">Connection Error</p>
                    <p className="text-xs mt-1">{result.error}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Paths:</span>
                      <span className="font-medium">{result.totalPaths}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Healthy Paths:</span>
                      <span className="font-medium" style={{ color: "#22c55e" }}>
                        {result.healthyPaths}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Paths with Issues:</span>
                      <span
                        className="font-medium"
                        style={{ color: result.totalPaths - result.healthyPaths > 0 ? "#ef4444" : "#6b7280" }}
                      >
                        {result.totalPaths - result.healthyPaths}
                      </span>
                    </div>
                    <div className="pt-2 border-t">
                      <Badge
                        variant={result.allPathsHealthy ? "default" : "destructive"}
                        className="w-full justify-center"
                      >
                        {result.allPathsHealthy ? "All Paths Healthy" : "Some Paths Have Issues"}
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Detailed Path and File Listings */}
      {!isLoading && results.length > 0 && (
        <div className="space-y-4">
          {results.map((result) => (
            <Card key={`details-${result.configId}`} data-testid={`details-${result.configId}`}>
              <Collapsible
                open={expandedServers.has(result.configId)}
                onOpenChange={() => toggleServer(result.configId)}
              >
                <CardHeader className="cursor-pointer" onClick={() => toggleServer(result.configId)}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        {expandedServers.has(result.configId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <Server className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg font-medium">
                          {result.configName}
                        </CardTitle>
                        <Badge variant="outline" className="ml-2">
                          {result.totalPaths} path(s)
                        </Badge>
                      </div>
                      {result.error ? (
                        <Badge variant="destructive">Error</Badge>
                      ) : result.allPathsHealthy ? (
                        <Badge style={{ backgroundColor: "#22c55e", color: "white" }}>Healthy</Badge>
                      ) : (
                        <Badge variant="destructive">Issues Found</Badge>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CardDescription className="mt-2 ml-6">
                    {result.error ? (
                      <span className="text-destructive">{result.error}</span>
                    ) : (
                      `${result.healthyPaths} of ${result.totalPaths} paths are healthy`
                    )}
                  </CardDescription>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    {result.error ? (
                      <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-md">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <p className="text-sm">Unable to connect to SFTP server. Check configuration and credentials.</p>
                      </div>
                    ) : result.paths.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No paths configured for this server
                      </div>
                    ) : (
                      result.paths.map((pathResult, pathIdx) => {
                        const pathKey = `${result.configId}-${pathIdx}`;
                        return (
                          <Collapsible
                            key={pathKey}
                            open={expandedPaths.has(pathKey)}
                            onOpenChange={() => togglePath(pathKey)}
                          >
                            <div
                              className="border rounded-md p-3"
                              style={{
                                borderLeftWidth: "4px",
                                borderLeftColor: pathResult.error
                                  ? "hsl(var(--destructive))"
                                  : pathResult.allFilesHaveCurrentDate
                                  ? "#22c55e"
                                  : "#ef4444",
                              }}
                            >
                              <CollapsibleTrigger asChild>
                                <div
                                  className="flex items-center justify-between cursor-pointer"
                                  onClick={() => togglePath(pathKey)}
                                >
                                  <div className="flex items-center gap-2">
                                    {expandedPaths.has(pathKey) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-mono text-sm">{pathResult.path}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {pathResult.error ? (
                                      <Badge variant="destructive" className="text-xs">Error</Badge>
                                    ) : (
                                      <>
                                        <span className="text-xs text-muted-foreground">
                                          {pathResult.filesWithCurrentDate}/{pathResult.totalFiles} files current
                                        </span>
                                        {pathResult.allFilesHaveCurrentDate ? (
                                          <FileCheck className="h-4 w-4" style={{ color: "#22c55e" }} />
                                        ) : (
                                          <FileX className="h-4 w-4" style={{ color: "#ef4444" }} />
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="mt-3 pt-3 border-t">
                                  {pathResult.error ? (
                                    <div className="text-sm text-destructive">
                                      {pathResult.error}
                                    </div>
                                  ) : pathResult.files.length === 0 ? (
                                    <div className="text-center py-4 text-muted-foreground text-sm">
                                      No files found in this path
                                    </div>
                                  ) : (
                                    <div className="border rounded-md overflow-hidden">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="w-12">Status</TableHead>
                                            <TableHead>Filename</TableHead>
                                            <TableHead className="w-24">Size</TableHead>
                                            <TableHead className="w-44">Modified</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {pathResult.files.map((file, fileIdx) => (
                                            <TableRow
                                              key={fileIdx}
                                              className={file.hasCurrentDate ? "" : "bg-destructive/5"}
                                            >
                                              <TableCell>
                                                {file.hasCurrentDate ? (
                                                  <FileCheck className="h-4 w-4" style={{ color: "#22c55e" }} />
                                                ) : (
                                                  <FileX className="h-4 w-4" style={{ color: "#ef4444" }} />
                                                )}
                                              </TableCell>
                                              <TableCell
                                                className="font-mono text-sm"
                                                style={{
                                                  color: file.hasCurrentDate ? "#22c55e" : "#ef4444",
                                                }}
                                              >
                                                {file.name}
                                              </TableCell>
                                              <TableCell className="text-sm text-muted-foreground">
                                                {formatFileSize(file.size)}
                                              </TableCell>
                                              <TableCell className="text-sm text-muted-foreground font-mono">
                                                {formatDate(file.modifyTime)}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card>
        <CardContent className="flex items-start gap-2 pt-6">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">About Date Detection</p>
            <p className="text-muted-foreground">
              Files are considered current if their filename contains today's date in formats like YYYYMMDD, YYYY-MM-DD, or YYYY_MM_DD.
              Green indicates files with current date, red indicates files without current date. Each server can have multiple paths configured.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
