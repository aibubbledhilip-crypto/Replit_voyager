import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Play, Trash2, Database, Table, Columns, Save, FolderOpen, X, Loader2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SavedQuery {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}

interface Suggestion {
  label: string;
  type: 'table' | 'column';
  table?: string;
}

interface QueryBuilderProps {
  onExecute?: (query: string) => void;
  onClear?: () => void;
  connectionStatus?: 'connected' | 'disconnected';
  suggestions?: Suggestion[];
  onTableUsed?: (tableName: string) => void;
}

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS', 'ORDER', 'BY',
  'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'COUNT', 'SUM', 'AVG',
  'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NULL', 'IS',
  'CREATE', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TABLE',
  'UNION', 'ALL', 'EXISTS', 'TRUE', 'FALSE', 'ASC', 'DESC', 'WITH'
];

export default function QueryBuilder({ 
  onExecute, 
  onClear,
  connectionStatus = 'connected',
  suggestions = [],
  onTableUsed
}: QueryBuilderProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<(Suggestion | { label: string; type: 'keyword' })[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: savedQueries = [], isLoading: isLoadingSaved } = useQuery<SavedQuery[]>({
    queryKey: ['/api/saved-queries'],
  });

  const saveQueryMutation = useMutation({
    mutationFn: async (data: { name: string; query: string }) => {
      return apiRequest('/api/saved-queries', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-queries'] });
      setSaveDialogOpen(false);
      setSaveName("");
      toast({ title: "Query saved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to save query", description: error.message, variant: "destructive" });
    },
  });

  const deleteQueryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/saved-queries/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-queries'] });
      toast({ title: "Query deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete query", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveQuery = () => {
    if (saveName.trim() && query.trim()) {
      saveQueryMutation.mutate({ name: saveName.trim(), query: query.trim() });
    }
  };

  const handleLoadQuery = (savedQuery: SavedQuery) => {
    setQuery(savedQuery.query);
  };

  const getCurrentWord = useCallback((text: string, position: number): { word: string; start: number; end: number } => {
    const beforeCursor = text.slice(0, position);
    const afterCursor = text.slice(position);
    
    const wordStartMatch = beforeCursor.match(/[\w.]*$/);
    const wordEndMatch = afterCursor.match(/^[\w.]*/);
    
    const start = position - (wordStartMatch?.[0]?.length || 0);
    const end = position + (wordEndMatch?.[0]?.length || 0);
    const word = text.slice(start, end);
    
    return { word, start, end };
  }, []);

  const updateSuggestions = useCallback((text: string, position: number) => {
    const { word } = getCurrentWord(text, position);
    
    if (word.length < 1) {
      setShowSuggestions(false);
      return;
    }

    const searchTerm = word.toLowerCase();
    
    const keywordMatches = SQL_KEYWORDS
      .filter(kw => kw.toLowerCase().startsWith(searchTerm))
      .slice(0, 5)
      .map(kw => ({ label: kw, type: 'keyword' as const }));
    
    const tableMatches = suggestions
      .filter(s => s.type === 'table' && s.label.toLowerCase().includes(searchTerm))
      .slice(0, 10);
    
    const columnMatches = suggestions
      .filter(s => s.type === 'column' && s.label.toLowerCase().includes(searchTerm))
      .slice(0, 10);

    const allMatches = [...keywordMatches, ...tableMatches, ...columnMatches];
    
    setFilteredSuggestions(allMatches);
    setSelectedIndex(0);
    setShowSuggestions(allMatches.length > 0);
  }, [suggestions, getCurrentWord]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleExecute();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
      case 'Tab':
      case 'Enter':
        if (filteredSuggestions.length > 0) {
          e.preventDefault();
          insertSuggestion(filteredSuggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const insertSuggestion = (suggestion: Suggestion | { label: string; type: 'keyword' }) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { start, end } = getCurrentWord(query, cursorPosition);
    
    let insertText = suggestion.label;
    if (suggestion.type === 'table') {
      insertText = `"dvsum-s3-glue-prod".${suggestion.label}`;
      // Trigger column loading for this table
      onTableUsed?.(suggestion.label);
    }
    
    const newQuery = query.slice(0, start) + insertText + query.slice(end);
    setQuery(newQuery);
    
    const newPosition = start + insertText.length;
    setCursorPosition(newPosition);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
    
    setShowSuggestions(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newPosition = e.target.selectionStart || 0;
    
    setQuery(newValue);
    setCursorPosition(newPosition);
    updateSuggestions(newValue, newPosition);
  };

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const position = (e.target as HTMLTextAreaElement).selectionStart || 0;
    setCursorPosition(position);
  };

  const handleExecute = () => {
    if (query.trim()) {
      console.log('Executing query:', query);
      onExecute?.(query);
    }
  };

  const handleClear = () => {
    setQuery("");
    console.log('Query cleared');
    onClear?.();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <Card data-testid="card-query-builder">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-medium">SQL Query Editor</CardTitle>
          <CardDescription className="text-sm mt-1">
            Write and execute SQL queries against AWS Athena
          </CardDescription>
        </div>
        <Badge 
          variant={connectionStatus === 'connected' ? 'default' : 'destructive'}
          className="h-6"
          data-testid="badge-connection-status"
        >
          {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="mb-2 h-8" data-testid="button-toggle-connection">
              <Database className="h-3.5 w-3.5 mr-2" />
              {isOpen ? 'Hide' : 'Show'} Connection Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pb-4">
            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-md">
              <div>
                <span className="text-muted-foreground">Region:</span>
                <span className="ml-2 font-mono" data-testid="text-region">us-east-1</span>
              </div>
              <div>
                <span className="text-muted-foreground">S3 Location:</span>
                <span className="ml-2 font-mono truncate block" data-testid="text-s3-location">s3://dvsum-staging-prod</span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="SELECT * FROM your_table LIMIT 100; (Ctrl+Enter to execute)"
            className="min-h-64 font-mono text-sm resize-none"
            value={query}
            onChange={handleChange}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            data-testid="input-sql-query"
          />
          
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div 
              ref={suggestionsRef}
              className="absolute z-50 mt-1 w-72 bg-popover border rounded-md shadow-lg overflow-hidden"
              data-testid="suggestions-dropdown"
            >
              <div className="max-h-64 overflow-y-auto">
                {filteredSuggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.type}-${suggestion.label}`}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                      index === selectedIndex 
                        ? 'bg-accent text-accent-foreground' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => insertSuggestion(suggestion)}
                    data-testid={`suggestion-${suggestion.label}`}
                  >
                    {suggestion.type === 'keyword' ? (
                      <span className="text-purple-500 font-mono text-xs w-4">SQL</span>
                    ) : suggestion.type === 'table' ? (
                      <Table className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    ) : (
                      <Columns className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    )}
                    <span className="truncate font-mono">{suggestion.label}</span>
                    {suggestion.type === 'column' && 'table' in suggestion && suggestion.table && (
                      <span className="ml-auto text-xs text-muted-foreground truncate">
                        {suggestion.table}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="px-3 py-1.5 text-xs text-muted-foreground border-t bg-muted/30">
                ↑↓ navigate • Tab/Enter select • Esc close
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-load-query">
                <FolderOpen className="h-4 w-4 mr-2" />
                Load
                {savedQueries.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 text-xs">
                    {savedQueries.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {isLoadingSaved ? (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </div>
              ) : savedQueries.length === 0 ? (
                <div className="py-4 text-sm text-muted-foreground text-center">
                  No saved queries
                </div>
              ) : (
                savedQueries.map((sq) => (
                  <DropdownMenuItem
                    key={sq.id}
                    className="flex items-center justify-between gap-2"
                    onSelect={() => handleLoadQuery(sq)}
                    data-testid={`menu-item-saved-query-${sq.id}`}
                  >
                    <span className="truncate">{sq.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteQueryMutation.mutate(sq.id);
                      }}
                      data-testid={`button-delete-query-${sq.id}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                disabled={!query.trim()}
                data-testid="button-save-query"
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Query</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Query name"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  data-testid="input-query-name"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveQuery}
                    disabled={!saveName.trim() || saveQueryMutation.isPending}
                    data-testid="button-confirm-save"
                  >
                    {saveQueryMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button 
            variant="outline" 
            onClick={handleClear}
            disabled={!query.trim()}
            data-testid="button-clear-query"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
          <Button 
            onClick={handleExecute}
            disabled={!query.trim()}
            data-testid="button-execute-query"
          >
            <Play className="h-4 w-4 mr-2" />
            Execute Query
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
