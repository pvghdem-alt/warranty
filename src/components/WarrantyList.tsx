import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { Warranty } from '../types';
import { toROCDate, getExpiryStatus } from '../utils/rocDate';
import { formatCurrency, cn } from '../lib/utils';
import { 
  Edit3, 
  Trash2, 
  Search, 
  AlertTriangle, 
  Clock, 
  CheckCircle,
  Construction,
  Building2,
  Wrench,
  ExternalLink,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProjectIssuesModal from './ProjectIssuesModal';
import ConfirmModal from './ConfirmModal';

import ProjectNotifyModal from './ProjectNotifyModal';

export interface Issue {
  id?: string;
  warrantyId: string;
  vendorCompany: string;
  issueName: string;
  status: '未處理' | '維修中' | '待料中' | '已完成';
  createdAt?: any;
}

interface WarrantyListProps {
  onEdit: (warranty: Warranty) => void;
}

export default function WarrantyList({ onEdit }: WarrantyListProps) {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectForIssues, setSelectedProjectForIssues] = useState<{id: string, name: string, vendor: string} | null>(null);
  const [selectedProjectForNotify, setSelectedProjectForNotify] = useState<{id: string, name: string} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  useEffect(() => {
    const wq = query(collection(db, 'warranties'), orderBy('expiryDate', 'asc'));
    const unsubscribeW = onSnapshot(wq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Warranty[];
      setWarranties(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'warranties');
    });

    const iq = query(collection(db, 'issues'));
    const unsubscribeI = onSnapshot(iq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Issue[];
      setIssues(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'issues');
    });

    return () => {
      unsubscribeW();
      unsubscribeI();
    };
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'warranties', id));
      setDeleteConfirm({ isOpen: false, id: null });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `warranties/${id}`);
    }
  };

  const filteredWarranties = warranties.filter(w => 
    w.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.issueRemark || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getIssueStats = (warrantyId: string) => {
    const projectIssues = issues.filter(i => i.warrantyId === warrantyId);
    if (!projectIssues.length) return null;
    
    const unhandled = projectIssues.filter(i => i.status === '未處理').length;
    const fixing = projectIssues.filter(i => i.status === '維修中').length;
    const waiting = projectIssues.filter(i => i.status === '待料中').length;
    const done = projectIssues.filter(i => i.status === '已完成').length;
    const total = projectIssues.length;
    
    return { unhandled, fixing, waiting, done, total };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium animate-pulse">讀取保固清單中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {selectedProjectForIssues && (
          <ProjectIssuesModal
            warrantyId={selectedProjectForIssues.id}
            projectName={selectedProjectForIssues.name}
            vendorName={selectedProjectForIssues.vendor}
            onClose={() => setSelectedProjectForIssues(null)}
          />
        )}
        {selectedProjectForNotify && (
          <ProjectNotifyModal
            isOpen={true}
            onClose={() => setSelectedProjectForNotify(null)}
            projectName={selectedProjectForNotify.name}
            warrantyId={selectedProjectForNotify.id}
            issues={issues.filter(i => i.warrantyId === selectedProjectForNotify.id)}
          />
        )}
      </AnimatePresence>

      {/* 搜尋欄 */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-500 transition-colors" />
        <input
          type="text"
          placeholder="關鍵字搜尋：工程名稱、廠商、備註..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all shadow-sm"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="md:overflow-x-visible">
          <table className="w-full text-left border-collapse block md:table">
            <thead className="hidden md:table-header-group">
              <tr className="bg-slate-50/80 border-b border-slate-200 block md:table-row">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider block md:table-cell">工程資訊</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center block md:table-cell">保固到期日</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right block md:table-cell">保固金</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider block md:table-cell">狀態 / 備註</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center block md:table-cell">管理</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group md:divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {filteredWarranties.map((w) => {
                  const status = getExpiryStatus(w.expiryDate.toDate(), w.hasIssue);
                  const stats = getIssueStats(w.id!);
                  return (
                    <motion.tr
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={w.id}
                      className={cn(
                        "group transition-colors block md:table-row p-4 md:p-0 border-b border-slate-100 last:border-0",
                        w.hasIssue ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-slate-50"
                      )}
                    >
                      <td className="block md:table-cell p-0 md:p-4 pb-3 md:pb-4 border-b border-dashed border-slate-200 md:border-none">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-lg mt-1",
                            w.hasIssue ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                          )}>
                            <Construction className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-tight">{w.projectName}</div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 flex-wrap">
                              <Building2 className="w-3 h-3 flex-shrink-0" /> 
                              {w.vendor ? (
                                <div className="flex flex-wrap items-center gap-0.5">
                                  {w.vendor.split('、').map((v, i, arr) => (
                                    <React.Fragment key={i}>
                                      <a 
                                        href={`/?vendor=${encodeURIComponent(v.trim())}&project=${encodeURIComponent(w.id || '')}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="hover:text-blue-600 hover:underline inline-flex items-center gap-0.5"
                                        onClick={(e) => {
                                          const url = `${window.location.origin}/?vendor=${v.trim()}&project=${w.id || ''}`;
                                          navigator.clipboard.writeText(url).catch(() => {});
                                        }}
                                      >
                                        {v.trim()}
                                      </a>
                                      {i < arr.length - 1 && <span className="text-slate-400 mr-0.5">、</span>}
                                      {i === arr.length - 1 && <ExternalLink className="w-3 h-3 opacity-50 ml-0.5" />}
                                    </React.Fragment>
                                  ))}
                                </div>
                              ) : '未知廠商'}
                            </div>
                            {stats && (
                              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold">
                                {stats.unhandled > 0 && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">未處理：{stats.unhandled}</span>}
                                {stats.fixing > 0 && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">維修中：{stats.fixing}</span>}
                                {stats.waiting > 0 && <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">待料中：{stats.waiting}</span>}
                                {stats.done > 0 && <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">已完成：{stats.done}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="flex items-center justify-between md:table-cell p-0 md:p-4 mt-3 md:mt-0 text-left md:text-center align-top md:pt-5">
                        <span className="md:hidden text-xs font-bold text-slate-500">保固到期日：</span>
                        <div className="text-right md:text-center">
                          <div className="text-sm font-semibold text-slate-700">{toROCDate(w.expiryDate.toDate())}</div>
                          <div className={cn("text-[11px] mt-1 flex justify-end md:justify-center items-center gap-1", status.color)}>
                            <Clock className="w-3 h-3" /> {status.label}
                          </div>
                        </div>
                      </td>
                      <td className="flex items-center justify-between md:table-cell p-0 md:p-4 mt-2 md:mt-0 text-right align-top md:pt-5">
                        <span className="md:hidden text-xs font-bold text-slate-500">保固金：</span>
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-800">{formatCurrency(w.deposit)}</div>
                          <div className={cn(
                            "text-[10px] mt-1 font-medium",
                            w.isRefunded ? "text-blue-600" : "text-slate-400"
                          )}>
                            {w.isRefunded ? '✅ 已退款' : '⏳ 未退款'}
                          </div>
                        </div>
                      </td>
                      <td className="block md:table-cell p-0 md:p-4 mt-3 md:mt-0 pt-3 md:pt-4 border-t border-dashed border-slate-200 md:border-none md:max-w-xs align-top">
                        <div className="mb-2">
                          {w.hasIssue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-extrabold uppercase">
                              <AlertTriangle className="w-3 h-3" /> 維修中
                            </span>
                          ) : (
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
                              status.days < 0 ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-700"
                            )}>
                              {status.days < 0 ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {status.days < 0 ? '已結案' : '正常保固'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 italic line-clamp-2 md:line-clamp-3">
                          {w.issueRemark || '無備註'}
                        </div>
                        {w.warrantyScope && (
                          <div className="mt-2 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 line-clamp-2 md:line-clamp-3">
                            <span className="font-bold">保固範圍：</span>{w.warrantyScope}
                          </div>
                        )}
                      </td>
                      <td className="block md:table-cell p-0 md:p-4 mt-4 md:mt-0 pt-3 md:pt-5 border-t border-slate-100 md:border-none align-top">
                        <div className="flex justify-end md:justify-center items-center gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => w.id && setSelectedProjectForIssues({ id: w.id, name: w.projectName, vendor: w.vendor })}
                            className="flex-1 md:flex-none p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 md:bg-transparent hover:bg-indigo-50 rounded-lg transition-all flex justify-center items-center gap-1"
                            title="維修管理"
                          >
                            <Wrench className="w-4 h-4" />
                            <span className="md:hidden text-xs">維修</span>
                          </button>
                          <button
                            onClick={() => w.id && setSelectedProjectForNotify({ id: w.id, name: w.projectName })}
                            className="flex-1 md:flex-none p-2 text-slate-400 hover:text-orange-600 bg-slate-50 md:bg-transparent hover:bg-orange-50 rounded-lg transition-all flex justify-center items-center gap-1"
                            title="寄發進度通知"
                          >
                            <Bell className="w-4 h-4" />
                            <span className="md:hidden text-xs">催修</span>
                          </button>
                          <button
                            onClick={() => onEdit(w)}
                            className="flex-1 md:flex-none p-2 text-slate-400 hover:text-blue-600 bg-slate-50 md:bg-transparent hover:bg-blue-50 rounded-lg transition-all flex justify-center items-center gap-1"
                            title="修改"
                          >
                            <Edit3 className="w-4 h-4" />
                            <span className="md:hidden text-xs">修改</span>
                          </button>
                          <button
                            onClick={() => w.id && setDeleteConfirm({ isOpen: true, id: w.id })}
                            className="flex-1 md:flex-none p-2 text-slate-400 hover:text-red-600 bg-slate-50 md:bg-transparent hover:bg-red-50 rounded-lg transition-all flex justify-center items-center gap-1"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="md:hidden text-xs">刪除</span>
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        {filteredWarranties.length === 0 && (
          <div className="p-20 text-center text-slate-400">
            <Construction className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>找不到符合條件的保固案件</p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="刪除保固資料"
        message="確定要刪除這筆保固資料嗎？此動作無法復原。"
        onConfirm={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />
    </div>
  );
}

