import { useState, FormEvent } from 'react';
import { X, User, Lock, Camera, CheckCircle } from 'lucide-react';
import { profileApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { User as UserType } from '../types';

interface ProfileModalProps {
  onClose: () => void;
}

type Tab = 'profile' | 'password';

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, setAuth } = useAuthStore();
  const token = localStorage.getItem('token') || '';

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!name.trim()) { setError('名字不能为空'); return; }
    setLoading(true);
    try {
      const res = await profileApi.update(name.trim(), avatar.trim() || undefined);
      const updatedUser: UserType = res.data.data.user;
      setAuth(token, updatedUser);
      setSuccess('个人资料已更新');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!currentPassword || !newPassword) { setError('请填写所有字段'); return; }
    if (newPassword.length < 6) { setError('新密码至少 6 位'); return; }
    if (newPassword !== confirmPassword) { setError('两次输入的密码不一致'); return; }
    setLoading(true);
    try {
      await profileApi.changePassword(currentPassword, newPassword);
      setSuccess('密码已修改，请重新登录时使用新密码');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || '修改失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">账户设置</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['profile', 'password'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-primary-600 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'profile' ? <User className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {tab === 'profile' ? '个人资料' : '修改密码'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Feedback */}
          {error && (
            <div className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {success}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSave} className="space-y-4">
              {/* Avatar Preview */}
              <div className="flex justify-center">
                <div className="relative">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt="avatar"
                      className="w-20 h-20 rounded-full object-cover border-2 border-primary-200"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="w-9 h-9 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                    <Camera className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">头像 URL（选填）</label>
                <input
                  type="url"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-400 cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {loading ? '保存中...' : '保存资料'}
              </button>
            </form>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSave} className="space-y-4">
              {[
                { label: '当前密码', value: currentPassword, onChange: setCurrentPassword, placeholder: '输入当前密码' },
                { label: '新密码', value: newPassword, onChange: setNewPassword, placeholder: '至少 6 位字符' },
                { label: '确认新密码', value: confirmPassword, onChange: setConfirmPassword, placeholder: '再次输入新密码' },
              ].map(({ label, value, onChange, placeholder }) => (
                <div key={label}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="password"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {loading ? '修改中...' : '修改密码'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
