import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface LineNotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorCompany: string;
  projectName: string;
  issueName: string;
  status: string;
}

export default function LineNotifyModal({ 
  isOpen, 
  onClose, 
  vendorCompany, 
  projectName, 
  issueName, 
  status 
}: LineNotifyModalProps) {
  const [vendorLineId, setVendorLineId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [recentUsers, setRecentUsers] = useState<{userId: string; timestamp: number; message: string; displayName?: string}[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    const loadVendorData = async () => {
      try {
        if (!vendorCompany) return;
        
        // Load LINE ID
        const docRef = doc(db, 'vendorSettings', vendorCompany);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().lineUserId) {
          setVendorLineId(docSnap.data().lineUserId);
        } else {
          // Fallback to local storage if not in firebase
          const map = JSON.parse(localStorage.getItem('vendor_line_ids') || '{}');
          if (map[vendorCompany]) {
            setVendorLineId(map[vendorCompany]);
          }
        }
        
        // Load unfinished issues to compute message
        const q = query(collection(db, 'issues'), where('vendorCompany', '==', vendorCompany));
        const issueSnaps = await getDocs(q);
        let unfinishedIssues: any[] = [];
        issueSnaps.forEach(d => {
          const data = d.data();
          if (data.status !== '已完成') {
            unfinishedIssues.push({ ...data, id: d.id, createdAt: data.createdAt?.toDate?.() || new Date() });
          }
        });
        
        const today = new Date();
        const listStr = unfinishedIssues.map((issue, idx) => {
           const d = issue.createdAt ? new Date(issue.createdAt) : today;
           const days = Math.floor((today.getTime() - d.getTime()) / (1000 * 3600 * 24));
           return `${idx+1}. 【${issue.issueName}】 - 狀態: ${issue.status} (已等待 ${days} 天)`;
        }).join('\n');

        let currentOrigin = window.location.origin;
        if (currentOrigin.includes('-dev-')) {
          currentOrigin = currentOrigin.replace('-dev-', '-pre-');
        }
        const baseUrl = currentOrigin + window.location.pathname;
        const vendorDashboardLink = `${baseUrl}?vendor=${encodeURIComponent(vendorCompany)}`;
        
        let msg = `🚧 【維修通知】\n工程：${projectName}\n項目：${issueName}\n狀態：${status}\n廠商：${vendorCompany || '未指定'}\n\n`;
        if (unfinishedIssues.length > 0) {
          msg += `⚠️ 目前您共有 ${unfinishedIssues.length} 張工單尚未處理：\n${listStr}\n\n`;
        }
        msg += `廠商您好，這是您的專屬維修管理列表頁面，請點擊連結查看並更新所有工單狀態：\n${vendorDashboardLink}`;
        
        setMessageText(msg);

      } catch (e) {
        console.error("Failed to load vendor data", e);
      }
    };
    
    if (isOpen) {
      loadVendorData();
      setError('');
      setSuccess(false);
    }
  }, [vendorCompany, isOpen, projectName, issueName, status]);

  const fetchRecentUsers = async () => {
    try {
      const res = await fetch('/api/line/users');
      if (res.ok) {
        const data = await res.json();
        setRecentUsers(data);
      }
    } catch (e) {
      console.error('Failed to fetch recent LINE users', e);
    }
  };

  useEffect(() => {
    if (showRecent) {
      fetchRecentUsers();
      const interval = setInterval(fetchRecentUsers, 3000);
      return () => clearInterval(interval);
    }
  }, [showRecent]);

  const handleSend = async () => {
    if (!vendorLineId) {
      setError('請填寫廠商 LINE ID');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Save mapping to Firebase and localStorage
      if (vendorCompany) {
        await setDoc(doc(db, 'vendorSettings', vendorCompany), { lineUserId: vendorLineId }, { merge: true });
        const map = JSON.parse(localStorage.getItem('vendor_line_ids') || '{}');
        map[vendorCompany] = vendorLineId;
        localStorage.setItem('vendor_line_ids', JSON.stringify(map));
      }

      const response = await fetch('/api/line/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: vendorLineId,
          messages: [{ type: 'text', text: messageText }]
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || '傳送失敗');
      }
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      let errorMsg = err.message;
      if (errorMsg.includes("The property, 'to', in the request body is invalid")) {
        errorMsg = "錯誤：廠商的 LINE User ID 格式無效。請確保它是以「U」開頭的 33 碼字串 (不能只輸入帳號)。";
      } else if (errorMsg.includes("Invalid channel access token")) {
        errorMsg = "錯誤：LINE 頻道權杖 (Channel Access Token) 無效，系統設定可能有誤。";
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-green-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-black text-slate-800">傳送 LINE 通知</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-green-100 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {success ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">傳送成功！</h3>
              <p className="text-slate-500">訊息已發送至指定廠商 LINE ID</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl font-medium">
                  {error}
                </div>
              )}
              
              <div className="space-y-1">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-bold text-slate-500">廠商 LINE User ID ({vendorCompany})</label>
                  <button 
                    onClick={() => setShowRecent(!showRecent)}
                    className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                  >
                    {showRecent ? '隱藏紀錄' : '抓取最新對話紀錄'}
                  </button>
                </div>
                
                {showRecent && (
                  <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 mt-2 mb-3 max-h-[150px] overflow-y-auto">
                    <p className="text-[10px] text-slate-500 mb-2">請廠商在此官方帳號隨便輸入一句話，這裡就會自動浮現他的 ID：</p>
                    {recentUsers.length === 0 ? (
                      <div className="text-center py-2 text-xs font-bold text-slate-400">目前沒有收到任何訊息，請廠商傳送訊息後稍等...</div>
                    ) : (
                      <div className="space-y-2">
                        {recentUsers.map((u, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => { setVendorLineId(u.userId); setShowRecent(false); }}
                            className="bg-white p-2 rounded-lg border border-slate-200 cursor-pointer hover:border-green-500 hover:shadow-sm transition-all flex justify-between items-center group"
                          >
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold text-slate-700 truncate">訊息: {u.message}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{u.userId}</p>
                            </div>
                            <div className="text-[10px] text-green-600 font-bold opacity-0 group-hover:opacity-100">使用此ID</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                <input
                  type="text"
                  value={vendorLineId}
                  onChange={e => setVendorLineId(e.target.value)}
                  placeholder="請輸入以 U 開頭的 User ID (如 U123...)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm"
                />
                <p className="text-[10px] text-slate-400">
                  注意：您必須填寫長度為 33 字元且以「U」開頭的 LINE User ID。
                  您可以點擊上方「抓取最新對話紀錄」，請廠商在 LINE 加入您的官方帳號並傳送任意訊息，即可直接點擊套用。<br/><br/>
                  * 啟用自動抓取設定教學：前往 LINE Developers 後台「Messaging API」頁籤，將 Webhook URL 設定為：<br/>
                  <code className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded select-all">{window.location.origin}/api/line/webhook</code>
                </p>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-xs font-bold text-slate-500">訊息預覽</label>
                <div className="p-3 bg-slate-100 rounded-xl text-sm text-slate-700 whitespace-pre-wrap font-medium">
                  {messageText}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold rounded-xl shadow-lg shadow-green-500/20 flex justify-center items-center gap-2 transition-all"
                >
                  {loading ? '傳送中...' : '使用自動 API 傳送 (將扣除額度)'}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(messageText);
                      alert('訊息已複製！請在官方帳號後台貼上傳送。');
                      if (vendorLineId) {
                        try {
                          const parts = window.location.host.split('-');
                          // Assume they use generic line biz or we just open straight to line biz
                          window.open(`https://chat.line.biz/`, '_blank');
                        } catch(e) {}
                      } else {
                        window.open(`https://chat.line.biz/`, '_blank');
                      }
                    }}
                    className="flex-1 py-3 bg-white border-2 border-green-600 text-green-700 hover:bg-green-50 font-bold rounded-xl flex justify-center items-center gap-2 transition-all"
                  >
                    複製訊息並手動傳送 (免扣額度)
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
