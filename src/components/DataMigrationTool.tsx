import React, { useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Database, AlertTriangle, CheckCircle, RefreshCcw, Loader2 } from 'lucide-react';
import { Issue } from '../types';

export default function DataMigrationTool() {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState({ total: 0, current: 0 });

  const addLog = (msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 50));
  };

  const executeMigration = async () => {
    setLoading(true);
    setLog([]);
    addLog('開始掃描需要遷移的 Base64 圖片 (這可能會消耗一些讀取配額)...');

    try {
      // 1. Fetch all issues
      const snapshot = await getDocs(collection(db, 'issues'));
      const issuesToUpdate: { id: string, photoUrls: string[] }[] = [];

      addLog(`成功讀取工單，共 ${snapshot.docs.length} 筆資料。開始檢查圖片。`);

      snapshot.forEach(doc => {
        const data = doc.data() as Issue;
        if (data.photoUrls && Array.isArray(data.photoUrls)) {
          const hasBase64 = data.photoUrls.some(url => url.startsWith('data:image'));
          if (hasBase64) {
             issuesToUpdate.push({ id: doc.id, photoUrls: data.photoUrls });
          }
        }
      });

      if (issuesToUpdate.length === 0) {
        addLog('檢查完畢：沒有發現需要遷移的 Base64 圖片。');
        setLoading(false);
        return;
      }

      addLog(`發現 ${issuesToUpdate.length} 筆工單包含 Base64 圖片，準備依序拋轉至 Google Apps Script...`);
      setProgress({ total: issuesToUpdate.length, current: 0 });

      const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycby7A7v4fv7SECH6mRWdmpS4ThyJ6bocM2jfY1N78aQdKJNaWHr_c15rNElIRXnkQNjl/exec';

      let count = 0;
      for (const issue of issuesToUpdate) {
        const newUrls: string[] = [];
        let hasChanges = false;
        
        for (let i = 0; i < issue.photoUrls.length; i++) {
          const url = issue.photoUrls[i];
          if (url.startsWith('data:image')) {
            addLog(`正在上傳工單 ${issue.id} 的第 ${i+1} 張圖片...`);
            
              let resultUrl = '';
              let uploadSuccess = false;

              // 優先使用後端 Proxy API 的上傳端點，不受瀏覽器 CORS 限制
              try {
                const response = await fetch('/api/drive/upload', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    base64: url,
                    fileName: `migration_${issue.id}_${i}.png`,
                    mimeType: 'image/jpeg',
                    projectName: '歷史工單遷移',
                    vendorCompany: '複查與歷史資料',
                    issueName: `工單圖片遷移 (專案 ID ${issue.id})`,
                    scriptUrl: scriptUrl
                  })
                });

                if (response.ok) {
                  const data = await response.json();
                  if (data && data.url) {
                    resultUrl = data.url;
                    uploadSuccess = true;
                  } else if (data && data.error) {
                    throw new Error(data.error);
                  }
                } else {
                  const errData = await response.json().catch(() => ({}));
                  throw new Error(errData.error || `Server responded with status ${response.status}`);
                }
              } catch (backendError: any) {
                console.warn("Migration backend proxy failed/unconfigured, attempting frontend direct upload:", backendError);
                
                const response = await fetch(scriptUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'text/plain' },
                  body: JSON.stringify({
                    base64: url,
                    fileName: `migration_${issue.id}_${i}.png`,
                    mimeType: 'image/jpeg' 
                  })
                });

                const resultText = await response.text();
                const result = JSON.parse(resultText);

                if (result.success && result.url) {
                  resultUrl = result.url;
                  uploadSuccess = true;
                } else {
                  throw new Error(result.error || backendError.message || '上傳失敗');
                }
              }

              if (uploadSuccess && resultUrl) {
                // 將 Google Drive 分享連結轉換為圖片直連連結 (直接顯示用)
                let directUrl = resultUrl;
                if (directUrl.includes('drive.google.com')) {
                  const idMatch = directUrl.match(/[-\w]{25,}/);
                  if (idMatch && idMatch[0]) {
                    directUrl = `https://drive.google.com/uc?export=view&id=${idMatch[0]}`;
                  }
                }
                newUrls.push(directUrl);
                hasChanges = true;
                addLog(`✓ 成功上傳：轉換為 ${directUrl.substring(0, 30)}...`);
              } else {
                addLog(`× 上傳失敗，保留原始 Base64`);
                newUrls.push(url); // keep original if failed
              }

          } else {
            // Already a proper URL
            newUrls.push(url);
          }
        }

        if (hasChanges) {
           await updateDoc(doc(db, 'issues', issue.id), { photoUrls: newUrls });
           addLog(`✓✓ 成功更新工單資料 (ID: ${issue.id})`);
        }
        
        count++;
        setProgress({ total: issuesToUpdate.length, current: count });
      }

      addLog('🎉 所有資料遷移操作已完成！請重新整理網頁。');

    } catch (e: any) {
      if (e.message && e.message.includes('Quota')) {
        addLog(`❌ 嚴重錯誤：配額已被用盡 (Quota Exceeded)。請等候明日配額重置或升級 Firebase 帳號方案。`);
      } else {
        addLog(`❌ 發生未知錯誤：${e.message || e}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-8">
      <div className="p-6 border-b border-slate-100 bg-amber-50">
        <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-amber-600" />
          舊有 Base64 圖片雲端化遷移工具 (釋放資料庫讀取量)
        </h3>
        <p className="text-sm text-amber-800 mt-2">
          過去系統將圖片直接以 Base64 文字儲存於資料庫中，極度佔用與浪費 Firebase 的每日免費讀取額度。這會導致出現 <strong>Quota limit exceeded</strong> 的連線阻斷。您可以透過下方按鈕，交由系統自動掃描所有舊工單，並將 Base64 轉存至 Google Drive。
        </p>
        <div className="mt-4 p-3 bg-white border border-amber-200 rounded-lg text-xs text-amber-700 flex gap-2 items-start">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <strong>注意：</strong>
            <ul className="list-disc pl-4 mt-1 space-y-1">
              <li>此動作一旦執行，將自動不可逆地替換您的資料庫文字。</li>
              <li>如果您當天已經被 Firebase 停權 (Quota Exceeded)，連掃描都無法讀取，請【等到隔日下午太平洋時間凌晨 (台灣時間約下午 3:00)】次日配額重置後，再來點擊執行。</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="p-6 bg-slate-50">
        <button
          onClick={executeMigration}
          disabled={loading}
          className="px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
          {loading ? '正在掃描與遷移中...' : '開始掃描並執行遷移工作'}
        </button>

        {loading && progress.total > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
              <span>執行進度</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-amber-500 h-2 rounded-full transition-all" 
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {log.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-bold text-slate-700 mb-2">執行日誌 (Log)</p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-64 overflow-y-auto font-mono text-xs text-green-400 space-y-1">
              {log.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
