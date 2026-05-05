import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { Warranty } from '../types';
import { fromROCComponents } from '../utils/rocDate';
import { Calendar, Building2, Wallet, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface WarrantyFormProps {
  editData?: Warranty | null;
  onClose?: () => void;
  onSuccess?: () => void;
}

export default function WarrantyForm({ editData, onClose, onSuccess }: WarrantyFormProps) {
  const currentYear = new Date().getFullYear();
  const currentROCYear = currentYear - 1911;

  const [formData, setFormData] = useState({
    projectName: '',
    vendor: '',
    rocYear: currentROCYear,
    rocMonth: new Date().getMonth() + 1,
    rocDay: new Date().getDate(),
    deposit: 0,
    issueRemark: '',
    warrantyScope: '',
    isRefunded: false,
    hasIssue: false
  });

  useEffect(() => {
    if (editData) {
      const date = editData.expiryDate.toDate();
      setFormData({
        projectName: editData.projectName,
        vendor: editData.vendor,
        rocYear: date.getFullYear() - 1911,
        rocMonth: date.getMonth() + 1,
        rocDay: date.getDate(),
        deposit: editData.deposit,
        issueRemark: editData.issueRemark || '',
        warrantyScope: editData.warrantyScope || '',
        isRefunded: editData.isRefunded,
        hasIssue: editData.hasIssue
      });
    }
  }, [editData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName) return alert('請輸入工程名稱');

    const expiryDate = fromROCComponents(formData.rocYear, formData.rocMonth, formData.rocDay);
    
    const payload = {
      projectName: formData.projectName,
      vendor: formData.vendor,
      expiryDate: Timestamp.fromDate(expiryDate),
      deposit: Number(formData.deposit),
      issueRemark: formData.issueRemark,
      warrantyScope: formData.warrantyScope,
      isRefunded: formData.isRefunded,
      hasIssue: formData.hasIssue,
      updatedAt: serverTimestamp()
    };

    try {
      if (editData?.id) {
        await updateDoc(doc(db, 'warranties', editData.id), payload);
      } else {
        await addDoc(collection(db, 'warranties'), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      onSuccess?.();
      if (!editData) {
        setFormData({
          projectName: '',
          vendor: '',
          rocYear: currentROCYear,
          rocMonth: new Date().getMonth() + 1,
          rocDay: new Date().getDate(),
          deposit: 0,
          issueRemark: '',
          isRefunded: false,
          hasIssue: false
        });
      }
    } catch (error) {
      handleFirestoreError(error, editData ? OperationType.UPDATE : OperationType.CREATE, 'warranties');
    }
  };

  const years = Array.from({ length: 30 }, (_, i) => currentROCYear - 5 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {editData ? <Calendar className="w-5 h-5 text-orange-500" /> : <Calendar className="w-5 h-5 text-blue-600" />}
            {editData ? '修改保固案件' : '新增保固案件'}
          </h2>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> 工程/採購名稱
              </label>
              <input
                type="text"
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                placeholder="例如：113年度機電維護工程"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> 廠商名稱
              </label>
              <input
                type="text"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="請輸入廠商名稱"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600">保固到期日 (民國)</label>
              <div className="flex items-center gap-2">
                <select
                  value={formData.rocYear}
                  onChange={(e) => setFormData({ ...formData, rocYear: Number(e.target.value) })}
                  className="flex-1 px-2 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 bg-white"
                >
                  {years.map(y => <option key={y} value={y}>{y} 年</option>)}
                </select>
                <select
                  value={formData.rocMonth}
                  onChange={(e) => setFormData({ ...formData, rocMonth: Number(e.target.value) })}
                  className="w-20 px-2 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 bg-white"
                >
                  {months.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')} 月</option>)}
                </select>
                <select
                  value={formData.rocDay}
                  onChange={(e) => setFormData({ ...formData, rocDay: Number(e.target.value) })}
                  className="w-20 px-2 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-500 bg-white"
                >
                  {days.map(d => <option key={d} value={d}>{String(d).padStart(2, '0')} 日</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <Wallet className="w-4 h-4" /> 保固金金額
              </label>
              <input
                type="number"
                value={formData.deposit}
                onChange={(e) => setFormData({ ...formData, deposit: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600">保固範圍說明</label>
            <textarea
              value={formData.warrantyScope}
              onChange={(e) => setFormData({ ...formData, warrantyScope: e.target.value })}
              placeholder="例如：主體結構保固5年，一般機電1年..."
              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600">備註 / 維修狀況</label>
            <textarea
              value={formData.issueRemark}
              onChange={(e) => setFormData({ ...formData, issueRemark: e.target.value })}
              placeholder="紀錄維修進度、零件更換等細節..."
              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              rows={2}
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={formData.isRefunded}
                  onChange={(e) => setFormData({ ...formData, isRefunded: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </div>
              <span className="text-sm font-medium text-slate-600 flex items-center gap-1">
                <CheckCircle2 className={cn("w-4 h-4", formData.isRefunded ? "text-blue-600" : "text-slate-400")} />
                保證金已退
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={formData.hasIssue}
                  onChange={(e) => setFormData({ ...formData, hasIssue: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-red-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </div>
              <span className={cn("text-sm font-bold flex items-center gap-1", formData.hasIssue ? "text-red-600" : "text-slate-600")}>
                <AlertTriangle className={cn("w-4 h-4", formData.hasIssue ? "text-red-600" : "text-slate-400")} />
                目前有報修
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className={cn(
                "flex-1 py-3 px-6 rounded-xl font-bold text-white transition-all transform active:scale-95 shadow-lg",
                editData ? "bg-orange-500 hover:bg-orange-600 shadow-orange-500/20" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
              )}
            >
              {editData ? '更新資料' : '儲存案件'}
            </button>
            {editData && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-6 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
              >
                取消
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
