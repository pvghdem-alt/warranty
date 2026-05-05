import React, { useState } from 'react';
import { ShieldCheck, LayoutDashboard, Plus, Lock, Github, ExternalLink, Sparkles } from 'lucide-react';
import WarrantyForm from './components/WarrantyForm';
import WarrantyList from './components/WarrantyList';
import AIImportModal from './components/AIImportModal';
import { Warranty } from './types';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [editingWarranty, setEditingWarranty] = useState<Warranty | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  const handleEdit = (warranty: Warranty) => {
    setEditingWarranty(warranty);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingWarranty(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900">
      <AnimatePresence>
        {showAIModal && (
          <AIImportModal 
            onClose={() => setShowAIModal(false)} 
            onSuccess={() => setShowAIModal(false)}
          />
        )}
      </AnimatePresence>

      {/* 頂部導航 */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">工程保固系統</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Warranty Management v2.0</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden md:flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-slate-500 text-xs font-bold">
                <Lock className="w-3 h-3" /> 免登入版
              </div>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAIModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
              >
                <Sparkles className="w-4 h-4" /> <span className="hidden sm:inline">AI 匯入</span>
              </motion.button>

              {!showForm && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
                >
                  <Plus className="w-4 h-4" /> <span className="hidden sm:inline">新增案件</span>
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="space-y-12">
          {/* 表單區域 */}
          <AnimatePresence mode="wait">
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto"
              >
                <WarrantyForm 
                  editData={editingWarranty} 
                  onClose={handleCloseForm}
                  onSuccess={handleCloseForm}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* 清單區域 */}
          <div className="space-y-6">
            <div className="flex items-end justify-between px-2">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <LayoutDashboard className="w-6 h-6 text-blue-600" />
                  工程保固清單
                </h2>
                <p className="text-slate-400 text-sm">追蹤所有保固案件、維修進度與保證金狀態</p>
              </div>
            </div>

            <WarrantyList onEdit={handleEdit} />
          </div>
        </div>
      </main>

      {/* 腳本與資訊 */}
      <footer className="border-t border-slate-200 bg-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
                <span className="font-black text-slate-900">工程保固管理系統</span>
              </div>
              <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
                為工程與採購專案設計的保固追蹤工具。支援民國日期、保證金狀態追蹤與即時報修監控。
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-12 sm:gap-24">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">系統資訊</h4>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-blue-600 rounded-full"></span>
                    Firebase Firestore 支援
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-blue-600 rounded-full"></span>
                    React 18 + Tailwind
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-blue-600 rounded-full"></span>
                    動畫交乘 React Motion
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">開發工具</h4>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li>
                    <a href="https://ai.studio" className="hover:text-blue-600 transition-colors flex items-center gap-1">
                      Google AI Studio <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-blue-600 transition-colors flex items-center gap-1">
                      專案原始碼 <Github className="w-3 h-3" />
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="border-t border-slate-100 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-400">
            <p>© 2024 工程保固管理系統. Powered by Google AI Studio.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-slate-600">隱私權政策</a>
              <a href="#" className="hover:text-slate-600">服務條款</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
