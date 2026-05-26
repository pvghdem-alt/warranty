import React, { useState, useRef } from 'react';
import { UploadCloud, X, Loader2, HardDrive, CheckCircle2, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

interface ImageUploadProps {
  photoUrls: string[];
  onChange: (urls: string[]) => void;
  maxPhotos?: number;
  projectName?: string;
  vendorCompany?: string;
  issueName?: string;
}

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 1200;

        if (width > height && width > max) {
          height *= max / width;
          width = max;
        } else if (height > max) {
          width *= max / height;
          height = max;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // 70% quality JPEG
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

export const deletePhotoFromDrive = async (url: string): Promise<boolean> => {
  // In a webhook setup without auth, delete is usually restricted or complex.
  // For now, we only remove it from the list locally.
  return true; 
};

export default function ImageUpload({
  photoUrls,
  onChange,
  maxPhotos = 3,
  projectName,
  vendorCompany,
  issueName
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (photoUrls.length + files.length > maxPhotos) {
      setError(`最多只能上傳 ${maxPhotos} 張照片`);
      return;
    }

    setUploading(true);
    setError('');

    try {
      const newUrls = [...photoUrls];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Native Canvas compression (fast & reliable, avoids web worker hangs)
        const base64DataUrl = await compressImage(file);
        
        // Upload to our backend proxy which sends to Google Apps Script
        const response = await fetch('/api/drive/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64: base64DataUrl,
            fileName: file.name,
            mimeType: 'image/jpeg',
            projectName: projectName || '未分類專案',
            vendorCompany: vendorCompany || '未指定廠商',
            issueName: issueName || '未命名工單'
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Upload failed');
        }
        
        if (result.url) {
          let proxyUrl = result.url;
          // Check if it's a Google Drive URL
          if (proxyUrl.includes('drive.google.com')) {
            // Try to extract the file ID
            const idMatch = proxyUrl.match(/[-\w]{25,}/);
            if (idMatch && idMatch[0]) {
              proxyUrl = `${window.location.origin}/api/drive/proxy?id=${idMatch[0]}`;
            }
          }
          newUrls.push(proxyUrl);
        }
      }
      onChange(newUrls);
    } catch (err: any) {
      console.error("Upload error:", err);
      // Determine error type based on message
      if (err.message?.includes('Google Script Webhook URL is not configured')) {
        setError('系統缺少 Google Apps Script 設定！請向管理員確認 URL 是否已配置。');
      } else {
        setError(`上傳失敗：${err.message || '未知錯誤'}。請確認網路連線。`);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = async (index: number) => {
    if (window.confirm('確定要從此工單移除這張照片嗎？')) {
      const newUrls = [...photoUrls];
      newUrls.splice(index, 1);
      onChange(newUrls);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 animate-fade-in">
      {/* Pre-configured Storage Status Line */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-blue-600 animate-pulse" />
          <span className="text-xs font-bold text-slate-700">儲存位置：Google 雲端硬碟 (免登入、免授權)</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-[11px] font-extrabold border border-green-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> 等待 GAS 連線
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 flex items-start gap-2 text-xs font-semibold">
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}
      
      {photoUrls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photoUrls.map((url, i) => {
            let displayUrl = url;
            if (url.includes('drive.google.com') && !url.includes('/api/drive/proxy')) {
               const idMatch = url.match(/[-\w]{25,}/);
               if (idMatch && idMatch[0]) {
                 displayUrl = `/api/drive/proxy?id=${idMatch[0]}`;
               }
            }
            return (
              <div key={i} className="relative group aspect-square bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <img src={displayUrl} alt={`Photo ${i+1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-500 hover:text-white rounded-full text-slate-700 transition-colors shadow-md"
                  title="移除照片"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {photoUrls.length < maxPhotos && (
        <div>
          <label className={cn(
            "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-all cursor-pointer",
            uploading ? "bg-slate-50 border-slate-300 opacity-70 pointer-events-none" : "bg-white border-slate-300 hover:border-blue-500 hover:bg-blue-50 hover:shadow-sm"
          )}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
              {uploading ? (
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
              ) : (
                <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
              )}
              <p className="text-sm font-bold text-slate-600">
                {uploading ? "處理與上傳中..." : "點擊或拖曳上傳照片"}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-[90%] leading-normal">
                自動歸檔：工程保固清單 → {projectName || '保固案件'} → {vendorCompany || '施工廠商'} → {issueName || '維修工單'}
              </p>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept="image/*" 
              multiple 
              onChange={handleUpload} 
              disabled={uploading} 
            />
          </label>
        </div>
      )}
    </div>
  );
}
