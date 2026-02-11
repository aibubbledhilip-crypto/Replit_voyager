import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, TestTube, Eye, EyeOff, CheckCircle, XCircle, Cloud } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  { value: "me-south-1", label: "Middle East (Bahrain)" },
  { value: "af-south-1", label: "Africa (Cape Town)" },
];

interface AwsConfig {
  organizationId: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  s3OutputLocation: string;
  hasCredentials?: boolean;
}

export default function AwsConfigPage() {
  const { toast } = useToast();
  const [showSecretKey, setShowSecretKey] = useState(false);

  const { data: config, isLoading } = useQuery<AwsConfig>({
    queryKey: ['/api/aws-config'],
    queryFn: () => apiRequest('/api/aws-config'),
  });

  const [formData, setFormData] = useState({
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsRegion: 'us-east-1',
    s3OutputLocation: '',
  });

  useEffect(() => {
    if (config) {
      setFormData({
        awsAccessKeyId: config.awsAccessKeyId || '',
        awsSecretAccessKey: config.awsSecretAccessKey || '',
        awsRegion: config.awsRegion || 'us-east-1',
        s3OutputLocation: config.s3OutputLocation || '',
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest('/api/aws-config', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/aws-config'] });
      toast({ title: "Configuration saved", description: "AWS settings have been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/aws-config/test', { method: 'POST' }),
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

  const handleSave = () => {
    if (!formData.awsRegion) {
      toast({ title: "Validation error", description: "AWS Region is required.", variant: "destructive" });
      return;
    }
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground" data-testid="text-loading">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="aws-config-page">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">AWS Configuration</h1>
        <p className="text-muted-foreground mt-1">
          Configure AWS credentials and Athena connection settings for your organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            AWS Credentials
          </CardTitle>
          <CardDescription>
            Provide your AWS Access Key and Secret Access Key to connect to AWS Athena. These credentials are stored securely and scoped to your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="awsAccessKeyId">Access Key ID</Label>
            <Input
              id="awsAccessKeyId"
              data-testid="input-aws-access-key"
              value={formData.awsAccessKeyId}
              onChange={(e) => setFormData(prev => ({ ...prev, awsAccessKeyId: e.target.value }))}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              onFocus={(e) => {
                if (config?.hasCredentials && formData.awsAccessKeyId.includes('****')) {
                  setFormData(prev => ({ ...prev, awsAccessKeyId: '' }));
                }
              }}
            />
            {config?.hasCredentials && formData.awsAccessKeyId.includes('****') && (
              <p className="text-xs text-muted-foreground">
                Click to enter a new Access Key ID, or leave unchanged to keep the existing value.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="awsSecretAccessKey">Secret Access Key</Label>
            <div className="relative">
              <Input
                id="awsSecretAccessKey"
                data-testid="input-aws-secret-key"
                type={showSecretKey ? "text" : "password"}
                value={formData.awsSecretAccessKey}
                onChange={(e) => setFormData(prev => ({ ...prev, awsSecretAccessKey: e.target.value }))}
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                onFocus={(e) => {
                  if (config?.hasCredentials && formData.awsSecretAccessKey === '********') {
                    setFormData(prev => ({ ...prev, awsSecretAccessKey: '' }));
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowSecretKey(!showSecretKey)}
                data-testid="button-toggle-secret"
              >
                {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {config?.hasCredentials && (
              <p className="text-xs text-muted-foreground">
                Credentials are already configured. Leave fields unchanged to keep the existing values.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Athena Connection Settings</CardTitle>
          <CardDescription>
            Configure the AWS region and S3 output location for Athena query results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="awsRegion">AWS Region</Label>
            <Select
              value={formData.awsRegion}
              onValueChange={(value) => setFormData(prev => ({ ...prev, awsRegion: value }))}
            >
              <SelectTrigger data-testid="select-aws-region">
                <SelectValue placeholder="Select a region" />
              </SelectTrigger>
              <SelectContent>
                {AWS_REGIONS.map((region) => (
                  <SelectItem key={region.value} value={region.value}>
                    {region.label} ({region.value})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="s3OutputLocation">S3 Output Location</Label>
            <Input
              id="s3OutputLocation"
              data-testid="input-s3-output"
              value={formData.s3OutputLocation}
              onChange={(e) => setFormData(prev => ({ ...prev, s3OutputLocation: e.target.value }))}
              placeholder="s3://your-bucket/athena-results/"
            />
            <p className="text-xs text-muted-foreground">
              The S3 bucket path where Athena will store query results.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
          <CardDescription>
            Save your configuration and test the connection to verify everything is working.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {config?.hasCredentials ? (
              <div className="flex items-center gap-2 text-sm" data-testid="status-credentials">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Credentials configured</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm" data-testid="status-no-credentials">
                <XCircle className="h-4 w-4 text-destructive" />
                <span>No credentials configured</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="button-save-aws-config"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Saving..." : "Save Configuration"}
        </Button>
        <Button
          variant="outline"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || !config?.hasCredentials}
          data-testid="button-test-connection"
        >
          <TestTube className="h-4 w-4 mr-2" />
          {testMutation.isPending ? "Testing..." : "Test Connection"}
        </Button>
      </div>
    </div>
  );
}
