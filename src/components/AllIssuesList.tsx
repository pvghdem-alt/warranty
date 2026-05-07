import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Edit3, Trash2, Search, MessageCircle, AlertCircle, Clock, Construction, Wrench } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ProjectIssuesModal from './ProjectIssuesModal'; // We can reuse the edit form logic, or just make an inline edit here.
import LineNotifyModal from './LineNotifyModal';
import ConfirmModal from './ConfirmModal';

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
  hasUnreadReply?: boolean;
}

const statusColors = {
  '未處理': 'bg-red-100 text-red-700 border-red-200',
  '維修中': 'bg-amber-100 text-amber-700 border-amber-200',
  '待料中': 'bg-purple-100 text-purple-700 border-purple-200',
  '已完成': 'bg-green-100 text-green-700 border-green-200',
};

export default function AllIssuesList() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all'|'未處理'|'維修中'|'待料中'|'已完成'>('未處理');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  // Warranty projects map
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });


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

    const q = query(collection(db, 'issues'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Issue[];
      
      data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        // 拖越久越前面 (oldest first)
        return timeA - timeB;
      });
      
      setIssues(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'issues');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      if (id) {
        await deleteDoc(doc(db, 'issues', id));
      }
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `issues/${id}`);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'issues', id), { 
        hasUnreadReply: false,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleEdit = (issue: Issue) => {
    if (editingId === issue.id) {
      setEditingId(null);
    } else {
      setEditingId(issue.id);
      setEditFormData({
        status: issue.status,
        vendorReply: issue.vendorReply || '',
        estRepairTime: issue.estRepairTime || '',
        vendorCompany: issue.vendorCompany || ''
      });
      if (issue.hasUnreadReply) {
        markAsRead(issue.id);
      }
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateDoc(doc(db, 'issues', id), {
        ...editFormData,
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues`);
    }
  };

  const notifyLine = (issue: Issue) => {
    setSelectedIssue(issue);
  };

  const filteredIssues = issues.filter(i => {
    if (activeTab !== 'all' && i.status !== activeTab) return false;
    if (selectedProjectId !== 'all' && i.warrantyId !== selectedProjectId) return false;
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      const projName = projectsMap[i.warrantyId] || '';
      return (
        i.issueName.toLowerCase().includes(lower) ||
        (i.vendorCompany || '').toLowerCase().includes(lower) ||
        projName.toLowerCase().includes(lower) ||
        (i.vendorReply || '').toLowerCase().includes(lower)
      );
    }
    return true;
  });

  const getWaitingDays = (date: any) => {
    if (!date) return 0;
    const ms = date.toMillis?.() || 0;
    if (!ms) return 0;
    return Math.ceil((Date.now() - ms) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-12 h-12 border-4 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium animate-pulse">讀取維修清單中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl overflow-x-auto">
        {(['all', '未處理', '維修中', '待料中', '已完成'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex-1 text-center",
              activeTab === tab 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            {tab === 'all' ? '所有工單' : tab}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative group flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-slate-500 transition-colors" />
          <input
            type="text"
            placeholder="搜尋項目名稱、工程、廠商或回覆..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-slate-500/5 focus:border-slate-500 transition-all shadow-sm"
          />
        </div>
        <div className="w-full sm:w-64 relative">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full h-full px-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-slate-500/5 focus:border-slate-500 transition-all shadow-sm appearance-none text-slate-700 font-bold"
          >
            <option value="all">所有工程案</option>
            {Object.entries(projectsMap).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredIssues.map(issue => {
          const isEditing = editingId === issue.id;
          const projName = projectsMap[issue.warrantyId] || '未知專案';
          const waitDays = getWaitingDays(issue.createdAt);
          
          return (
            <div key={issue.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded border", statusColors[issue.status])}>
                      {issue.status}
                    </span>
                    {issue.hasUnreadReply && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded border bg-red-100 text-red-700 border-red-200 animate-pulse">
                        新回覆
                      </span>
                    )}
                    <span className="text-sm font-bold text-blue-800 bg-blue-100 px-3 py-1 rounded shadow-sm">
                      {projName}
                    </span>
                    {issue.status !== '已完成' && waitDays > 0 && (
                      <span className="text-[10px] font-bold text-red-500">
                        待機 {waitDays} 天
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-lg text-slate-800">{issue.issueName}</h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> 登載日期：{issue.createdAt?.toDate?.().toLocaleDateString('zh-TW')}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => notifyLine(issue)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-100"
                    title="LINE 通知"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(issue)}
                    className={cn(
                      "p-2 rounded-lg transition-colors border",
                      isEditing 
                        ? "bg-blue-50 text-blue-600 border-blue-200" 
                        : "text-slate-400 hover:text-blue-600 hover:bg-blue-50 border-transparent hover:border-blue-100"
                    )}
                    title="編輯回覆"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ isOpen: true, id: issue.id })}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    title="刪除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="bg-slate-50 p-4 rounded-xl space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">處理狀態</label>
                      <select
                        value={editFormData.status}
                        onChange={e => setEditFormData({...editFormData, status: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                      >
                        <option value="未處理">未處理</option>
                        <option value="維修中">維修中</option>
                        <option value="待料中">待料中</option>
                        <option value="已完成">已完成</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">負責廠商</label>
                      <input
                        type="text"
                        value={editFormData.vendorCompany}
                        onChange={e => setEditFormData({...editFormData, vendorCompany: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500">預計維修時間</label>
                      <input
                        type="date"
                        value={editFormData.estRepairTime}
                        onChange={e => setEditFormData({...editFormData, estRepairTime: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500">廠商回覆</label>
                      <textarea
                        value={editFormData.vendorReply}
                        onChange={e => setEditFormData({...editFormData, vendorReply: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[80px]"
                        placeholder="廠商回覆..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 bg-slate-200/50 hover:bg-slate-200 rounded-xl transition-all"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => handleUpdate(issue.id)}
                      className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-500/20"
                    >
                      更新儲存
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 mb-1">負責廠商</p>
                    <p className="text-slate-700 font-medium truncate">
                      {issue.involvedVendors && issue.involvedVendors.length > 1 
                        ? issue.involvedVendors.join('、')
                        : (issue.vendorCompany || <span className="text-slate-400 italic">未指定</span>)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 mb-1">預計維修時間</p>
                    <p className="text-slate-700 font-medium">{issue.estRepairTime || <span className="text-slate-400 italic">未定</span>}</p>
                  </div>
                  <div className="col-span-1 sm:col-span-3 border-t border-slate-200/60 pt-2 mt-1">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">廠商回覆</p>
                    <p className="text-slate-700">{issue.vendorReply || <span className="text-slate-400 italic">暫無回覆</span>}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {filteredIssues.length === 0 && (
          <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
            無符合條件的維修紀錄
          </div>
        )}
      </div>

      {selectedIssue && (
        <LineNotifyModal
          isOpen={!!selectedIssue}
          onClose={() => setSelectedIssue(null)}
          vendorCompany={selectedIssue.vendorCompany}
          projectName={projectsMap[selectedIssue.warrantyId] || '未知專案'}
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
