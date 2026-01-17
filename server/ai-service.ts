import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model: string;
  ollamaUrl?: string;
}

export interface AnalysisRequest {
  data: any[];
  sourceName: string;
  systemPrompt: string;
  config: AIConfig;
}

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

export function getModelsForProvider(provider: AIProvider): { value: string; label: string }[] {
  return PROVIDER_MODELS[provider] || [];
}

export function getDefaultModelForProvider(provider: AIProvider): string {
  const models = PROVIDER_MODELS[provider];
  return models?.[0]?.value || '';
}

async function analyzeWithOpenAI(request: AnalysisRequest): Promise<string> {
  const { config, systemPrompt, data, sourceName } = request;
  
  if (!config.apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const openai = new OpenAI({ apiKey: config.apiKey });
  const dataContext = formatDataContext(data, sourceName);

  const completion = await openai.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Please analyze the following data:\n\n${dataContext}` },
    ],
    max_tokens: 2000,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content || "Unable to generate analysis.";
}

async function analyzeWithAnthropic(request: AnalysisRequest): Promise<string> {
  const { config, systemPrompt, data, sourceName } = request;
  
  if (!config.apiKey) {
    throw new Error("Anthropic API key not configured");
  }

  const anthropic = new Anthropic({ apiKey: config.apiKey });
  const dataContext = formatDataContext(data, sourceName);

  const message = await anthropic.messages.create({
    model: config.model,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      { role: "user", content: `Please analyze the following data:\n\n${dataContext}` },
    ],
  });

  const textBlock = message.content.find(block => block.type === 'text');
  return textBlock && 'text' in textBlock ? textBlock.text : "Unable to generate analysis.";
}

async function analyzeWithGemini(request: AnalysisRequest): Promise<string> {
  const { config, systemPrompt, data, sourceName } = request;
  
  if (!config.apiKey) {
    throw new Error("Google API key not configured");
  }

  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({ model: config.model });
  const dataContext = formatDataContext(data, sourceName);

  const prompt = `${systemPrompt}\n\nPlease analyze the following data:\n\n${dataContext}`;
  const result = await model.generateContent(prompt);
  const response = await result.response;

  return response.text() || "Unable to generate analysis.";
}

async function analyzeWithOllama(request: AnalysisRequest): Promise<string> {
  const { config, systemPrompt, data, sourceName } = request;
  
  const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
  const dataContext = formatDataContext(data, sourceName);

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Please analyze the following data:\n\n${dataContext}` },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.statusText}`);
  }

  const result = await response.json() as { message?: { content?: string } };
  return result.message?.content || "Unable to generate analysis.";
}

function formatDataContext(data: any[], sourceName: string): string {
  const maxRows = 100;
  const sampleData = data.slice(0, maxRows);
  return `Source: ${sourceName || 'Unknown'}
Total Rows: ${data.length}
Sample Data (first ${Math.min(data.length, maxRows)} rows):
${JSON.stringify(sampleData, null, 2)}`;
}

export async function analyzeData(request: AnalysisRequest): Promise<string> {
  const { config } = request;

  switch (config.provider) {
    case 'openai':
      return analyzeWithOpenAI(request);
    case 'anthropic':
      return analyzeWithAnthropic(request);
    case 'gemini':
      return analyzeWithGemini(request);
    case 'ollama':
      return analyzeWithOllama(request);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

export const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', keyName: 'OpenAI API Key' },
  { value: 'anthropic', label: 'Anthropic Claude', keyName: 'Anthropic API Key' },
  { value: 'gemini', label: 'Google Gemini', keyName: 'Google API Key' },
  { value: 'ollama', label: 'Ollama (Local)', keyName: 'Ollama URL' },
] as const;
