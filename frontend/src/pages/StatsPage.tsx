import { useEffect, useState } from 'react';
import { MessageSquare, FileText, BarChart2, TrendingUp, Clock } from 'lucide-react';
import { statsApi } from '../lib/api';
import { UserStats } from '../types';

export default function StatsPage() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await statsApi.summary();
      setStats(res.data.data);
    } catch { /* handled globally */ }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        加载中...
      </div>
    );
  }

  if (!stats) return null;

  const { summary, recentSessions, messageTrend } = stats;
  const maxTrend = Math.max(...messageTrend.map((d) => d.count), 1);

  const statCards = [
    {
      label: '对话总数',
      value: summary.sessionCount,
      icon: MessageSquare,
      color: 'bg-blue-50 text-blue-500',
    },
    {
      label: '消息总数',
      value: summary.messageCount,
      icon: TrendingUp,
      color: 'bg-green-50 text-green-500',
    },
    {
      label: '知识库文档',
      value: summary.documentCount,
      icon: FileText,
      color: 'bg-purple-50 text-purple-500',
    },
    {
      label: '近 7 天活跃',
      value: messageTrend.filter((d) => d.count > 0).length + ' 天',
      icon: BarChart2,
      color: 'bg-orange-50 text-orange-500',
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">使用统计</h1>
        <p className="text-sm text-gray-500">你的 AI 助手使用概览</p>
      </div>

      <div className="p-6 space-y-6 max-w-4xl">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Message Trend Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-medium text-gray-800 mb-4">近 7 天消息趋势</h2>
          <div className="flex items-end gap-2 h-32">
            {messageTrend.map(({ date, count }) => {
              const height = count === 0 ? 4 : Math.max(8, (count / maxTrend) * 112);
              const label = new Date(date).toLocaleDateString('zh-CN', {
                month: 'numeric',
                day: 'numeric',
              });
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">{count > 0 ? count : ''}</span>
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      count > 0 ? 'bg-primary-500' : 'bg-gray-100'
                    }`}
                    style={{ height }}
                    title={`${date}: ${count} 条消息`}
                  />
                  <span className="text-xs text-gray-400 whitespace-nowrap">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-medium text-gray-800 mb-4">最近对话</h2>
          {recentSessions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">暂无对话记录</p>
          ) : (
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-primary-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{session.title}</p>
                      <p className="text-xs text-gray-400">
                        {session._count.messages} 条消息
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0 ml-3">
                    <Clock className="w-3 h-3" />
                    {new Date(session.updatedAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
