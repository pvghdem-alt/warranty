import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  let recentLineUsers: { userId: string; timestamp: number; message: string; displayName?: string }[] = [];

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
      const { to, messages, channelAccessToken } = req.body;
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
