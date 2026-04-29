# Event QR Sharing Backend Starter

This is a minimal backend contract for production QR sharing. The frontend expects these endpoints when Cloud sync is enabled:

- `PUT /presets` with `{ deviceId, presets }`
- `GET /presets?deviceId=...` returning `{ presets }`
- `POST /prints` with `{ deviceId, imageDataUrl, createdAt }` returning `{ url }`

For production, replace the in-memory store with Supabase Storage, Firebase Storage, S3, or your own database/object storage. Do not keep base64 prints only in memory.

## Example implementation idea

```ts
import express from 'express';

const app = express();
app.use(express.json({ limit: '25mb' }));

const presetsByDevice = new Map<string, unknown[]>();
const prints = new Map<string, string>();

app.put('/presets', (req, res) => {
  presetsByDevice.set(req.body.deviceId, req.body.presets ?? []);
  res.json({ ok: true });
});

app.get('/presets', (req, res) => {
  res.json({ presets: presetsByDevice.get(String(req.query.deviceId)) ?? [] });
});

app.post('/prints', (req, res) => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  prints.set(id, req.body.imageDataUrl);
  res.json({ url: `${req.protocol}://${req.get('host')}/prints/${id}` });
});

app.get('/prints/:id', (req, res) => {
  const image = prints.get(req.params.id);
  if (!image) return res.sendStatus(404);
  res.type('html').send(`<img src="${image}" style="max-width:100%;height:auto" />`);
});

app.listen(process.env.PORT || 3000);
```
