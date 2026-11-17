export interface ExtractedWarranty {
  projectName: string;
  vendor: string;
  expiryDate: string; // ISO string or ROC format
  deposit: number;
  warrantyScope: string;
}

async function fileToBase64Payload(
  file: File
): Promise<{ data: string; mimeType: string; name: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.includes(',') ? result.split(',')[1] : result;
      resolve({
        data: base64Data,
        mimeType: file.type || 'application/octet-stream',
        name: file.name,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analyzeWarrantyDocuments(files: File[]): Promise<ExtractedWarranty> {
  const filePayloads = await Promise.all(files.map(fileToBase64Payload));

  const response = await fetch('/api/gemini/analyze-warranty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: filePayloads }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `分析失敗 (HTTP ${response.status})，請稍後再試。`);
  }

  return data as ExtractedWarranty;
}
