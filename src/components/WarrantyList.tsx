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
  Wrench
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProjectIssuesModal from './ProjectIssuesModal';

interface WarrantyListProps {
  onEdit: (warranty: Warranty) => void;
}

export default function WarrantyList({ onEdit }: WarrantyListProps) {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectForIssues, setSelectedProjectForIssues] = useState<{id: string, name: string, vendor: string} | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'warranties'), orderBy('expiryDate', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Warranty[];
      setWarranties(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'warranties');
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除這筆保固資料嗎？')) return;
    try {
      await deleteDoc(doc(db, 'warranties', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `warranties/${id}`);
    }
  };

  const filteredWarranties = warranties.filter(w => 
    w.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.issueRemark || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">工程資訊</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">保固到期日</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">保固金</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">狀態 / 備註</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">管理</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {filteredWarranties.map((w) => {
                  const status = getExpiryStatus(w.expiryDate.toDate(), w.hasIssue);
                  return (
                    <motion.tr
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={w.id}
                      className={cn(
                        "group transition-colors",
                        w.hasIssue ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-slate-50"
                      )}
                    >
                      <td className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            w.hasIssue ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                          )}>
                            <Construction className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-tight">{w.projectName}</div>
                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> {w.vendor || '未知廠商'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="text-sm font-semibold text-slate-700">{toROCDate(w.expiryDate.toDate())}</div>
                        <div className={cn("text-[11px] mt-1 flex items-center justify-center gap-1", status.color)}>
                          <Clock className="w-3 h-3" /> {status.label}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="text-sm font-bold text-slate-800">{formatCurrency(w.deposit)}</div>
                        <div className={cn(
                          "text-[10px] mt-1 font-medium",
                          w.isRefunded ? "text-blue-600" : "text-slate-400"
                        )}>
                          {w.isRefunded ? '✅ 已退款' : '⏳ 未退款'}
                        </div>
                      </td>
                      <td className="p-4 max-w-xs">
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
                        <div className="text-[11px] text-slate-500 italic line-clamp-2">
                          {w.issueRemark || '無備註'}
                        </div>
                        {w.warrantyScope && (
                          <div className="mt-2 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 line-clamp-3">
                            <span className="font-bold">保固範圍：</span>{w.warrantyScope}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => w.id && setSelectedProjectForIssues({ id: w.id, name: w.projectName, vendor: w.vendor })}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="維修管理"
                          >
                            <Wrench className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onEdit(w)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="修改"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => w.id && handleDelete(w.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
