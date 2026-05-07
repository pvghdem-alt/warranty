import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CornerUpLeft } from 'lucide-react';

interface ReturnTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export default function ReturnTicketModal({ isOpen, onClose, onSubmit }: ReturnTicketModalProps) {
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (!reason.trim()) return;
    onSubmit(reason.trim());
    setReason("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden z-10 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <CornerUpLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">退回工單</h3>
                <p className="text-sm text-slate-500 font-medium">請輸入退件原因，以通知廠商修正</p>
              </div>
            </div>

            <textarea
              className="w-full min-h-[120px] p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all resize-none text-sm text-slate-700"
              placeholder="例如：維修照片不清晰、填寫內容有誤等..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason.trim()}
                className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-red-500/20 flex items-center gap-2"
              >
                <CornerUpLeft className="w-4 h-4" /> 確認退件
              </button>
            </div>
            
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
