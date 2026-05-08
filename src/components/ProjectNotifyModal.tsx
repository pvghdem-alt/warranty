import React, { useState, useMemo } from 'react';
import { X, MessageCircle, AlertTriangle, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Issue } from './WarrantyList';

interface ProjectNotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  warrantyId: string;
  issues: Issue[];
}

export default function ProjectNotifyModal({
  isOpen,
  onClose,
  projectName,
  warrantyId,
  issues
}: ProjectNotifyModalProps) {
  if (!isOpen) return null;

  // Group unfinished issues by vendor
  const groupedIssues = useMemo(() => {
    const unfinished = issues.filter(i => i.status !== '已完成');
    const groups: Record<string, typeof unfinished> = {};
    unfinished.forEach(issue => {
      const vendor = issue.vendorCompany || '未知廠商';
      if (!groups[vendor]) groups[vendor] = [];
      groups[vendor].push(issue);
    });
    return Object.entries(groups).map(([vendor, vendorIssues]) => ({
      vendor,
      issues: vendorIssues
    }));
  }, [issues]);

  const handleManualSend = (vendor: string, vendorIssues: any[]) => {
    const today = new Date();
    const listStr = vendorIssues.map((issue, idx) => {
       const d = issue.createdAt ? (typeof issue.createdAt.toDate === 'function' ? issue.createdAt.toDate() : new Date(issue.createdAt)) : today;
       const days = Math.floor((today.getTime() - d.getTime()) / (1000 * 3600 * 24));
       return `${idx+1}. 【${issue.issueName}】 - 狀態: ${issue.status} (已積欠 ${days} 天)`;
    }).join('\n');

    let currentOrigin = window.location.origin;
    if (currentOrigin.includes('-dev-')) {
      currentOrigin = currentOrigin.replace('-dev-', '-pre-');
    }
    const baseUrl = currentOrigin + window.location.pathname;
    const vendorDashboardLink = `${baseUrl}?vendor=${vendor}&project=${warrantyId}`;
    
    let msg = `🚨 【催修通知】\n工程專案：${projectName}\n廠商：${vendor}\n\n`;
    msg += `⚠️ 目前您共有 ${vendorIssues.length} 張工單尚未處理或未完成：\n${listStr}\n\n`;
    msg += `請盡快安排處理！\n\n`;
    msg += `請點擊下方專屬連結查看並更新所有工單狀態（施工完成可上傳照片）：\n${vendorDashboardLink}`;

    navigator.clipboard.writeText(msg);
    alert('通知訊息已複製！\n開啟 LINE 手動貼上傳送給廠商。');
    window.open('https://chat.line.biz/', '_blank');
  };

  const handleConsolidatedSend = () => {
    let msg = `🚨 【催修通知 - 共同承攬彙整】\n工程專案：${projectName}\n\n`;

    let currentOrigin = window.location.origin;
    if (currentOrigin.includes('-dev-')) {
      currentOrigin = currentOrigin.replace('-dev-', '-pre-');
    }
    const baseUrl = currentOrigin + window.location.pathname;

    groupedIssues.forEach(group => {
      const today = new Date();
      const listStr = group.issues.map((issue: any, idx) => {
         const d = issue.createdAt ? (typeof issue.createdAt.toDate === 'function' ? issue.createdAt.toDate() : new Date(issue.createdAt)) : today;
         const days = Math.floor((today.getTime() - d.getTime()) / (1000 * 3600 * 24));
         return `  ${idx+1}. 【${issue.issueName}】 (已積欠 ${days} 天)`;
      }).join('\n');
      
      const vendorDashboardLink = `${baseUrl}?vendor=${group.vendor}&project=${warrantyId}`;
      
      msg += `📌 廠商：${group.vendor}\n`;
      msg += `   目前共 ${group.issues.length} 張工單尚未完成：\n${listStr}\n`;
      msg += `   專屬連結：${vendorDashboardLink}\n\n`;
    });

    msg += `請各廠商盡快安排處理！點擊專屬連結可查看並更新工單狀態（施工完成可上傳照片）。`;

    navigator.clipboard.writeText(msg);
    alert('彙整通知訊息已複製！\n開啟 LINE 手動貼上傳送到共同群組。');
    window.open('https://chat.line.biz/', '_blank');
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-orange-50 rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">各廠商待處理通知清單</h2>
              <p className="text-sm font-medium text-slate-500 mt-0.5">{projectName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {groupedIssues.length > 0 && (
              <button
                onClick={handleConsolidatedSend}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                title="複製包含所有廠商的通知訊息"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">複製彙整通知 (群組用)</span>
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-orange-200/50 rounded-full transition-colors text-slate-500">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {groupedIssues.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-700">太棒了！</h3>
              <p className="text-slate-500 mt-1">目前該專案沒有任何積欠或未完成的工單。</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedIssues.map((group, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        {group.vendor}
                        <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-bold">
                          {group.issues.length} 筆未完成
                        </span>
                      </h3>
                    </div>
                    <button
                      onClick={() => handleManualSend(group.vendor, group.issues)}
                      className="w-full sm:w-auto bg-[#06C755] hover:bg-[#05b34c] text-white px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors focus:ring-4 focus:ring-green-500/20"
                    >
                      <MessageCircle className="w-4 h-4" />
                      複製訊息並開啟 LINE
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {group.issues.map((issue: any, iIdx) => {
                      const today = new Date();
                      const d = issue.createdAt ? (typeof issue.createdAt.toDate === 'function' ? issue.createdAt.toDate() : new Date(issue.createdAt)) : today;
                      const days = Math.floor((today.getTime() - d.getTime()) / (1000 * 3600 * 24));
                      
                      return (
                        <div key={iIdx} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-slate-50 transition-colors">
                          <div className="flex-1">
                            <p className="font-bold text-slate-700 text-sm">{issue.issueName}</p>
                            <p className="text-xs text-slate-500 mt-1">建立日期: {d.toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded-md text-slate-600">
                              狀態: {issue.status}
                            </span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${days > 7 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                              積欠 {days} 天
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
