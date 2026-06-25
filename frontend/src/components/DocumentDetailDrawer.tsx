import { useState, FormEvent, useRef } from 'react';
import {
  X, Sparkles, Tag, Clock, FileText, ChevronRight,
  Send, Bot, Loader2, AlertCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { analyzeApi } from '../lib/api';
import { Document, DocumentAnalysis } from '../types';

interface DocumentDetailDrawerProps {
  document: Document & { content: string };
  onClose: () => void;
}

type DrawerTab = 'content' | 'ai';

export default function DocumentDetailDrawer({ document, onClose }: DocumentDetailDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('content');
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  const [question, setQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState<Array<{ q: string; a: string }>>([]);
  const [asking, setAsking] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const token = localStorage.getItem('token');
  const qaEndRef = useRef<HTMLDivElement>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const res = await analyzeApi.summarize(document.id);
      setAnalysis(res.data.data.analysis);
    } catch (err: unknown) {
      setAnalyzeError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'AI 分析失败，请重试'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAsk = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim() || asking) return;

    const q = question.trim();
    setQuestion('');
    setAsking(true);
    setStreamingAnswer('');

    try {
      const response = await fetch(analyzeApi.askUrl(document.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: q }),
      });

      if (!response.ok || !response.body) throw new Error('Request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));
          if (data.type === 'delta') {
            full += data.text;
            setStreamingAnswer(full);
            qaEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          } else if (data.type === 'done') {
            setQaHistory((prev) => [...prev, { q, a: full }]);
            setStreamingAnswer('');
          }
        }
      }
    } catch {
      setQaHistory((prev) => [...prev, { q, a: '❌ 提问失败，请重试' }]);
      setStreamingAnswer('');
    } finally {
      setAsking(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full animate-slide-in">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <h2 className="font-semibold text-gray-900 truncate">{document.title}</h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="uppercase">{document.fileType}</span>
              <span>{formatBytes(document.fileSize)}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(document.createdAt).toLocaleDateString('zh-CN')}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {([['content', '文档内容'], ['ai', 'AI 分析']] as [DrawerTab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                tab === t
                  ? 'text-primary-600 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'ai' && <Sparkles className="w-4 h-4" />}
              {label}
            </button>
          ))}
        </div>

        {/* Content Tab */}
        {tab === 'content' && (
          <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
              {document.content}
            </div>
          </div>
        )}

        {/* AI Analysis Tab */}
        {tab === 'ai' && (
          <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col">
            {/* Summary section */}
            <div className="p-5 border-b border-gray-100">
              {!analysis && !analyzing && (
                <div className="text-center py-4">
                  <Sparkles className="w-10 h-10 text-primary-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-4">让 AI 帮你快速理解这篇文档</p>
                  <button
                    onClick={handleAnalyze}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    一键 AI 摘要
                  </button>
                </div>
              )}

              {analyzing && (
                <div className="flex items-center gap-3 py-4 text-sm text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                  AI 正在分析文档...
                </div>
              )}

              {analyzeError && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {analyzeError}
                  <button onClick={handleAnalyze} className="ml-auto text-red-500 hover:underline text-xs">
                    重试
                  </button>
                </div>
              )}

              {analysis && (
                <div className="space-y-4">
                  {/* Meta */}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>约 {analysis.wordCount.toLocaleString()} 字</span>
                    <span>预计阅读 {analysis.readingMinutes} 分钟</span>
                    <button
                      onClick={handleAnalyze}
                      className="ml-auto text-primary-500 hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />重新分析
                    </button>
                  </div>

                  {/* Summary */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">摘要</h3>
                    <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg px-4 py-3">
                      {analysis.summary}
                    </p>
                  </div>

                  {/* Key points */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">核心要点</h3>
                    <ul className="space-y-1.5">
                      {analysis.keyPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <ChevronRight className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Tags */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      <Tag className="w-3 h-3 inline mr-1" />标签
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {analysis.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-primary-50 text-primary-600 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Q&A section */}
            <div className="flex flex-col flex-1">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary-500" />
                  基于文档提问
                </h3>
              </div>

              {/* QA history */}
              <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
                {qaHistory.length === 0 && !asking && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    对文档内容有疑问？直接提问，AI 会基于文档内容回答。
                  </p>
                )}
                {qaHistory.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-end">
                      <span className="bg-primary-500 text-white text-sm px-3 py-2 rounded-2xl rounded-tr-sm max-w-xs">
                        {item.q}
                      </span>
                    </div>
                    <div className="bg-gray-50 text-sm text-gray-700 px-4 py-3 rounded-2xl rounded-tl-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none">
                        {item.a}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
                {asking && streamingAnswer && (
                  <div className="bg-gray-50 text-sm text-gray-700 px-4 py-3 rounded-2xl rounded-tl-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none">
                      {streamingAnswer}
                    </ReactMarkdown>
                    <span className="inline-block w-1.5 h-4 bg-primary-500 animate-pulse ml-0.5 align-text-bottom" />
                  </div>
                )}
                <div ref={qaEndRef} />
              </div>

              {/* Q&A input */}
              <div className="px-4 py-3 border-t border-gray-100">
                <form onSubmit={handleAsk} className="flex gap-2">
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="针对文档提问..."
                    disabled={asking}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                  />
                  <button
                    type="submit"
                    disabled={!question.trim() || asking}
                    className="p-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
