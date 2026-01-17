import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Brain, Key } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const availableModels = [
  { value: "gpt-4o", label: "GPT-4o (Recommended)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Faster)" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Cheapest)" },
];

const defaultPrompt = `You are a data analyst assistant. Analyze the following data and provide insights:

1. Summarize the key findings from the data
2. Identify any patterns or anomalies
3. Provide actionable recommendations based on the data
4. Highlight any data quality issues if present

Be concise and focus on the most important insights.`;

export default function AIConfigPage() {
  const { toast } = useToast();

  const { data: apiKeySetting } = useQuery({
    queryKey: ['/api/settings', 'openai_api_key'],
    queryFn: () => apiRequest('/api/settings/openai_api_key'),
  });

  const { data: modelSetting } = useQuery({
    queryKey: ['/api/settings', 'ai_model'],
    queryFn: () => apiRequest('/api/settings/ai_model'),
  });

  const { data: promptSetting } = useQuery({
    queryKey: ['/api/settings', 'ai_analysis_prompt'],
    queryFn: () => apiRequest('/api/settings/ai_analysis_prompt'),
  });

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (apiKeySetting?.value) {
      setApiKey(apiKeySetting.value);
    }
  }, [apiKeySetting]);

  useEffect(() => {
    if (modelSetting?.value) {
      setModel(modelSetting.value);
    }
  }, [modelSetting]);

  useEffect(() => {
    if (promptSetting?.value) {
      setPrompt(promptSetting.value);
    }
  }, [promptSetting]);

  const saveSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ key, value }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save setting",
        variant: "destructive",
      });
    },
  });

  const handleSaveApiKey = () => {
    saveSettingMutation.mutate(
      { key: 'openai_api_key', value: apiKey },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: "API key saved successfully",
          });
        },
      }
    );
  };

  const handleSaveModel = () => {
    saveSettingMutation.mutate(
      { key: 'ai_model', value: model },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: "Model preference saved successfully",
          });
        },
      }
    );
  };

  const handleSavePrompt = () => {
    saveSettingMutation.mutate(
      { key: 'ai_analysis_prompt', value: prompt },
      {
        onSuccess: () => {
          toast({
            title: "Success",
            description: "Analysis prompt saved successfully",
          });
        },
      }
    );
  };

  const handleResetPrompt = () => {
    setPrompt(defaultPrompt);
    toast({
      title: "Prompt Reset",
      description: "Click Save to apply the default prompt",
    });
  };

  const maskedApiKey = apiKey ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">AI Configuration</h1>
        <p className="text-muted-foreground">Configure AI settings for data analysis in Explorer</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>OpenAI API Key</CardTitle>
              <CardDescription>
                Your OpenAI API key for AI-powered data analysis
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  data-testid="input-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowApiKey(!showApiKey)}
                  data-testid="button-toggle-api-key"
                >
                  {showApiKey ? "Hide" : "Show"}
                </Button>
              </div>
              {apiKeySetting?.value && !showApiKey && (
                <p className="text-sm text-muted-foreground">Current key: {maskedApiKey}</p>
              )}
            </div>
            <Button
              onClick={handleSaveApiKey}
              disabled={saveSettingMutation.isPending}
              data-testid="button-save-api-key"
            >
              <Save className="h-4 w-4 mr-2" />
              Save API Key
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Model Selection</CardTitle>
              <CardDescription>
                Choose the OpenAI model for analysis
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger data-testid="select-model">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSaveModel}
              disabled={saveSettingMutation.isPending}
              data-testid="button-save-model"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Model
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Analysis Prompt</CardTitle>
              <CardDescription>
                Customize the prompt used for AI data analysis
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">System Prompt</Label>
              <Textarea
                id="prompt"
                data-testid="textarea-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter the analysis prompt..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSavePrompt}
                disabled={saveSettingMutation.isPending}
                data-testid="button-save-prompt"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Prompt
              </Button>
              <Button
                variant="outline"
                onClick={handleResetPrompt}
                data-testid="button-reset-prompt"
              >
                Reset to Default
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
