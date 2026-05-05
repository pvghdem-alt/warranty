import { GoogleGenAI, Type } from "@google/genai";

const getApiKey = () => {
  return localStorage.getItem('GEMINI_API_KEY') || process.env.GEMINI_API_KEY || '';
};

export interface ExtractedWarranty {
  projectName: string;
  vendor: string;
  expiryDate: string; // ISO string or ROC format
  deposit: number;
  warrantyScope: string;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    projectName: {
      type: Type.STRING,
      description: "工程或採購案名稱",
    },
    vendor: {
      type: Type.STRING,
      description: "承包廠商名稱",
    },
    expiryDate: {
      type: Type.STRING,
      description: "保固到期日期，格式為 YYYY-MM-DD",
    },
    deposit: {
      type: Type.NUMBER,
      description: "保固金金額",
    },
    warrantyScope: {
      type: Type.STRING,
      description: "保固範圍詳細說明（例如：結構保固5年，設備保固1年等）",
    },
  },
  required: ["projectName", "vendor", "expiryDate", "deposit", "warrantyScope"],
};

async function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analyzeWarrantyDocuments(files: File[]): Promise<ExtractedWarranty> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('請先設定 Gemini API 金鑰才能使用 AI 功能。');
  }
  const ai = new GoogleGenAI({ apiKey });
  const fileParts = await Promise.all(files.map(fileToGenerativePart));

  const prompt = `
    你是一個專業的工程管理助理。請分析上傳的所有文件（包含保固金、驗收記錄、結算證明書等），並提取出保固案件的關鍵資訊。
    
    特別注意：
    1. 如果只有驗收日期，通常保固期是從驗收合格日開始起算（例如：驗收日 113/05/20，保固一年，則到期日為 114/05/19）。
    2. 民國日期請轉換為西元（例如 113年 = 2024年）。
    3. 保固範圍請儘可能詳細地從需求說明書或契約條款中提取。
    
    請以 JSON 格式回傳結果。
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [...fileParts, { text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
  });

  return JSON.parse(response.text) as ExtractedWarranty;
}
