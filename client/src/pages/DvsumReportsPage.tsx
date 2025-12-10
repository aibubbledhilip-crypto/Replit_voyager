import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Download, Play, Loader2, CheckCircle, XCircle, FileDown, Eye, EyeOff } from "lucide-react";

interface DownloadStatus {
  ruleId: string;
  status: 'pending' | 'downloading' | 'success' | 'error';
  message?: string;
}

export default function DvsumReportsPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [downloadStatuses, setDownloadStatuses] = useState<DownloadStatus[]>([]);
  const [totalRules, setTotalRules] = useState(0);
  const [completedRules, setCompletedRules] = useState(0);
  const { toast } = useToast();

  const addStatusMessage = (message: string) => {
    setStatusMessages(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleStartDownload = async () => {
    if (!username || !password) {
      toast({
        title: "Missing Credentials",
        description: "Please enter your DVSum username and password",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setStatusMessages([]);
    setDownloadStatuses([]);
    setTotalRules(0);
    setCompletedRules(0);

    addStatusMessage("Starting DVSum report download...");

    try {
      const response = await fetch('/api/dvsum/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Download failed');
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const result = await response.json();
        
        if (result.success) {
          addStatusMessage(`Download complete! ${result.downloaded} reports downloaded.`);
          setProgress(100);
          
          if (result.downloadUrl) {
            addStatusMessage("Downloading ZIP file to your browser...");
            const link = document.createElement('a');
            link.href = result.downloadUrl;
            link.download = 'dvsum_reports.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          
          toast({
            title: "Download Complete",
            description: `Successfully downloaded ${result.downloaded} reports`,
          });
        } else {
          throw new Error(result.message || 'Download failed');
        }
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'dvsum_reports.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        addStatusMessage("Reports downloaded successfully!");
        setProgress(100);
        
        toast({
          title: "Download Complete",
          description: "Reports have been downloaded to your browser",
        });
      }
    } catch (error: any) {
      addStatusMessage(`Error: ${error.message}`);
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">DVSum Report Downloader</h1>
        <p className="text-muted-foreground">
          Download all rule reports from DVSum automatically
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-credentials">
          <CardHeader>
            <CardTitle className="text-lg">DVSum Credentials</CardTitle>
            <CardDescription>
              Enter your DVSum login credentials to start the download
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter DVSum username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isRunning}
                data-testid="input-dvsum-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter DVSum password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isRunning}
                  data-testid="input-dvsum-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button
              onClick={handleStartDownload}
              disabled={isRunning || !username || !password}
              className="w-full"
              data-testid="button-start-download"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Start Download
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-progress">
          <CardHeader>
            <CardTitle className="text-lg">Download Progress</CardTitle>
            <CardDescription>
              {isRunning ? "Download in progress..." : "Waiting to start"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" data-testid="progress-download" />
            </div>
            
            {totalRules > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {completedRules} / {totalRules} rules
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-status-log">
        <CardHeader>
          <CardTitle className="text-lg">Status Log</CardTitle>
          <CardDescription>Real-time download status updates</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 rounded-md border p-4">
            {statusMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activity yet. Enter your credentials and click "Start Download" to begin.
              </p>
            ) : (
              <div className="space-y-1 font-mono text-xs">
                {statusMessages.map((msg, idx) => (
                  <div key={idx} className="text-muted-foreground">
                    {msg}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card data-testid="card-instructions">
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Enter your DVSum username and password</li>
            <li>Click "Start Download" to begin the automation</li>
            <li>The system will log into DVSum and navigate to the Rules page</li>
            <li>Each rule's data will be exported as CSV</li>
            <li>All reports will be packaged into a ZIP file and downloaded to your browser</li>
          </ol>
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-sm">
              <strong>Note:</strong> This process may take several minutes depending on the number of rules.
              Please keep this page open until the download completes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
