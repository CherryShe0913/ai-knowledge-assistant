import { useEffect, useState, useRef, FormEvent, useCallback } from 'react';
import { Plus, Trash2, Send, Bot, User as UserIcon, MessageSquare, Search, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sessionsApi, searchApi } from '../lib/api';
import { useChatStore } from '../store/chatStore';
import { ChatMessage, ChatSession } from '../types';
import SearchPanel from '../components/SearchPanel';

export default function ChatPage() {
  const {
    sessions, setSessions, addSession, removeSession, updateSession,
    activeSessionId, setActiveSession,
    messages, setMessages, addMessage,
    isStreaming, setIsStreaming,
    streamingText, setStreamingText, appendStreamingText,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('token');

  // Cmd+K / Ctrl+K to open search
  const handleKeyboardShortcut = useCallback((e: globalThis.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setShowSearch((v) => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [handleKeyboardShortcut]);

  const handleExport = () => {
    if (!activeSessionId || !token) return;
    const url = searchApi.exportSession(activeSessionId);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('Authorization', `Bearer ${token}`);
    // Use fetch to get the file with auth header, then trigger download
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.download = `chat-export.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      });
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) loadMessages(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const loadSessions = async () => {
    try {
      const res = await sessionsApi.list();
      setSessions(res.data.data.sessions);
    } catch { /* handled globally */ }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const res = await sessionsApi.get(sessionId);
      setMessages(res.data.data.session.messages);
    } catch { /* handled globally */ }
  };

  const createSession = async () => {
    try {
      const res = await sessionsApi.create();
      const session: ChatSession = res.data.data.session;
      addSession(session);
      setActiveSession(session.id);
    } catch { /* handled globally */ }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await sessionsApi.delete(id);
      removeSession(id);
    } catch { /* handled globally */ }
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const res = await sessionsApi.create();
      const session: ChatSession = res.data.data.session;
      addSession(session);
      setActiveSession(session.id);
      sessionId = session.id;
    }

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sessionId,
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };
    addMessage(userMsg);
    const sentInput = input.trim();
    setInput('');
    setIsStreaming(true);
    setStreamingText('');

    try {
      const response = await fetch(`/api/chat/${sessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: sentInput }),
      });

      if (!response.ok) throw new Error('Request failed');
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));
          if (data.type === 'delta') {
            appendStreamingText(data.text);
          } else if (data.type === 'done') {
            const finalText = useChatStore.getState().streamingText;
            const assistantMsg: ChatMessage = {
              id: data.messageId,
              sessionId,
              role: 'assistant',
              content: finalText,
              createdAt: new Date().toISOString(),
            };
            addMessage(assistantMsg);
            setStreamingText('');
            // Refresh session title
            const updatedSession = await sessionsApi.get(sessionId);
            updateSession(sessionId, { title: updatedSession.data.data.session.title });
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsStreaming(false);
    }
  };

  const allMessages = isStreaming
    ? [...messages]
    : messages;

  return (
    <div className="flex h-full">
      {/* Sessions sidebar */}
      <div className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-100 space-y-2">
          <button
            onClick={createSession}
            className="w-full flex items-center gap-2 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建对话
          </button>
          <button
            onClick={() => setShowSearch((v) => !v)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              showSearch
                ? 'bg-primary-50 text-primary-600'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Search className="w-4 h-4" />
            搜索对话
            <span className="ml-auto text-xs text-gray-400">⌘K</span>
          </button>
        </div>

        {/* Search panel or session list */}
        {showSearch ? (
          <div className="flex-1 overflow-hidden">
            <SearchPanel
              onClose={() => setShowSearch(false)}
              onSelectSession={(id) => { setActiveSession(id); }}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
            {sessions.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">暂无对话</p>
            )}
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setActiveSession(session.id)}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                  activeSessionId === session.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                <span className="flex-1 truncate">{session.title}</span>
                <button
                  onClick={(e) => deleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Chat header with export button */}
        {activeSessionId && (
          <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 truncate">
              {sessions.find((s) => s.id === activeSessionId)?.title || '对话'}
            </p>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="导出为 Markdown"
            >
              <Download className="w-4 h-4" />
              导出
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
          {!activeSessionId && allMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mb-4">
                <Bot className="w-9 h-9 text-primary-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">AI 知识助手</h2>
              <p className="text-gray-500 text-sm max-w-xs">
                你好！我可以回答问题、解释概念、提供分析建议。输入内容开始对话吧。
              </p>
            </div>
          )}

          {allMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {isStreaming && streamingText && (
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="max-w-3xl bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <MarkdownContent content={streamingText} />
                <span className="inline-block w-1.5 h-4 bg-primary-500 animate-pulse ml-0.5 align-text-bottom" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white p-4">
          <form onSubmit={sendMessage} className="flex gap-3 max-w-4xl mx-auto">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入你的问题..."
              disabled={isStreaming}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-gray-300' : 'bg-primary-500'
        }`}
      >
        {isUser ? (
          <UserIcon className="w-4 h-4 text-gray-600" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>
      <div
        className={`max-w-3xl rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? 'bg-primary-500 text-white rounded-tr-sm'
            : 'bg-white border border-gray-200 rounded-tl-sm'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownContent content={message.content} />
        )}
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="prose prose-sm max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-code:text-primary-600 prose-code:bg-primary-50 prose-code:px-1 prose-code:rounded"
    >
      {content}
    </ReactMarkdown>
  );
}
