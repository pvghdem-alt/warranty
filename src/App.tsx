import React, { useState, useEffect } from 'react';
import { ShieldCheck, LayoutDashboard, Plus, Lock, Github, ExternalLink, Sparkles, Key, Bell } from 'lucide-react';
import WarrantyForm from './components/WarrantyForm';
import WarrantyList from './components/WarrantyList';
import AllIssuesList from './components/AllIssuesList';
import AIImportModal from './components/AIImportModal';
import ApiKeyModal from './components/ApiKeyModal';
import VendorReplyPage from './components/VendorReplyPage';
import { Warranty } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './lib/firebase';

export default function App() {
  const [editingWarranty, setEditingWarranty] = useState<Warranty | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [activeView, setActiveView] = useState<'warranties' | 'issues'>('warranties');
  const [unreadIssuesCount, setUnreadIssuesCount] = useState(0);

  const params = new URLSearchParams(window.location.search);
  const isVendorPage = params.has('issueId');
  const vendorIssueId = params.get('issueId');

  useEffect(() => {
    if (isVendorPage) return; // Vendor page doesn't need unread notification badge
    const q = query(collection(db, 'issues'), where('hasUnreadReply', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadIssuesCount(snapshot.docs.length);
    });
    return () => unsubscribe();
  }, [isVendorPage]);

  if (isVendorPage && vendorIssueId) {
    return <VendorReplyPage issueId={vendorIssueId} />;
  }

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
        {showApiKeyModal && (
          <ApiKeyModal onClose={() => setShowApiKeyModal(false)} />
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
              <div className="hidden sm:block">
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">工程保固系統</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Warranty Management v2.0</p>
              </div>

              {/* View Switcher */}
              <div className="ml-2 sm:ml-6 flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveView('warranties')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    activeView === 'warranties' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  專案清單
                </button>
                <button
                  onClick={() => setActiveView('issues')}
                  className={`relative px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                    activeView === 'issues' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  工單管理
                  {unreadIssuesCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-slate-100">
                      {unreadIssuesCount > 99 ? '99+' : unreadIssuesCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden lg:flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-slate-500 text-xs font-bold">
                <Lock className="w-3 h-3" /> 免登入版
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowApiKeyModal(true)}
                className="bg-white border border-slate-200 text-slate-500 p-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:border-slate-300"
                title="設定 API 金鑰"
              >
                <Key className="w-4 h-4" />
              </motion.button>
              
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
                  {activeView === 'warranties' ? '工程保固清單' : '全局維修工單'}
                </h2>
                <p className="text-slate-400 text-sm">
                  {activeView === 'warranties' 
                    ? '追蹤所有保固案件、維修進度與保證金狀態' 
                    : '管理並追蹤所有專案的維修與待料進度'}
                </p>
              </div>
            </div>

            {activeView === 'warranties' ? (
              <WarrantyList onEdit={handleEdit} />
            ) : (
              <AllIssuesList />
            )}
          </div>
        </div>
      </main>

    </div>
  );
}
