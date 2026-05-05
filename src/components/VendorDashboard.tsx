import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ShieldCheck, CheckCircle2, AlertCircle, Clock, Construction } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Issue {
  id: string;
  issueName: string;
  vendorCompany: string;
  status: '未處理' | '維修中' | '待料中' | '已完成';
  vendorReply: string;
  estRepairTime: string;
  createdAt?: any;
  updatedAt?: any;
  warrantyId: string;
}

const statusColors = {
  '未處理': 'bg-red-100 text-red-700 border-red-200',
  '維修中': 'bg-amber-100 text-amber-700 border-amber-200',
  '待料中': 'bg-purple-100 text-purple-700 border-purple-200',
  '已完成': 'bg-green-100 text-green-700 border-green-200',
};

interface VendorDashboardProps {
  vendorName: string;
}

export default function VendorDashboard({ vendorName }: VendorDashboardProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Edit form state
  const [status, setStatus] = useState<Issue['status']>('未處理');
  const [vendorReply, setVendorReply] = useState('');
  const [estRepairTime, setEstRepairTime] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Fetch warranties to map IDs to project names
    getDocs(collection(db, 'warranties')).then(snap => {
      const pMap: Record<string, string> = {};
      snap.forEach(d => {
        pMap[d.id] = d.data().projectName;
      });
      setProjectsMap(pMap);
    }).catch(e => {
      console.error(e);
    });

    const q = query(collection(db, 'issues'), where('vendorCompany', '==', vendorName));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Issue[];
      
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
  }, [vendorName]);

  const handleEdit = (issue: Issue) => {
    if (editingId === issue.id) {
      setEditingId(null);
    } else {
      setEditingId(issue.id);
      setStatus(issue.status);
      setVendorReply(issue.vendorReply || '');
      setEstRepairTime(issue.estRepairTime || '');
    }
  };

  const handleUpdate = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'issues', id), {
        status,
        vendorReply,
        estRepairTime,
        hasUnreadReply: true,
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues`);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none mb-1">廠商維修管理</h1>
            <p className="text-sm font-bold text-slate-500">{vendorName}</p>
          </div>
        </div>

        {issues.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-200 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">目前無待處理的工單</h2>
            <p className="text-slate-500 text-sm">所有工程的維修單皆已處理完畢或尚未產生。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {issues.map(issue => {
              const isEditing = editingId === issue.id;
              const projName = projectsMap[issue.warrantyId] || '讀取中...';
              
              return (
                <div key={issue.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded border", statusColors[issue.status])}>
                          {issue.status}
                        </span>
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono font-bold">
                          {projName}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg text-slate-800 mb-2">{issue.issueName}</h3>
                      
                      {!isEditing && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-slate-50 p-4 rounded-xl">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 mb-1 tracking-wide">預計維修時間</p>
                            <p className="text-slate-700 font-medium">{issue.estRepairTime || <span className="text-slate-400 italic">未填寫</span>}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 mb-1 tracking-wide">詳細回覆說明</p>
                            <p className="text-slate-700 font-medium break-words whitespace-pre-wrap">{issue.vendorReply || <span className="text-slate-400 italic">尚未回覆</span>}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {!isEditing && issue.status !== '已完成' && (
                      <button
                        onClick={() => handleEdit(issue)}
                        className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all shadow-md mt-2 sm:mt-0"
                      >
                        更新進度
                      </button>
                    )}
                  </div>

                  {isEditing && (
                    <motion.form 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-6 pt-6 border-t border-slate-100"
                      onSubmit={(e) => handleUpdate(issue.id, e)}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">處理狀態</label>
                          <select
                            value={status}
                            onChange={e => setStatus(e.target.value as any)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800 shadow-sm"
                          >
                            <option value="未處理">未處理</option>
                            <option value="維修中">維修中</option>
                            <option value="待料中">待料中</option>
                            <option value="已完成">已完成</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">預計維修日期</label>
                          <input
                            type="date"
                            value={estRepairTime}
                            onChange={e => setEstRepairTime(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800 shadow-sm"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-bold text-slate-700">詳細回覆說明</label>
                          <textarea
                            value={vendorReply}
                            onChange={e => setVendorReply(e.target.value)}
                            placeholder="請描述預計處理方式、原因或進度..."
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[100px] resize-y font-medium text-slate-800 shadow-sm"
                            required
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 justify-end bg-slate-50 -mx-5 -mb-5 p-4 mt-6 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-xl transition-all"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          disabled={updating}
                          className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                        >
                          {updating ? '儲存中...' : '送出回覆'}
                        </button>
                      </div>
                    </motion.form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
