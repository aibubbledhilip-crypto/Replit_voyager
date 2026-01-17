import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Brain, Key, Server, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama';

const AI_PROVIDERS = [
  { value: 'openai' as const, label: 'OpenAI', keyName: 'OpenAI API Key', keyPrefix: 'sk-' },
  { value: 'anthropic' as const, label: 'Anthropic Claude', keyName: 'Anthropic API Key', keyPrefix: 'sk-ant-' },
  { value: 'gemini' as const, label: 'Google Gemini', keyName: 'Google API Key', keyPrefix: 'AI' },
  { value: 'ollama' as const, label: 'Ollama (Local)', keyName: 'Ollama URL', keyPrefix: 'http' },
];

const PROVIDER_MODELS: Record<AIProvider, { value: string; label: string }[]> = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o (Recommended)" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini (Faster)" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Cheapest)" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (Recommended)" },
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Faster)" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
  ],
  gemini: [
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Recommended)" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Faster)" },
    { value: "gemini-pro", label: "Gemini Pro" },
  ],
  ollama: [
    { value: "llama3.2", label: "Llama 3.2" },
    { value: "llama3.1", label: "Llama 3.1" },
    { value: "mistral", label: "Mistral" },
    { value: "codellama", label: "Code Llama" },
    { value: "mixtral", label: "Mixtral" },
  ],
};

const defaultPrompt = `You are a data analyst assistant. Analyze the following data and provide insights:

1. Summarize the key findings from the data
2. Identify any patterns or anomalies
3. Provide actionable recommendations based on the data
4. Highlight any data quality issues if present

Be concise and focus on the most important insights.`;

export default function AIConfigPage() {
  const { toast } = useToast();

  const { data: providerSetting } = useQuery({
    queryKey: ['/api/settings', 'ai_provider'],
    queryFn: () => apiRequest('/api/settings/ai_provider'),
  });

  const { data: modelSetting } = useQuery({
    queryKey: ['/api/settings', 'ai_model'],
    queryFn: () => apiRequest('/api/settings/ai_model'),
  });

  const { data: promptSetting } = useQuery({
    queryKey: ['/api/settings', 'ai_analysis_prompt'],
    queryFn: () => apiRequest('/api/settings/ai_analysis_prompt'),
  });

  const { data: openaiKeySetting } = useQuery({
    queryKey: ['/api/settings', 'openai_api_key'],
    queryFn: () => apiRequest('/api/settings/openai_api_key'),
  });

  const { data: anthropicKeySetting } = useQuery({
    queryKey: ['/api/settings', 'anthropic_api_key'],
    queryFn: () => apiRequest('/api/settings/anthropic_api_key'),
  });

  const { data: geminiKeySetting } = useQuery({
    queryKey: ['/api/settings', 'gemini_api_key'],
    queryFn: () => apiRequest('/api/settings/gemini_api_key'),
  });

  const { data: ollamaUrlSetting } = useQuery({
    queryKey: ['/api/settings', 'ollama_url'],
    queryFn: () => apiRequest('/api/settings/ollama_url'),
  });

  const [provider, setProvider] = useState<AIProvider>('openai');
  const [model, setModel] = useState("gpt-4o");
  const [prompt, setPrompt] = useState(defaultPrompt);
  
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");

  const [configuredKeys, setConfiguredKeys] = useState<Record<string, { configured: boolean; masked: string }>>({});
  const [isChangingProvider, setIsChangingProvider] = useState(false);

  useEffect(() => {
    if (providerSetting?.value) {
      setProvider(providerSetting.value as AIProvider);
    }
  }, [providerSetting]);

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

  useEffect(() => {
    if (openaiKeySetting) {
      setConfiguredKeys(prev => ({
        ...prev,
        openai: { configured: openaiKeySetting.configured || false, masked: openaiKeySetting.value || '' }
      }));
    }
  }, [openaiKeySetting]);

  useEffect(() => {
    if (anthropicKeySetting) {
      setConfiguredKeys(prev => ({
        ...prev,
        anthropic: { configured: anthropicKeySetting.configured || false, masked: anthropicKeySetting.value || '' }
      }));
    }
  }, [anthropicKeySetting]);

  useEffect(() => {
    if (geminiKeySetting) {
      setConfiguredKeys(prev => ({
        ...prev,
        gemini: { configured: geminiKeySetting.configured || false, masked: geminiKeySetting.value || '' }
      }));
    }
  }, [geminiKeySetting]);

  useEffect(() => {
    if (ollamaUrlSetting?.value) {
      setOllamaUrl(ollamaUrlSetting.value);
    }
  }, [ollamaUrlSetting]);

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

  const handleProviderChange = async (newProvider: AIProvider) => {
    if (isChangingProvider) return;
    
    const defaultModel = PROVIDER_MODELS[newProvider]?.[0]?.value || '';
    setIsChangingProvider(true);
    
    try {
      await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: 'ai_provider', value: newProvider }),
      });
      
      await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: 'ai_model', value: defaultModel }),
      });
      
      setProvider(newProvider);
      setModel(defaultModel);
      
      await queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      
      toast({
        title: "Provider Changed",
        description: `Switched to ${AI_PROVIDERS.find(p => p.value === newProvider)?.label}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change provider",
        variant: "destructive",
      });
    } finally {
      setIsChangingProvider(false);
    }
  };

  const handleSaveApiKey = (providerKey: AIProvider) => {
    const keyMap: Record<AIProvider, { settingKey: string; value: string; setter: (v: string) => void }> = {
      openai: { settingKey: 'openai_api_key', value: openaiKey, setter: setOpenaiKey },
      anthropic: { settingKey: 'anthropic_api_key', value: anthropicKey, setter: setAnthropicKey },
      gemini: { settingKey: 'gemini_api_key', value: geminiKey, setter: setGeminiKey },
      ollama: { settingKey: 'ollama_url', value: ollamaUrl, setter: setOllamaUrl },
    };

    const config = keyMap[providerKey];
    if (!config.value) return;

    saveSettingMutation.mutate(
      { key: config.settingKey, value: config.value },
      {
        onSuccess: () => {
          if (providerKey !== 'ollama') {
            config.setter("");
            setConfiguredKeys(prev => ({
              ...prev,
              [providerKey]: { configured: true, masked: `${config.value.slice(0, 7)}...${config.value.slice(-4)}` }
            }));
          }
          toast({
            title: "Success",
            description: `${AI_PROVIDERS.find(p => p.value === providerKey)?.keyName} saved successfully`,
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

  const currentProviderInfo = AI_PROVIDERS.find(p => p.value === provider);
  const availableModels = PROVIDER_MODELS[provider] || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">AI Configuration</h1>
        <p className="text-muted-foreground">Configure AI providers and settings for data analysis in Explorer</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>AI Provider</CardTitle>
              <CardDescription>
                Select your preferred AI provider for data analysis
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {AI_PROVIDERS.map((p) => {
                const isConfigured = p.value === 'ollama' || configuredKeys[p.value]?.configured;
                return (
                  <Button
                    key={p.value}
                    variant={provider === p.value ? "default" : "outline"}
                    className="h-auto py-4 flex flex-col gap-1 relative"
                    onClick={() => handleProviderChange(p.value)}
                    disabled={isChangingProvider}
                    data-testid={`button-provider-${p.value}`}
                  >
                    <span className="font-medium">{p.label}</span>
                    {isConfigured && (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Ready
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>{currentProviderInfo?.keyName || 'API Key'}</CardTitle>
              <CardDescription>
                {provider === 'ollama' 
                  ? 'Configure the URL for your local Ollama instance'
                  : `Configure your ${currentProviderInfo?.label} API credentials`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {provider === 'openai' && (
              <div className="space-y-4">
                {configuredKeys.openai?.configured && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Current key: <span className="font-mono">{configuredKeys.openai.masked}</span>
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>OpenAI API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder={configuredKeys.openai?.configured ? "Enter new key to update..." : "sk-..."}
                      data-testid="input-openai-key"
                    />
                    <Button
                      onClick={() => handleSaveApiKey('openai')}
                      disabled={saveSettingMutation.isPending || !openaiKey}
                      data-testid="button-save-openai-key"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {provider === 'anthropic' && (
              <div className="space-y-4">
                {configuredKeys.anthropic?.configured && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Current key: <span className="font-mono">{configuredKeys.anthropic.masked}</span>
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Anthropic API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      placeholder={configuredKeys.anthropic?.configured ? "Enter new key to update..." : "sk-ant-..."}
                      data-testid="input-anthropic-key"
                    />
                    <Button
                      onClick={() => handleSaveApiKey('anthropic')}
                      disabled={saveSettingMutation.isPending || !anthropicKey}
                      data-testid="button-save-anthropic-key"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {provider === 'gemini' && (
              <div className="space-y-4">
                {configuredKeys.gemini?.configured && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Current key: <span className="font-mono">{configuredKeys.gemini.masked}</span>
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Google API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder={configuredKeys.gemini?.configured ? "Enter new key to update..." : "AI..."}
                      data-testid="input-gemini-key"
                    />
                    <Button
                      onClick={() => handleSaveApiKey('gemini')}
                      disabled={saveSettingMutation.isPending || !geminiKey}
                      data-testid="button-save-gemini-key"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {provider === 'ollama' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Ollama Server URL</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      placeholder="http://localhost:11434"
                      data-testid="input-ollama-url"
                    />
                    <Button
                      onClick={() => handleSaveApiKey('ollama')}
                      disabled={saveSettingMutation.isPending || !ollamaUrl}
                      data-testid="button-save-ollama-url"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Make sure Ollama is running locally with the desired model pulled
                  </p>
                </div>
              </div>
            )}
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
                Choose the model for {currentProviderInfo?.label}
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
