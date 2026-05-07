import React, { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { UploadCloud, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface ImageUploadProps {
  photoUrls: string[];
  onChange: (urls: string[]) => void;
  maxPhotos?: number;
}

export default function ImageUpload({ photoUrls, onChange, maxPhotos = 3 }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

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
        
        // Compress image
        const options = {
          maxSizeMB: 1, // Max 1MB
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);
        
        // Generate a standard filename
        const filename = `issues/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
        const storageRef = ref(storage, filename);
        
        // Upload
        await uploadBytes(storageRef, compressedFile);
        const url = await getDownloadURL(storageRef);
        newUrls.push(url);
      }
      onChange(newUrls);
    } catch (err: any) {
      console.error("Upload error:", err);
      // Fallback: if storage fails due to permissions, we could fallback, but let's just show an error.
      setError('照片上傳失敗，請確認儲存空間權限或網路連線。');
    } finally {
      setUploading(false);
      // Reset input
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const removePhoto = (index: number) => {
    const newUrls = [...photoUrls];
    newUrls.splice(index, 1);
    onChange(newUrls);
  };

  return (
    <div className="space-y-3">
      {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
      
      {photoUrls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photoUrls.map((url, i) => (
            <div key={i} className="relative group aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
              <img src={url} alt={`Photo ${i+1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-red-500 hover:text-white rounded-full text-slate-700 transition-colors shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {photoUrls.length < maxPhotos && (
        <div>
          <label className={cn(
            "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-colors cursor-pointer",
            uploading ? "bg-slate-50 border-slate-300 opacity-70 pointer-events-none" : "bg-white border-slate-300 hover:border-blue-500 hover:bg-blue-50"
          )}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {uploading ? (
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
              ) : (
                <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
              )}
              <p className="text-sm font-bold text-slate-600">
                {uploading ? "上傳壓縮中..." : "點擊上傳照片"}
              </p>
              <p className="text-xs text-slate-500 mt-1">支援自動壓縮 (最多 {maxPhotos} 張)</p>
            </div>
            <input type="file" className="hidden" accept="image/*" multiple onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      )}
    </div>
  );
}
