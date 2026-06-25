import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Search, X, MessageSquare, FileSearch } from 'lucide-react';
import { searchApi } from '../lib/api';
import { SearchResult } from '../types';
import { useChatStore } from '../store/chatStore';

interface SearchPanelProps {
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
      : part
  );
}

export default function SearchPanel({ onClose, onSelectSession }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    inputRef.current?.focus();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const doSearch = async (q: string) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    setError('');
    try {
      const res = await searchApi.search(q.trim());
      setResults(res.data.data);
    } catch {
      setError('搜索失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(value), 300);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter') {
      if (timerRef.current) clearTimeout(timerRef.current);
      doSearch(query);
    }
  };

  const total = results ? results.totalSessions + results.totalMessages : 0;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search input */}
      <div className="p-3 border-b border-gray-100">
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索对话和消息..."
            className="flex-1 text-sm outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults(null); }} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Empty state */}
        {!query && !results && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
            <FileSearch className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">输入关键词搜索对话标题或消息内容</p>
            <p className="text-xs text-gray-300 mt-1">按 ESC 关闭</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
            搜索中...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-3 mt-3 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* No results */}
        {results && !loading && total === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <p className="text-sm text-gray-500">没有找到 "{query}" 相关内容</p>
          </div>
        )}

        {/* Results list */}
        {results && !loading && total > 0 && (
          <div className="py-2">
            <p className="px-4 py-1 text-xs text-gray-400">
              找到 {total} 条结果
            </p>

            {/* Session title matches */}
            {results.sessions.length > 0 && (
              <div>
                <p className="px-4 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  对话标题
                </p>
                {results.sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { onSelectSession(s.id); onClose(); }}
                    className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    <MessageSquare className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">
                        {highlightMatch(s.title, query)}
                      </p>
                      <p className="text-xs text-gray-400">{s._count.messages} 条消息</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Message content matches */}
            {results.messages.length > 0 && (
              <div>
                <p className="px-4 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">
                  消息内容
                </p>
                {results.messages.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { onSelectSession(m.sessionId); onClose(); }}
                    className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    <Search className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-600 truncate mb-0.5">
                        {m.sessionTitle}
                      </p>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {highlightMatch(m.snippet, query)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
