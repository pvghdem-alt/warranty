import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface ApiKeyModalProps {
  onClose: () => void;
}

export default function ApiKeyModal({ onClose }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_API_KEY') || '';
    setApiKey(savedKey);
  }, []);

  const handleSave = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1500);
  };

  const handleClear = () => {
    localStorage.removeItem('GEMINI_API_KEY');
    setApiKey('');
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-lg shadow-slate-500/20">
              <Key className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">設定 API 金鑰</h2>
              <p className="text-xs text-slate-500 font-medium">用於支援 AI 智慧掃描功能</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3 text-amber-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold">隱私提醒</p>
              <p>金鑰將僅儲存在您的瀏覽器 (Local Storage) 中，不會上傳至我們的伺服器。</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600">Gemini API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="輸入您的 AIZA... 金鑰"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-red-500 transition-colors"
            >
              清除紀錄
            </button>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
          <button
            onClick={handleSave}
            disabled={isSaved}
            className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-500/20"
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                儲存成功
              </>
            ) : (
              '儲存設定'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
