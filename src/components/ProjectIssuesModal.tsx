import React, { useState, useEffect } from 'react';
import { X, Plus, Edit3, Trash2, MessageCircle, AlertCircle, CheckCircle, Clock, Construction, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp, where, getDocs, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import LineNotifyModal from './LineNotifyModal';
import ConfirmModal from './ConfirmModal';

interface Issue {
  id?: string;
  issueName: string;
  vendorCompany: string;
  status: '未處理' | '維修中' | '待料中' | '已完成';
  vendorReply: string;
  estRepairTime: string;
  createdAt?: any;
  updatedAt?: any;
  warrantyId: string;
  hasUnreadReply?: boolean;
}

interface ProjectIssuesModalProps {
  warrantyId: string;
  projectName: string;
  vendorName: string;
  onClose: () => void;
}

const statusColors = {
  '未處理': 'bg-red-100 text-red-700 border-red-200',
  '維修中': 'bg-amber-100 text-amber-700 border-amber-200',
  '待料中': 'bg-purple-100 text-purple-700 border-purple-200',
  '已完成': 'bg-green-100 text-green-700 border-green-200',
};

export default function ProjectIssuesModal({ warrantyId, projectName, vendorName, onClose }: ProjectIssuesModalProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  
  const vendorsList = vendorName ? vendorName.split(/[,、;]+/).map(v => v.trim()).filter(Boolean) : [];
  
  // Add/Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [issueName, setIssueName] = useState('');
  const [vendorCompany, setVendorCompany] = useState(vendorsList.length === 1 ? vendorsList[0] : (vendorsList[0] || ''));
  const [status, setStatus] = useState<Issue['status']>('未處理');
  const [vendorReply, setVendorReply] = useState('');
  const [estRepairTime, setEstRepairTime] = useState('');
  
  // Line Notify state
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'issues'), 
      where('warrantyId', '==', warrantyId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Issue[];
      
      // Sort by creation time manually since we require index if we compound query
      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      
      setIssues(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'issues');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [warrantyId]);

  const resetForm = () => {
    setIssueName('');
    setVendorCompany(vendorsList.length === 1 ? vendorsList[0] : (vendorsList[0] || ''));
    setStatus('未處理');
    setVendorReply('');
    setEstRepairTime('');
    setEditingId(null);
    setShowAddForm(false);
  };

  const checkAndNotifyVendor = async (vendor: string, newIssueName: string) => {
    try {
      const docRef = doc(db, 'vendorSettings', vendor);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;
      
      const lineUserId = docSnap.data().lineUserId;
      if (!lineUserId) return;

      const q = query(collection(db, 'issues'), where('vendorCompany', '==', vendor));
      const issueSnaps = await getDocs(q);
      
      let unfinishedIssues: Issue[] = [];
      issueSnaps.forEach(d => {
        const data = d.data() as Issue;
        if (data.status !== '已完成') {
          unfinishedIssues.push({...data, id: d.id, createdAt: data.createdAt?.toDate?.() || new Date()});
        }
      });

      const today = new Date();
      const listStr = unfinishedIssues.map((issue, idx) => {
         const d = issue.createdAt ? new Date(issue.createdAt) : today;
         const days = Math.floor((today.getTime() - d.getTime()) / (1000 * 3600 * 24));
         return `${idx+1}. 【${issue.issueName}】 - 狀態: ${issue.status} (已等待 ${days} 天)`;
      }).join('\n');

      const baseUrl = window.location.origin + window.location.pathname;
      const vendorDashboardLink = `${baseUrl}?vendor=${encodeURIComponent(vendor)}`;

      const messageText = `✨ 【新增維修工單】\n專案：${projectName}\n項目：${newIssueName}\n\n⚠️ 目前您共有 ${unfinishedIssues.length} 張工單尚未處理：\n${listStr}\n\n廠商您好，這是您的專屬維修管理列表頁面，請點擊連結查看並更新所有工單狀態：\n${vendorDashboardLink}`;

      fetch('/api/line/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: lineUserId,
          messages: [{ type: 'text', text: messageText }]
        })
      });
    } catch (err) {
      console.error("Auto notify error", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueName) return;

    try {
      const issueData = {
        issueName,
        vendorCompany,
        status,
        vendorReply,
        estRepairTime,
        warrantyId,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'issues', editingId), issueData);
      } else {
        await addDoc(collection(db, 'issues'), {
          ...issueData,
          createdAt: serverTimestamp()
        });
        
        if (vendorCompany) {
          setTimeout(() => checkAndNotifyVendor(vendorCompany, issueName), 1000);
        }
      }
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'issues');
    }
  };

  const handleEdit = (issue: Issue) => {
    setEditingId(issue.id || null);
    setIssueName(issue.issueName);
    setVendorCompany(issue.vendorCompany || '');
    setStatus(issue.status);
    setVendorReply(issue.vendorReply || '');
    setEstRepairTime(issue.estRepairTime || '');
    setShowAddForm(true);
    
    if (issue.hasUnreadReply && issue.id) {
      markAsRead(issue.id);
    }
  };

  const handleDelete = async (id: string | undefined) => {
    try {
      if (id) {
        await deleteDoc(doc(db, 'issues', id));
      }
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `issues/${id}`);
    }
  };

  const notifyLine = (issue: Issue) => {
    setSelectedIssue(issue);
  };

  const markAsRead = async (id: string | undefined) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'issues', id), { 
        hasUnreadReply: false,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
                專案維修管理
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-800">{projectName}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Construction className="w-5 h-5 text-slate-400" /> 維修紀錄清單
            </h3>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" /> 新增維修項目
              </button>
            )}
          </div>

          <AnimatePresence>
            {showAddForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleSubmit}
                className="mb-8 bg-white p-5 rounded-2xl border border-blue-100 shadow-sm"
              >
                <h4 className="font-bold text-slate-800 mb-4">{editingId ? '編輯維修項目' : '新增維修項目'}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-500">損壞項目名稱 *</label>
                    <input
                      required
                      type="text"
                      value={issueName}
                      onChange={e => setIssueName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="請輸入損壞項目"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500">負責廠商</label>
                    {vendorsList.length > 1 ? (
                      <select
                        value={vendorCompany}
                        onChange={e => setVendorCompany(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                      >
                        {!vendorCompany && <option value="">無 / 請選擇</option>}
                        {vendorsList.map((v, i) => (
                          <option key={i} value={v}>{v}</option>
                        ))}
                        {vendorCompany && !vendorsList.includes(vendorCompany) && (
                          <option value={vendorCompany}>{vendorCompany} (自訂/前次紀錄)</option>
                        )}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={vendorCompany}
                        onChange={e => setVendorCompany(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        placeholder="公司名稱"
                      />
                    )}
                  </div>
                  
                  {(!editingId) && (
                    <div className="space-y-1 hidden md:block">
                      {/* Empty spacer for alignment when creating new */}
                    </div>
                  )}

                  {editingId && (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">處理狀態</label>
                        <select
                          value={status}
                          onChange={e => setStatus(e.target.value as any)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                        >
                          <option value="未處理">未處理</option>
                          <option value="維修中">維修中</option>
                          <option value="待料中">待料中</option>
                          <option value="已完成">已完成</option>
                        </select>
                      </div>

                      <div className="col-span-1 md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-500">預計維修時間</label>
                        <input
                          type="date"
                          value={estRepairTime}
                          onChange={e => setEstRepairTime(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        />
                      </div>

                      <div className="col-span-1 md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-500">廠商回覆</label>
                        <textarea
                          value={vendorReply}
                          onChange={e => setVendorReply(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[80px]"
                          placeholder="廠商的回覆內容..."
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-2 mt-6 justify-end">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-500/20"
                  >
                    {editingId ? '儲存變更' : '新增項目'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="py-12 text-center text-slate-400">載入中...</div>
          ) : issues.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
              目前沒有任何維修紀錄
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map(issue => (
                <div key={issue.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${statusColors[issue.status]}`}>
                          {issue.status}
                        </span>
                        {issue.hasUnreadReply && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded border bg-red-100 text-red-700 border-red-200 animate-pulse">
                            新回覆
                          </span>
                        )}
                        {issue.createdAt && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            {issue.createdAt.toDate?.().toLocaleDateString('zh-TW')}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-800 text-lg">{issue.issueName}</h4>
                      {(issue.involvedVendors && issue.involvedVendors.length > 1) ? (
                        <p className="text-[10px] sm:text-xs text-slate-500 mt-1 sm:mt-1.5 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> 會同廠商：{issue.involvedVendors.join('、')}</p>
                      ) : issue.vendorCompany ? (
                        <p className="text-[10px] sm:text-xs text-slate-500 mt-1 sm:mt-1.5 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> 負責廠商：{issue.vendorCompany}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => notifyLine(issue)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="透過 LINE 傳送通知"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(issue)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => issue.id && setDeleteConfirm({ isOpen: true, id: issue.id })}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-sm bg-slate-50 p-3 rounded-xl">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 mb-1">廠商回覆</p>
                      <p className="text-slate-700 min-h-[20px]">{issue.vendorReply || <span className="text-slate-400 italic">無</span>}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 mb-1">預計維修時間</p>
                      <p className="text-slate-700 min-h-[20px]">{issue.estRepairTime || <span className="text-slate-400 italic">未訂</span>}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {selectedIssue && (
        <LineNotifyModal
          isOpen={!!selectedIssue}
          onClose={() => setSelectedIssue(null)}
          vendorCompany={selectedIssue.vendorCompany}
          projectName={projectName}
          issueName={selectedIssue.issueName}
          status={selectedIssue.status}
        />
      )}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="刪除維修紀錄"
        message="確定要刪除這筆維修紀錄嗎？此動作無法復原。"
        onConfirm={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />
    </div>
  );
}
