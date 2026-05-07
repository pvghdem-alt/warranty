import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, Info, Settings, Save, Smartphone, Copy } from 'lucide-react';
import { motion } from 'motion/react';

interface VendorData {
  companyName: string;
  lineUserId: string;
}

export default function VendorManagement() {
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Real-time fetching tools similar to LineNotifyModal
  const [recentUsers, setRecentUsers] = useState<{userId: string; timestamp: number; message: string; displayName?: string}[]>([]);
  const [showRecent, setShowRecent] = useState<string | null>(null); // current editing vendor company
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        // Find all unique vendors from warranties
        const wSnap = await getDocs(collection(db, 'warranties'));
        const uniqueVendors = new Set<string>();
        wSnap.forEach(d => {
          const v = d.data().vendor;
          if (v) uniqueVendors.add(v);
        });

        // Also fetch from vendorSettings in case there are vendors with settings but no active warranty
        const sSnap = await getDocs(collection(db, 'vendorSettings'));
        const vendorMap: Record<string, string> = {};
        sSnap.forEach(d => {
          vendorMap[d.id] = d.data().lineUserId || '';
          uniqueVendors.add(d.id);
        });

        const vList: VendorData[] = Array.from(uniqueVendors).map(name => ({
          companyName: name,
          lineUserId: vendorMap[name] || ''
        }));
        
        vList.sort((a, b) => a.companyName.localeCompare(b.companyName));
        setVendors(vList);
        
      } catch (e) {
        console.error("Error fetching vendors", e);
      } finally {
        setLoading(false);
      }
    };

    fetchVendors();
  }, []);

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

  const handleSaveLineId = async (companyName: string) => {
    try {
      if (!editValue) {
        // Prevent clearing maybe, or allow clear?
      }
      await setDoc(doc(db, 'vendorSettings', companyName), { lineUserId: editValue }, { merge: true });
      setVendors(prev => prev.map(v => v.companyName === companyName ? { ...v, lineUserId: editValue } : v));
      setEditingId(null);
      setShowRecent(null);
      
      // Sync local storage as well to keep consistent with LineNotifyModal fallback
      const map = JSON.parse(localStorage.getItem('vendor_line_ids') || '{}');
      map[companyName] = editValue;
      localStorage.setItem('vendor_line_ids', JSON.stringify(map));
      
    } catch(e) {
      console.error(e);
      alert('儲存失敗');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-3 text-indigo-800">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold mb-1">廠商 LINE ID 管理</p>
          <p>您可以在這裡統一管理所有廠商的 LINE User ID。設定好之後，發送維修工單通知時系統就會自動帶入，不需要每次都重新取得。</p>
          <p className="mt-2 text-xs opacity-80">小技巧：點擊「設定」展開後，您可以直接透過偵測最新對話紀錄來快速綁定廠商的 LINE 帳號。</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
              <tr>
                <th className="px-6 py-4">廠商名稱</th>
                <th className="px-6 py-4">LINE User ID</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-400">尚無廠商資料</td>
                </tr>
              ) : (
                vendors.map((vendor, idx) => {
                  const isEditing = editingId === vendor.companyName;
                  
                  return (
                    <React.Fragment key={idx}>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">
                          {vendor.companyName}
                        </td>
                        <td className="px-6 py-4">
                          {vendor.lineUserId ? (
                            <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                              {vendor.lineUserId}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-xs">尚未設定</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              if (isEditing) {
                                setEditingId(null);
                                setShowRecent(null);
                              } else {
                                setEditingId(vendor.companyName);
                                setEditValue(vendor.lineUserId);
                                setShowRecent(null);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600  text-slate-600 rounded-lg font-bold transition-all text-xs"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            {isEditing ? '取消設定' : '設定 LINE ID'}
                          </button>
                        </td>
                      </tr>
                      
                      {/* Editing Panel */}
                      {isEditing && (
                        <tr>
                          <td colSpan={3} className="px-0 py-0 border-b-2 border-blue-500">
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="bg-blue-50/30 p-6 shadow-inner"
                            >
                              <div className="max-w-2xl mx-auto space-y-4">
                                
                                <div className="flex justify-between items-end">
                                  <label className="text-sm font-bold text-slate-700 block mb-1">
                                    【{vendor.companyName}】 的 LINE User ID
                                  </label>
                                  <button 
                                    onClick={() => setShowRecent(showRecent === vendor.companyName ? null : vendor.companyName)}
                                    className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1"
                                  >
                                    <Smartphone className="w-3 h-3" />
                                    {showRecent === vendor.companyName ? '隱藏捕捉畫面' : '偵測最新對話紀錄'}
                                  </button>
                                </div>
                                
                                {showRecent === vendor.companyName && (
                                  <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm max-h-[200px] overflow-y-auto">
                                    <p className="text-xs text-slate-500 mb-3 border-b border-slate-100 pb-2">
                                      請廠商在您的官方帳號隨便輸入一句話，這裡就會自動浮現他的 ID：
                                    </p>
                                    {recentUsers.length === 0 ? (
                                      <div className="text-center py-4 text-sm font-bold text-slate-400">
                                        <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mr-2 align-middle"></span>
                                        等待廠商傳送訊息中...
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {recentUsers.map((u, i) => (
                                          <div 
                                            key={i} 
                                            onClick={() => { setEditValue(u.userId); setShowRecent(null); }}
                                            className="bg-slate-50 p-3 rounded-lg border border-slate-200 cursor-pointer hover:border-green-500 hover:bg-green-50 hover:shadow-sm transition-all flex justify-between items-center group"
                                          >
                                            <div className="overflow-hidden pr-4">
                                              <p className="text-sm font-bold text-slate-800 truncate mb-0.5">訊息: {u.message}</p>
                                              <p className="text-[10px] text-slate-400 font-mono truncate">{u.userId}</p>
                                            </div>
                                            <div className="whitespace-nowrap px-3 py-1 bg-green-600 text-white text-xs font-bold rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                              套用此 ID
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    placeholder="以 U 開頭的 33 碼字串 (如 U123...)"
                                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                                  />
                                  <button
                                    onClick={() => handleSaveLineId(vendor.companyName)}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
                                  >
                                    <Save className="w-4 h-4" /> 儲存 ID
                                  </button>
                                </div>
                                <p className="text-[10px] text-slate-400">注意：請確定填寫正確的 User ID 格式，否則可能會無法成功傳送通知。</p>
                                
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
