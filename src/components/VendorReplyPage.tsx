import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface VendorReplyPageProps {
  issueId: string;
}

export default function VendorReplyPage({ issueId }: VendorReplyPageProps) {
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // Form states
  const [status, setStatus] = useState<'未處理' | '維修中' | '待料中' | '已完成'>('未處理');
  const [vendorReply, setVendorReply] = useState('');
  const [estRepairTime, setEstRepairTime] = useState('');

  useEffect(() => {
    const fetchIssue = async () => {
      try {
        const docRef = doc(db, 'issues', issueId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIssue({ id: docSnap.id, ...data });
          setStatus(data.status || '未處理');
          setVendorReply(data.vendorReply || '');
          setEstRepairTime(data.estRepairTime || '');
        } else {
          setIssue(null);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchIssue();
  }, [issueId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'issues', issueId), {
        status,
        vendorReply,
        estRepairTime,
        hasUnreadReply: true,
        updatedAt: serverTimestamp()
      });
      setSubmitted(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">找不到工單</h2>
          <p className="text-slate-500 text-sm">請確認連結是否正確，或該工單已被刪除。</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">回覆已送出</h2>
          <p className="text-slate-500 text-sm">感謝您的回覆，承辦人將會收到通知。</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none">廠商維修回覆系統</h1>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
          <div className="bg-slate-800 p-6 text-white">
            <span className="px-2 py-1 bg-white/20 text-white text-[10px] font-bold rounded uppercase tracking-wider mb-3 inline-block">
              損壞項目確認
            </span>
            <h2 className="text-2xl font-bold mb-2">{issue.issueName}</h2>
            <p className="text-slate-300 text-sm flex items-center gap-2">
              <span className="opacity-70">負責廠商：</span> 
              <span className="font-medium bg-white/10 px-2 py-0.5 rounded">{issue.vendorCompany || '未指定'}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">處理狀態</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800"
              >
                <option value="未處理">未處理</option>
                <option value="維修中">維修中</option>
                <option value="待料中">待料中</option>
                <option value="已完成">已完成</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">預計維修時間</label>
              <input
                type="date"
                value={estRepairTime}
                onChange={e => setEstRepairTime(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">詳細回覆說明</label>
              <textarea
                value={vendorReply}
                onChange={e => setVendorReply(e.target.value)}
                placeholder="請描述預計處理方式、原因或進度..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[120px] resize-y font-medium text-slate-800"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              送出回覆
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
