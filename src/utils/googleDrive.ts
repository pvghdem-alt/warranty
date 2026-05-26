import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';

const provider = new GoogleAuthProvider();
// We request drive.file scope so we can create, read, and delete files that this specific app creates.
provider.addScope('https://www.googleapis.com/auth/drive.file');

// In-memory token cache (Do NOT persist in localStorage/sessionStorage as per guidelines)
let cachedAccessToken: string | null = null;

export const setGoogleAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Triggers Google Sign-In with popup to get an OAuth access token for Google Drive
 */
export const signInWithGoogleDrive = async (): Promise<string> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('無法從 Google 登入中取得 access_token');
    }
    cachedAccessToken = credential.accessToken;
    return cachedAccessToken;
  } catch (err: any) {
    console.error('Failed to sign in and authorize Google Drive:', err);
    throw err;
  }
};

/**
 * Finds or creates a Google Drive folder by name and optional parentId.
 */
export const getOrCreateFolder = async (
  folderName: string,
  accessToken: string,
  parentId?: string
): Promise<string> => {
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(/'/g, "\\'")}' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  } else {
    query += ` and 'root' in parents`;
  }

  try {
    const listResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (listResponse.ok) {
      const listData = await listResponse.json();
      if (listData.files && listData.files.length > 0) {
        return listData.files[0].id;
      }
    }
  } catch (err) {
    console.error('Error finding folder on Google Drive:', err);
  }

  // Create folder
  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const createResponse = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Google Drive 建立資料夾失敗: ${errorText}`);
  }

  const createData = await createResponse.json();
  return createData.id;
};

/**
 * Uploads a file (Blob) to Google Drive in multipart/related format,
 * then grants public reader access to the uploaded file and returns a high-res thumbnail URL.
 */
export const uploadToGoogleDrive = async (
  blob: Blob,
  fileName: string,
  accessToken: string,
  parentFolderId?: string
): Promise<string> => {
  const boundary = '314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const close_delim = `\r\n--${boundary}--`;

  const metadata: any = {
    name: fileName,
    mimeType: blob.type || 'image/jpeg',
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaHeader = `${delimiter}Content-Type: ${blob.type || 'image/jpeg'}\r\n\r\n`;
  const mediaFooter = close_delim;

  // Combine metadata and binary file payload using Blob constructor to avoid string corruption
  const multipartBlob = new Blob(
    [metadataPart, mediaHeader, blob, mediaFooter],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: multipartBlob,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive 上傳 API 回傳錯誤: ${errorText}`);
  }

  const fileData = await response.json();
  const fileId = fileData.id;

  if (!fileId) {
    throw new Error('上傳成功，但未取得 Google Drive 檔案 ID');
  }

  // Make the file readable by anyone with the link so the app can display it
  try {
    const permResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      }
    );

    if (!permResponse.ok) {
      console.warn('Could not make Google Drive file public:', await permResponse.text());
    }
  } catch (permErr) {
    console.error('Failed to update Google Drive file permission:', permErr);
  }

  // Return a direct web-viewable high-res thumbnail URL (cached & fast)
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
};

/**
 * Deletes a file from Google Drive using its viewer/thumbnail URL
 */
export const deleteFromGoogleDrive = async (fileUrl: string, accessToken: string): Promise<boolean> => {
  try {
    // Extract fileId from URL (e.g., id=XXXX)
    const urlObj = new URL(fileUrl);
    const fileId = urlObj.searchParams.get('id');
    if (!fileId) {
      console.warn('Could not extract Google Drive file ID from URL:', fileUrl);
      return false;
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.ok || response.status === 404) {
      return true;
    } else {
      console.error(`Failed to delete file ${fileId} from Google Drive:`, await response.text());
      return false;
    }
  } catch (err) {
    console.error('Failed to parse or delete Google Drive file:', err);
    return false;
  }
};

