import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  FileSearch,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeWarrantyDocuments, ExtractedWarranty } from '../services/aiService';
import { cn } from '../lib/utils';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

interface AIImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AIImportModal({ onClose, onSuccess }: AIImportModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedWarranty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: File[] = Array.from(e.target.files);
      setFiles((prev: File[]) => {
        // Filter out files that are already in the list (simple check by name and size)
        const uniqueNewFiles = newFiles.filter(nf => 
          !prev.some((pf: File) => pf.name === nf.name && pf.size === nf.size)
        );
        return [...prev, ...uniqueNewFiles];
      });
      // Reset input value so the same file can be selected again if removed
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev: File[]) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const data = await analyzeWarrantyDocuments(files);
      setExtractedData(data);
    } catch (err) {
      console.error(err);
      setError('分析失敗，請檢查檔案格式或網路連線。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    if (!extractedData) return;
    try {
      const expiryDate = new Date(extractedData.expiryDate);
      await addDoc(collection(db, 'warranties'), {
        projectName: extractedData.projectName,
        vendor: extractedData.vendor,
        expiryDate: Timestamp.fromDate(expiryDate),
        deposit: extractedData.deposit,
        warrantyScope: extractedData.warrantyScope,
        issueRemark: '',
        isRefunded: false,
        hasIssue: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      onSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'warranties');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">AI 智慧掃描匯入</h2>
              <p className="text-xs text-slate-500 font-medium">上傳合約或驗收文件，由 AI 自動提取保固資訊</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!extractedData ? (
            <div className="space-y-6">
              {/* Upload Zone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer",
                  files.length > 0 ? "border-indigo-400 bg-indigo-50/30" : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50"
                )}
              >
                <input 
                  type="file" 
                  multiple 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept=".pdf,image/*"
                />
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-700">點擊或拖放檔案至此</p>
                  <p className="text-xs text-slate-400 mt-1">支援 PDF、JPG、PNG 等格式，可選取多個檔案</p>
                </div>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> 待處理檔案 ({files.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {files.map((file, i) => (
                      <div key={i} className="group relative flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors">
                        <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 font-mono text-[10px]">
                          {file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(i);
                          }}
                          className="absolute -top-1 -right-1 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-center gap-3 text-red-600">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center gap-3 text-green-700">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold">分析完成！</p>
                  <p className="text-xs">請檢查以下提取的資訊是否正確</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">工程名稱</label>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-slate-800">
                    {extractedData.projectName}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">廠商名稱</label>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-slate-800">
                    {extractedData.vendor}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">保固到期日</label>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-slate-800">
                    {extractedData.expiryDate}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">保固正金金額</label>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-slate-800">
                    $ {extractedData.deposit.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">提取的保固範圍</label>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
                  {extractedData.warrantyScope}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
          {!extractedData ? (
            <button
              onClick={handleAnalyze}
              disabled={files.length === 0 || isAnalyzing}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-3 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  AI 分析中...
                </>
              ) : (
                <>
                  <FileSearch className="w-5 h-5" />
                  開始分析文件
                </>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={() => setExtractedData(null)}
                className="flex-1 bg-white border border-slate-200 text-slate-600 py-3 px-6 rounded-2xl font-bold hover:bg-slate-50 transition-all font-sans"
              >
                重新上傳
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-2xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
              >
                確認並匯入清單
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
