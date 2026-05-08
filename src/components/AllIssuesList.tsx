import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Edit3, Trash2, Search, MessageCircle, AlertCircle, Clock, Construction, Wrench, BarChart2, ListTodo, ExternalLink, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ProjectIssuesModal from './ProjectIssuesModal'; // We can reuse the edit form logic, or just make an inline edit here.
import LineNotifyModal from './LineNotifyModal';
import ConfirmModal from './ConfirmModal';
import ReturnTicketModal from './ReturnTicketModal';
import ImageUpload from './ImageUpload';
import ImageViewerModal from './ImageViewerModal';

interface Issue {
  id: string;
  issueName: string;
  vendorCompany: string;
  status: '未處理' | '維修中' | '待料中' | '待確認' | '已完成';
  vendorReply: string;
  estRepairTime: string;
  createdAt?: any;
  updatedAt?: any;
  warrantyId: string;
  hasUnreadReply?: boolean;
  returnReason?: string;
  photoUrls?: string[];
  completionPhotoUrls?: string[];
}

const statusColors = {
  '未處理': 'bg-red-100 text-red-700 border-red-200',
  '維修中': 'bg-orange-100 text-orange-700 border-orange-200',
  '待料中': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  '待確認': 'bg-blue-100 text-blue-700 border-blue-200',
  '已完成': 'bg-green-100 text-green-700 border-green-200',
};

export default function AllIssuesList() {
  const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all'|'未讀回覆'|'未處理'|'維修中'|'待料中'|'已完成'|'待確認'>('未讀回覆');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  // Warranty projects map
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [returnTicketModal, setReturnTicketModal] = useState<{ isOpen: boolean; issue: Issue | null }>({ isOpen: false, issue: null });
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

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
        // Sort unread issues to the top
        if (a.hasUnreadReply && !b.hasUnreadReply) return -1;
        if (!a.hasUnreadReply && b.hasUnreadReply) return 1;
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

  const handleConfirmTicket = async (issue: Issue) => {
    try {
      if (issue.id) {
        await updateDoc(doc(db, 'issues', issue.id), {
          status: '已完成',
          hasUnreadReply: false, // Ensure badge clears if it's confirmed
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues/${issue.id}`);
    }
  };

  const handleReturnTicket = async (reason: string) => {
    const issue = returnTicketModal.issue;
    if (!issue || !issue.id) return;
    
    try {
      await updateDoc(doc(db, 'issues', issue.id), {
        status: '未處理',
        returnReason: reason,
        hasUnreadReply: true,
        updatedAt: serverTimestamp()
      });
      setReturnTicketModal({ isOpen: false, issue: null });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues/${issue.id}`);
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
        vendorCompany: issue.vendorCompany || '',
        photoUrls: issue.photoUrls || [],
        completionPhotoUrls: (issue as any).completionPhotoUrls || []
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
    if (activeTab === '未讀回覆' && !i.hasUnreadReply) return false;
    if (activeTab !== 'all' && activeTab !== '未讀回覆' && i.status !== activeTab) return false;
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

  const vendorStats = useMemo(() => {
    const stats: Record<string, { total: number, unhandled: number, fixing: number, waiting: number, done: number }> = {};
    issues.forEach(i => {
      let rawVendor = i.vendorCompany || '未知廠商';
      const vendorsList = rawVendor.split(/[,、;]+/).map(v => v.trim()).filter(Boolean);
      
      const vToCount = vendorsList.length > 0 ? vendorsList : ['未知廠商'];
      vToCount.forEach(v => {
        if (!stats[v]) {
          stats[v] = { total: 0, unhandled: 0, fixing: 0, waiting: 0, done: 0 };
        }
        stats[v].total++;
        if (i.status === '未處理') stats[v].unhandled++;
        if (i.status === '維修中') stats[v].fixing++;
        if (i.status === '待料中') stats[v].waiting++;
        if (i.status === '已完成') stats[v].done++;
      });
    });
    return Object.entries(stats).sort((a, b) => b[1].total - a[1].total);
  }, [issues]);

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
      <div className="flex bg-slate-200/50 p-1 rounded-xl max-w-sm">
        <button
          onClick={() => setViewMode('list')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all",
            viewMode === 'list' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <ListTodo className="w-4 h-4" />
          工單列表
        </button>
        <button
          onClick={() => setViewMode('stats')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold text-sm transition-all",
            viewMode === 'stats' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <BarChart2 className="w-4 h-4" />
          廠商統計
        </button>
      </div>

      {viewMode === 'stats' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-bold text-slate-500 text-sm">廠商名稱</th>
                <th className="p-4 font-bold text-slate-500 text-sm text-center">總工單數</th>
                <th className="p-4 font-bold text-slate-500 text-sm text-center">未處理</th>
                <th className="p-4 font-bold text-slate-500 text-sm text-center">維修中</th>
                <th className="p-4 font-bold text-slate-500 text-sm text-center">待料中</th>
                <th className="p-4 font-bold text-slate-500 text-sm text-center">已完成</th>
                <th className="p-4 font-bold text-slate-500 text-sm text-center">廠商專頁</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendorStats.map(([vendor, stat]) => (
                <tr key={vendor} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-bold text-slate-800">{vendor}</td>
                  <td className="p-4 text-center font-bold">{stat.total}</td>
                  <td className="p-4 text-center">
                    {stat.unhandled > 0 ? (
                      <span className="inline-block bg-red-100 text-red-700 px-2 py-1 rounded font-bold text-sm">
                        {stat.unhandled}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="p-4 text-center">
                    {stat.fixing > 0 ? (
                      <span className="inline-block bg-orange-100 text-orange-700 px-2 py-1 rounded font-bold text-sm">
                        {stat.fixing}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="p-4 text-center">
                    {stat.waiting > 0 ? (
                      <span className="inline-block bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-bold text-sm">
                        {stat.waiting}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="p-4 text-center">
                    {stat.done > 0 ? (
                      <span className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded font-bold text-sm">
                        {stat.done}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="p-4 text-center">
                    <a 
                      href={`/?vendor=${encodeURIComponent(vendor)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="開啟廠商專屬頁面"
                      onClick={(e) => {
                        const url = `${window.location.origin}/?vendor=${vendor}`;
                        navigator.clipboard.writeText(url).catch(() => {});
                      }}
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  </td>
                </tr>
              ))}
              {vendorStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">目前沒有任何廠商統計資料</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl overflow-x-auto">
        {(['all', '未讀回覆', '未處理', '維修中', '待料中', '待確認', '已完成'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex-1 text-center relative",
              activeTab === tab 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50",
              tab === '未讀回覆' && "text-red-600 hover:text-red-700"
            )}
          >
            {tab === 'all' ? '所有工單' : tab}
            {tab === '未讀回覆' && issues.filter(i => i.hasUnreadReply).length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
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
            className="w-full h-full px-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-slate-500/5 focus:border-slate-500 transition-all shadow-sm appearance-none text-lg text-slate-800 font-black"
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
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={cn("px-2 py-0.5 text-xs font-bold rounded border", statusColors[issue.status])}>
                      {issue.status}
                    </span>
                    {issue.hasUnreadReply && (
                      <span className="flex items-center gap-1">
                        <span className="px-2 py-0.5 text-xs font-bold rounded border bg-red-100 text-red-700 border-red-200 animate-pulse">
                          新回覆
                        </span>
                        <button
                          onClick={() => markAsRead(issue.id)}
                          className="px-2 py-0.5 text-xs font-bold rounded border bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 transition-colors shadow-sm"
                        >
                          標記已讀
                        </button>
                      </span>
                    )}
                    <span className="text-base md:text-lg font-black text-blue-800 bg-blue-100 px-3 py-1 rounded shadow-sm border border-blue-200">
                      {projName}
                    </span>
                    {issue.status !== '已完成' && waitDays > 0 && (
                      <span className="text-xs font-bold text-red-500">
                        待機 {waitDays} 天
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-xl text-slate-800 mt-3 flex items-center gap-2">
                    {issue.issueName}
                    {issue.vendorCompany && (
                      <div className="flex flex-wrap items-center gap-1.5 ml-2">
                        {issue.vendorCompany.split(/[,、;]+/).map(v => v.trim()).filter(Boolean).map((v, i) => (
                          <a 
                            key={i}
                            href={`/?vendor=${encodeURIComponent(v)}&project=${encodeURIComponent(issue.warrantyId)}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md text-[10px] hover:bg-blue-100 hover:text-blue-700 transition-colors inline-flex items-center gap-1 leading-none shadow-sm"
                            onClick={(e) => {
                              const url = `${window.location.origin}/?vendor=${v}&project=${issue.warrantyId}`;
                              navigator.clipboard.writeText(url).catch(() => {});
                            }}
                          >
                            <Building2 className="w-3 h-3" />
                            {v}
                          </a>
                        ))}
                      </div>
                    )}
                  </h3>
                  {issue.returnReason && (
                    <p className="text-sm font-bold text-red-600 mt-2 bg-red-50 p-2 rounded-lg border border-red-100">
                      退件原因：{issue.returnReason}
                    </p>
                  )}
                  <p className="text-sm text-slate-500 mt-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> 登載日期：{issue.createdAt?.toDate?.().toLocaleDateString('zh-TW')}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  {issue.status === '待確認' && (
                    <>
                      <button
                        onClick={() => handleConfirmTicket(issue)}
                        className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                      >
                        已確認
                      </button>
                      <button
                        onClick={() => setReturnTicketModal({ isOpen: true, issue: issue })}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                      >
                        退回工單
                      </button>
                    </>
                  )}
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
                        <option value="待確認">待確認</option>
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
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500">相關照片上傳</label>
                      <ImageUpload photoUrls={editFormData.photoUrls} onChange={urls => setEditFormData({...editFormData, photoUrls: urls})} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500">完工照片上傳</label>
                      <ImageUpload photoUrls={editFormData.completionPhotoUrls} onChange={urls => setEditFormData({...editFormData, completionPhotoUrls: urls})} />
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
                  
                  {issue.photoUrls && issue.photoUrls.length > 0 && (
                    <div className="col-span-1 sm:col-span-3 border-t border-slate-200/60 pt-2 mt-1">
                      <p className="text-[10px] font-bold text-slate-400 mb-2">相關照片</p>
                      <div className="flex flex-wrap gap-2">
                        {issue.photoUrls.map((url, idx) => (
                          <button key={`photo-${idx}`} type="button" onClick={() => setViewImageUrl(url)} className="block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity bg-black">
                            <img src={url} alt="Issue" className="w-full h-full object-contain" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {(issue as any).completionPhotoUrls && (issue as any).completionPhotoUrls.length > 0 && (
                    <div className="col-span-1 sm:col-span-3 border-t border-slate-200/60 pt-2 mt-1">
                      <p className="text-[10px] font-bold text-emerald-500 mb-2">完工照片</p>
                      <div className="flex flex-wrap gap-2">
                        {(issue as any).completionPhotoUrls.map((url: string, idx: number) => (
                          <button key={`comp-${idx}`} type="button" onClick={() => setViewImageUrl(url)} className="block w-16 h-16 rounded-lg overflow-hidden border border-emerald-200 hover:opacity-80 transition-opacity bg-black">
                            <img src={url} alt="Completion" className="w-full h-full object-contain" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
      </>
      )}

      {selectedIssue && (
        <LineNotifyModal
          isOpen={!!selectedIssue}
          onClose={() => setSelectedIssue(null)}
          vendorCompany={selectedIssue.vendorCompany}
          projectName={projectsMap[selectedIssue.warrantyId] || '未知專案'}
          issueName={selectedIssue.issueName}
          status={selectedIssue.status}
          warrantyId={selectedIssue.warrantyId}
        />
      )}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="刪除維修紀錄"
        message="確定要刪除這筆維修紀錄嗎？此動作無法復原。"
        onConfirm={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />
      <ReturnTicketModal
        isOpen={returnTicketModal.isOpen}
        onClose={() => setReturnTicketModal({ isOpen: false, issue: null })}
        onSubmit={handleReturnTicket}
      />
      <ImageViewerModal url={viewImageUrl} onClose={() => setViewImageUrl(null)} />
    </div>
  );
}
