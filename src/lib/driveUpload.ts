const DEFAULT_GOOGLE_SCRIPT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycby7A7v4fv7SECH6mRWdmpS4ThyJ6bocM2jfY1N78aQdKJNaWHr_c15rNElIRXnkQNjl/exec';

export interface DriveUploadOptions {
  projectName?: string;
  vendorCompany?: string;
  issueName?: string;
  maxDimension?: number;
  quality?: number;
}

export const compressImageToDataUrl = (
  file: File,
  maxDimension = 1200,
  quality = 0.7
): Promise<string> => {
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

        if (width > height && width > maxDimension) {
          height *= maxDimension / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width *= maxDimension / height;
          height = maxDimension;
        }

        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

export function normalizeDriveUrl(rawUrl: string): string {
  if (rawUrl.includes('drive.google.com')) {
    const idMatch = rawUrl.match(/[-\w]{25,}/);
    if (idMatch && idMatch[0]) {
      return `https://drive.google.com/uc?export=view&id=${idMatch[0]}`;
    }
  }
  return rawUrl;
}

export async function uploadImageToDrive(
  file: File,
  options: DriveUploadOptions = {}
): Promise<string> {
  const {
    projectName = '未分類專案',
    vendorCompany = '未指定廠商',
    issueName = '未命名工單',
    maxDimension = 1200,
    quality = 0.7,
  } = options;

  const base64DataUrl = await compressImageToDataUrl(file, maxDimension, quality);
  const scriptUrlOption =
    import.meta.env.VITE_GOOGLE_SCRIPT_WEBHOOK_URL || DEFAULT_GOOGLE_SCRIPT_WEBHOOK_URL;

  let resultUrl = '';
  let uploadSuccess = false;

  // 優先使用後端 Proxy API，因為後端 Proxy 不受瀏覽器 CORS 限制影響
  try {
    const response = await fetch('/api/drive/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64: base64DataUrl,
        fileName: file.name,
        mimeType: 'image/jpeg',
        projectName,
        vendorCompany,
        issueName,
        scriptUrl: scriptUrlOption,
      }),
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
    console.warn('Backend proxy upload failed/unconfigured, attempting frontend direct upload:', backendError);

    try {
      const response = await fetch(scriptUrlOption, {
        method: 'POST',
        // 必須只用 text/plain (不可加上 charset=utf-8) 否則會觸發 OPTIONS 預檢導致 CORS 失敗
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          base64: base64DataUrl,
          fileName: file.name,
          mimeType: 'image/jpeg',
          projectName,
          vendorCompany,
          issueName,
        }),
      });

      const resultText = await response.text();
      let result: any;
      try {
        result = JSON.parse(resultText);
      } catch {
        throw new Error('Google Apps Script Webhook 回傳格式異常 (請確認部署狀態為「我(Me)」且「所有人」)');
      }

      if (result.success && result.url) {
        resultUrl = result.url;
        uploadSuccess = true;
      } else {
        throw new Error(result.error || backendError.message || '上傳失敗');
      }
    } catch (fallbackError: any) {
      console.error('Fallback upload also failed:', fallbackError);
      throw new Error(
        `上傳失敗！如果您已部署至外部伺服器 (如 Render/GitHub)，請務必於環境變數中設定正確的 GOOGLE_SCRIPT_WEBHOOK_URL。(後端錯誤：${backendError.message})`
      );
    }
  }

  if (uploadSuccess && resultUrl) {
    return normalizeDriveUrl(resultUrl);
  }

  throw new Error('上傳失敗：無法取得雲端圖片連結');
}
