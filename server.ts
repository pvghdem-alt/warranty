import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  // Increase payload limit to accept base64 image strings
  app.use(express.json({ limit: '10mb' }));

  // Initialize Firebase Client in Node.js server
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const firebaseApp = initializeApp(firebaseConfig);
  const db = firebaseConfig.firestoreDatabaseId
    ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(firebaseApp);

  let recentLineUsers: { userId: string; timestamp: number; message: string; displayName?: string }[] = [];

  // Google Drive Image Proxy to bypass CORS and 3rd-party cookie blocking
  app.get('/api/drive/proxy', async (req, res) => {
    try {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).send('Missing file ID');
      }

      const url = `https://drive.google.com/uc?export=view&id=${id}`;
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url);

      if (!response.ok) {
        return res.status(response.status).send('Failed to proxy image from Google Drive');
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.status(200).send(buffer);
    } catch(err) {
      console.error('Drive proxy error:', err);
      res.status(500).send('Internal Server Error');
    }
  });

  // Google Apps Script Proxy for Google Drive Anonymous Uploads
  app.post('/api/drive/upload', async (req, res) => {
    try {
      const { base64, mimeType, fileName, projectName, vendorCompany, issueName } = req.body;
      const scriptUrl = process.env.GOOGLE_SCRIPT_WEBHOOK_URL;
      
      if (!scriptUrl) {
        return res.status(400).json({ error: 'Google Script Webhook URL is not configured' });
      }
      
      const payload = {
        base64,
        mimeType,
        fileName,
        projectName,
        vendorCompany,
        issueName
      };

      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error('Non-JSON response from Webhook:', text.substring(0, 500));
        
        let errorMsg = 'Google Apps Script Webhook 錯誤：回傳格式非 JSON。';
        if (text.includes('Sign in') || text.includes('accounts.google.com')) {
          errorMsg += '原因：要求登入授權。請確認部署時「執行身分」設定為「我 (Me)」而非「存取網頁應用程式的使用者」。';
        } else {
          errorMsg += '可能是 Webhook 網址錯誤或程式碼崩潰。';
        }
        
        return res.status(502).json({ error: errorMsg, details: text.substring(0, 150) });
      }

      if (result.success) {
        res.json({ url: result.url });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (err: any) {
      console.error('Error proxying to Drive webhook:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // API Route for LINE Webhook
  app.post('/api/line/webhook', async (req, res) => {
    try {
      const events = req.body.events;
      if (events && events.length > 0) {
        for (const event of events) {
          if (event.type === 'message' || event.type === 'follow') {
            const userId = event.source.userId;
            let message = '';
            if (event.type === 'message' && event.message.type === 'text') {
              message = event.message.text;
            } else {
              message = event.type;
            }
            
            // Check if already exists to update or push new
            const existingIndex = recentLineUsers.findIndex(u => u.userId === userId);
            const newUserObj = { userId, timestamp: Date.now(), message, displayName: '未知' };
            
            if (existingIndex !== -1) {
              newUserObj.displayName = recentLineUsers[existingIndex].displayName || '未知';
              recentLineUsers.splice(existingIndex, 1);
            }
            
            recentLineUsers.unshift(newUserObj);
            recentLineUsers = recentLineUsers.slice(0, 30);
          }
        }
      }
      res.status(200).send('OK');
    } catch (e) {
      console.error(e);
      res.status(500).send('Error');
    }
  });

  app.get('/api/line/users', (req, res) => {
    res.json(recentLineUsers);
  });

  // API Route for LINE Push
  app.post('/api/line/push', async (req, res) => {
    try {
      const { to, messages } = req.body;
      const channelAccessToken = req.body.channelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN || 'TrqbY0JDZEkRhcdSyH9U00qn0P/ppc6ATGluE4h1QXG4+m73U3quIDZk1anYA+EOn7Nrbh8veUHLwGY0VP5mpGp4Py6MQdqhKsU5S89dpNqW64SL9mNi0HCGIGXIwPXT93IN2UK2NsUirL9h0bxOwQdB04t89/1O/w1cDnyilFU=';
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${channelAccessToken}`
        },
        body: JSON.stringify({ to, messages })
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
