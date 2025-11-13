import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;
const usersFile = path.join(process.cwd(), 'data', 'users.json');

// Simple CORS and json parsing
app.use(express.json());
app.use((req, res, next) => {
  // log incoming requests (method and url) to help debugging
  console.log(new Date().toISOString(), req.method, req.url);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

async function readUsers() {
  try {
    const raw = await fs.readFile(usersFile, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    // If file doesn't exist or invalid, return empty array
    return [];
  }
}

async function writeUsers(users) {
  console.log(`[writeUsers] Writing ${users.length} users to ${usersFile}`);
  try {
    const content = JSON.stringify(users, null, 2);
    console.log(`[writeUsers] Serialized to JSON: ${content.length} bytes`);
    await fs.writeFile(usersFile, content, 'utf-8');
    console.log(`[writeUsers] File written successfully`);
  } catch (err) {
    console.error(`[writeUsers] FAILED:`, err.message || err);
    throw err;
  }
}

app.get('/api/users', async (req, res) => {
  const users = await readUsers();
  res.json(users);
});

// Helpful root route so visiting the API port in the browser doesn't show 'Cannot GET /'
app.get('/', (req, res) => {
  res.send('<h2>Users API</h2><p>Use <code>/api/users</code> to GET or POST users.</p>');
});

app.post('/api/users', async (req, res) => {
  console.log(`[POST /api/users] Received payload:`, req.body);
  const payload = req.body;
  if (!payload || !payload.cpf) {
    console.log(`[POST /api/users] Missing cpf`);
    return res.status(400).json({ error: 'Missing cpf in body' });
  }

  console.log(`[POST /api/users] Reading existing users...`);
  const users = await readUsers();
  console.log(`[POST /api/users] Found ${users.length} existing users`);
  const cpf = String(payload.cpf).replace(/\D/g, '');

  // Prevent duplicate cpf
  const exists = users.find(u => String(u.cpf).replace(/\D/g, '') === cpf);
  if (exists) {
    console.log(`[POST /api/users] CPF ${cpf} already exists`);
    return res.status(409).json({ error: 'CPF already registered' });
  }

  console.log(`[POST /api/users] Creating new user...`);
  const newUser = {
    id: payload.id || `user_${Date.now()}`,
    name: payload.name || 'Sem Nome',
    email: payload.email || '',
    cpf: cpf,
    historico: payload.historico || [],
    pontos: payload.pontos || 0
  };
  console.log(`[POST /api/users] New user object:`, newUser);

  users.push(newUser);
  console.log(`[POST /api/users] Pushing to array, now ${users.length} users`);
  try {
    console.log(`[POST /api/users] Writing to file...`);
    await writeUsers(users);
    console.log(`[POST /api/users] Success! Returning 201`);
    res.status(201).json(newUser);
  } catch (err) {
    console.error(`[POST /api/users] CATCH block - write failed:`, err.message || err);
    console.error('Error writing users file', err && err.stack ? err.stack : err);
    // send detailed error message to help client debug (development only)
    const message = err && err.message ? err.message : 'Failed to save user';
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Users API running on http://localhost:${PORT}`);
});
