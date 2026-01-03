import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui';
import { apiClient } from '@/shared/api/client';
import type { Message } from '@/shared/types';
import { format } from 'date-fns';

interface MessageSearchProps {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMessage?: (messageId: string) => void;
}

interface SearchResult {
  messages: Message[];
  totalCount: number;
}

export function MessageSearch({ chatId, isOpen, onClose, onNavigateToMessage }: MessageSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setTotalCount(0);
      setCurrentIndex(0);
      setHasSearched(false);
    }
  }, [isOpen]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setTotalCount(0);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const response = await apiClient.get<SearchResult>(
        `/messages/chat/${chatId}/search`,
        { query: searchQuery.trim(), limit: 50 }
      );
      setResults(response.data.messages);
      setTotalCount(response.data.totalCount);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  // Handle query change with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults([]);
      setTotalCount(0);
      setHasSearched(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    if (results.length === 0) return;

    let newIndex: number;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : results.length - 1;
    } else {
      newIndex = currentIndex < results.length - 1 ? currentIndex + 1 : 0;
    }

    setCurrentIndex(newIndex);
    if (onNavigateToMessage && results[newIndex]) {
      onNavigateToMessage(results[newIndex].id);
    }
  }, [results, currentIndex, onNavigateToMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        handleNavigate('prev');
      } else {
        handleNavigate('next');
      }
    }
  };

  const handleResultClick = (message: Message, index: number) => {
    setCurrentIndex(index);
    if (onNavigateToMessage) {
      onNavigateToMessage(message.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-x-0 top-0 z-50 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-lg">
      {/* Search input bar */}
      <div className="flex items-center gap-2 p-3">
        <Search className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search messages..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
        />

        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />}

        {/* Result count and navigation */}
        {results.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              {currentIndex + 1} / {results.length}
              {totalCount > results.length && ` (${totalCount} total)`}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleNavigate('prev')}
              className="h-7 w-7"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleNavigate('next')}
              className="h-7 w-7"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Results dropdown */}
      {hasSearched && (
        <div className="max-h-[300px] overflow-y-auto border-t border-[hsl(var(--border))]">
          {results.length === 0 && !isLoading ? (
            <div className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No messages found
            </div>
          ) : (
            results.map((message, index) => (
              <button
                key={message.id}
                onClick={() => handleResultClick(message, index)}
                className={`w-full p-3 text-left transition-colors hover:bg-[hsl(var(--muted))] ${
                  index === currentIndex ? 'bg-[hsl(var(--muted))]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{message.senderDisplayName}</p>
                    <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">
                      {highlightMatch(message.content || '', query)}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                    {format(new Date(message.createdAt), 'MMM d, yyyy')}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to highlight matching text
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
