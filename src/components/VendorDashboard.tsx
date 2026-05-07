import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, serverTimestamp, getDoc, or } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ShieldCheck, CheckCircle2, AlertCircle, Clock, Construction } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

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
  involvedVendors?: string[];
}

const statusColors = {
  '未處理': 'bg-red-100 text-red-700 border-red-200',
  '維修中': 'bg-amber-100 text-amber-700 border-amber-200',
  '待料中': 'bg-purple-100 text-purple-700 border-purple-200',
  '已完成': 'bg-green-100 text-green-700 border-green-200',
};

interface VendorDashboardProps {
  vendorName: string;
}

export default function VendorDashboard({ vendorName }: VendorDashboardProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
  const [projectVendors, setProjectVendors] = useState<Record<string, string[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hasJointProjects, setHasJointProjects] = useState(false);
  const [activeTab, setActiveTab] = useState<'all'|'未處理'|'維修中'|'待料中'|'已完成'>('未處理');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  
  // Edit form state
  const [status, setStatus] = useState<Issue['status']>('未處理');
  const [vendorReply, setVendorReply] = useState('');
  const [estRepairTime, setEstRepairTime] = useState('');
  const [involveOtherVendors, setInvolveOtherVendors] = useState<string[]>([]);
  const [assignedVendor, setAssignedVendor] = useState<string>(''); // For re-assigning joint vendors
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Fetch warranties to map IDs to project names and detect joint projects
    getDocs(collection(db, 'warranties')).then(snap => {
      const pMap: Record<string, string> = {};
      const projToVendors: Record<string, Set<string>> = {};
      const pVendorsMap: Record<string, string[]> = {};
      
      snap.forEach(d => {
        const data = d.data();
        pMap[d.id] = data.projectName;
        
        if (data.vendor) {
          const vendors = data.vendor.split(/[,、;]+/).map((v: string) => v.trim()).filter(Boolean);
          pVendorsMap[d.id] = vendors;
          if (!projToVendors[data.projectName]) {
            projToVendors[data.projectName] = new Set();
          }
          vendors.forEach((v: string) => projToVendors[data.projectName].add(v));
        }
      });
      setProjectsMap(pMap);
      setProjectVendors(pVendorsMap);
      
      // Determine if this vendor is involved in ANY joint project (a project with > 1 vendor)
      let joint = false;
      Object.keys(projToVendors).forEach(pName => {
        if (projToVendors[pName].has(vendorName) && projToVendors[pName].size > 1) {
          joint = true;
        }
      });
      setHasJointProjects(joint);
      
    }).catch(e => {
      console.error(e);
    });

    const q = query(
      collection(db, 'issues'), 
      or(
        where('vendorCompany', '==', vendorName),
        where('involvedVendors', 'array-contains', vendorName)
      )
    );
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
  }, [vendorName]);

  const handleEdit = (issue: Issue) => {
    if (editingId === issue.id) {
      setEditingId(null);
    } else {
      setEditingId(issue.id);
      setStatus(issue.status);
      setVendorReply(issue.vendorReply || '');
      setEstRepairTime(issue.estRepairTime || '');
      // Ensure involvedVendors array exists, default to empty
      const existingInvolved = issue.involvedVendors || [];
      // Don't include current vendor in the add-list
      setInvolveOtherVendors(existingInvolved.filter((v: string) => v !== vendorName));
    }
  };

  const notifyVendorOfUpdate = async (issue: Issue) => {
    try {
      const docRef = doc(db, 'vendorSettings', vendorName);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;
      
      const lineUserId = docSnap.data().lineUserId;
      if (!lineUserId) return;

      const projectName = projectsMap[issue.warrantyId] || '未知專案';
      const messageText = `✅ 【工單狀態更新】\n專案：${projectName}\n項目：${issue.issueName}\n\n狀態已更新為：${status}\n回覆內容：${vendorReply || '無'}\n預計完成時間：${estRepairTime || '無'}`;

      fetch('/api/line/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: lineUserId,
          messages: [{ type: 'text', text: messageText }]
        })
      });
    } catch (err) {
      console.error("Auto notify error", err);
    }
  };

  const handleUpdate = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const issueToUpdate = issues.find(i => i.id === id);
      
      const newInvolvedVendors = Array.from(new Set([
        vendorName, 
        ...(issueToUpdate?.vendorCompany ? [issueToUpdate.vendorCompany] : []), 
        ...involveOtherVendors
      ]));

      await updateDoc(doc(db, 'issues', id), {
        status,
        vendorReply,
        estRepairTime,
        involvedVendors: newInvolvedVendors,
        hasUnreadReply: true,
        updatedAt: serverTimestamp()
      });
      
      const updatedIssue = issues.find(i => i.id === id);
      if (updatedIssue) {
        setTimeout(() => notifyVendorOfUpdate(updatedIssue), 500);
      }

      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues`);
    } finally {
      setUpdating(false);
    }
  };

  const filteredIssues = issues.filter(i => {
    if (activeTab !== 'all' && i.status !== activeTab) return false;
    if (selectedProjectId !== 'all' && i.warrantyId !== selectedProjectId) return false;
    return true;
  });

  const getWaitingDays = (date: any) => {
    if (!date) return 0;
    const ms = date.toMillis?.() || 0;
    if (!ms) return 0;
    return Math.ceil((Date.now() - ms) / (1000 * 60 * 60 * 24));
  };

  const vendorProjectIds = Array.from(new Set(issues.map(i => i.warrantyId)));

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none mb-1">廠商維修管理</h1>
            <p className="text-sm font-bold text-slate-500">{vendorName}</p>
          </div>
        </div>

        {hasJointProjects && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4 text-amber-800 shadow-sm mb-6">
            <Construction className="w-6 h-6 flex-shrink-0 mt-0.5 text-amber-600" />
            <div className="text-sm">
              <p className="font-bold mb-1 text-base text-amber-900">共同承攬專案注意事項</p>
              <p className="leading-relaxed">本工程採共同承攬方式辦理，現行工單分配係本院依設備歸屬預作之分類。如承攬廠商認屬工單內容涉及用電、用水或其他介面整合問題，應由共同承攬成員自行協調解決或會同至現場釐清。鑑於施工期間之分工細節屬廠商內部約定事項，本院不予干預，廠商不得因內部爭議影響履約進度。</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl overflow-x-auto flex-1">
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

          <div className="w-full md:w-64 relative">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full h-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-slate-500/5 focus:border-slate-500 transition-all shadow-sm appearance-none text-lg text-slate-800 font-black"
            >
              <option value="all">所有工程案</option>
              {vendorProjectIds.map(id => (
                <option key={id} value={id}>{projectsMap[id] || '讀取中...'}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        {issues.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 mb-1">總工單數</p>
              <p className="text-2xl font-black text-slate-800">{issues.length}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 shadow-sm">
              <p className="text-xs font-bold text-red-600 mb-1">未處理</p>
              <p className="text-2xl font-black text-red-700">{issues.filter(i => i.status === '未處理').length}</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 shadow-sm">
              <p className="text-xs font-bold text-amber-600 mb-1">維修 / 待料中</p>
              <p className="text-2xl font-black text-amber-700">{issues.filter(i => i.status === '維修中' || i.status === '待料中').length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-2xl border border-green-100 shadow-sm">
              <p className="text-xs font-bold text-green-600 mb-1">已完成</p>
              <p className="text-2xl font-black text-green-700">{issues.filter(i => i.status === '已完成').length}</p>
            </div>
          </div>
        )}

        {filteredIssues.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-200 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">目前無待處理的工單</h2>
            <p className="text-slate-500 text-sm">所有符合條件的維修單皆已處理完畢或尚未產生。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredIssues.map(issue => {
              const isEditing = editingId === issue.id;
              const projName = projectsMap[issue.warrantyId] || '讀取中...';
              const waitDays = getWaitingDays(issue.createdAt);
              
              return (
                <div key={issue.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={cn("px-2 py-0.5 text-xs font-bold rounded border", statusColors[issue.status])}>
                          {issue.status}
                        </span>
                        <span className="text-base md:text-lg font-black text-blue-800 bg-blue-100 px-3 py-1 rounded shadow-sm border border-blue-200">
                          {projName}
                        </span>
                        {issue.status !== '已完成' && waitDays > 0 && (
                          <span className="text-xs font-bold text-red-500">
                            待機 {waitDays} 天
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-xl text-slate-800 mb-2 mt-3">{issue.issueName}</h3>
                      <p className="text-sm text-slate-500 mt-1 mb-3 flex items-center gap-1.5">
                        <Clock className="w-4 h-4" /> 登載日期：{issue.createdAt?.toDate?.().toLocaleDateString('zh-TW')}
                      </p>
                      
                      {!isEditing && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-slate-50 p-4 rounded-xl">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 mb-1 tracking-wide">預計維修時間</p>
                            <p className="text-slate-700 font-medium">{issue.estRepairTime || <span className="text-slate-400 italic">未填寫</span>}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 mb-1 tracking-wide">詳細回覆說明</p>
                            <p className="text-slate-700 font-medium break-words whitespace-pre-wrap">{issue.vendorReply || <span className="text-slate-400 italic">尚未回覆</span>}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {!isEditing && issue.status !== '已完成' && (
                      <button
                        onClick={() => handleEdit(issue)}
                        className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all shadow-md mt-2 sm:mt-0"
                      >
                        更新進度
                      </button>
                    )}
                  </div>

                  {isEditing && (
                    <motion.form 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-6 pt-6 border-t border-slate-100"
                      onSubmit={(e) => handleUpdate(issue.id, e)}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">處理狀態</label>
                          <select
                            value={status}
                            onChange={e => setStatus(e.target.value as any)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800 shadow-sm"
                          >
                            <option value="未處理">未處理</option>
                            <option value="維修中">維修中</option>
                            <option value="待料中">待料中</option>
                            <option value="已完成">已完成</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700">預計維修日期</label>
                          <input
                            type="date"
                            value={estRepairTime}
                            onChange={e => setEstRepairTime(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800 shadow-sm"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-bold text-slate-700">詳細回覆說明</label>
                          <textarea
                            value={vendorReply}
                            onChange={e => setVendorReply(e.target.value)}
                            placeholder={hasJointProjects && (projectVendors[issue.warrantyId]?.length || 0) > 1 ? "請描述處理進度。若屬其他廠商責任介面，請務必在此詳細說明原因..." : "請描述預計處理方式、原因或進度..."}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[100px] resize-y font-medium text-slate-800 shadow-sm"
                            required
                          />
                        </div>
                        
                        {(projectVendors[issue.warrantyId]?.length || 0) > 1 && (
                          <div className="space-y-2 md:col-span-2 p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                            <label className="text-sm font-bold text-amber-900 block mb-2">
                              共同承攬：會同其他廠商 (選填)
                            </label>
                            <div className="flex gap-2 flex-wrap">
                              {projectVendors[issue.warrantyId].filter(v => v !== vendorName).map((v, i) => {
                                const isSelected = involveOtherVendors.includes(v);
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                      setInvolveOtherVendors(prev => 
                                        isSelected ? prev.filter(x => x !== v) : [...prev, v]
                                      );
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                      isSelected 
                                        ? 'bg-amber-600 border-amber-600 text-white' 
                                        : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-100'
                                    }`}
                                  >
                                    {isSelected ? '✓ ' : '+ '}{v}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-amber-700 mt-1.5 opacity-80">
                              若勾選其他廠商，他們將能在其管理介面中看到此工單，請務必於上方「詳細回覆說明」中註明需會勘或處理之介面。
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3 justify-end bg-slate-50 -mx-5 -mb-5 p-4 mt-6 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-xl transition-all"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          disabled={updating}
                          className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                        >
                          {updating ? '儲存中...' : '送出回覆'}
                        </button>
                      </div>
                    </motion.form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
