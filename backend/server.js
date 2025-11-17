import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;
const usersFile = path.join(process.cwd(), 'data', 'users.json');
const ordersFile = path.join(process.cwd(), 'data', 'orders.json'); // pedidos ativos (cozinha)
const userOrdersFile = path.join(process.cwd(), 'data', 'user_orders.json'); // histórico por usuário

// Simple CORS and json parsing
app.use(express.json());
app.use((req, res, next) => {
  // log incoming requests (method and url) to help debugging
  console.log(new Date().toISOString(), req.method, req.url);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

async function readJson(file) {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

async function writeJson(file, data, label = 'data') {
  try {
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(file, content, 'utf-8');
    console.log(`[writeJson] Wrote ${label} -> ${file} (${content.length} bytes)`);
  } catch (err) {
    console.error(`[writeJson] FAILED writing ${label} to ${file}:`, err.message || err);
    throw err;
  }
}

const readUsers = () => readJson(usersFile);
const writeUsers = (users) => writeJson(usersFile, users, 'users');
const readOrders = () => readJson(ordersFile);
const writeOrders = (orders) => writeJson(ordersFile, orders, 'orders');
const readUserOrders = () => readJson(userOrdersFile);
const writeUserOrders = (orders) => writeJson(userOrdersFile, orders, 'userOrders');

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

// ---------------- Pedidos -----------------

// GET pedidos ativos (cozinha)
app.get('/api/orders', async (req, res) => {
  const orders = await readOrders();
  res.json(orders);
});

// GET histórico de pedidos (opcional filtro ?userId=)
app.get('/api/user-orders', async (req, res) => {
  const all = await readUserOrders();
  const { userId } = req.query;
  if (userId) {
    return res.json(all.filter(o => o.userId === userId));
  }
  res.json(all);
});

// POST criar novo pedido
app.post('/api/orders', async (req, res) => {
  const payload = req.body;
  if (!payload || !payload.userId || !Array.isArray(payload.items)) {
    return res.status(400).json({ error: 'Corpo inválido: userId e items são obrigatórios.' });
  }
  try {
    const orders = await readOrders();
    const userOrders = await readUserOrders();
    const users = await readUsers();

    const id = `order_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const total = typeof payload.total === 'number'
      ? payload.total
      : payload.items.reduce((acc, it) => acc + (it.price * it.quantity), 0);
    const order = {
      id,
      userId: payload.userId,
      userName: payload.userName || '',
      items: payload.items.map(it => ({
        productId: it.productId,
        name: it.name,
        quantity: it.quantity,
        price: it.price,
      })),
      total,
      timestamp,
      status: 'active'
    };

    orders.push(order); // adiciona aos pedidos ativos
    userOrders.push(order); // adiciona ao histórico (mantém status 'active' inicialmente)

    // Atualiza historico do usuário em users.json (se existir)
    const userIdx = users.findIndex(u => u.id === order.userId);
    if (userIdx >= 0) {
      users[userIdx].historico = users[userIdx].historico || [];
      users[userIdx].historico.push({ ...order });
    }

    await writeOrders(orders);
    await writeUserOrders(userOrders);
    await writeUsers(users);

    res.status(201).json(order);
  } catch (err) {
    console.error('Erro ao salvar pedido', err);
    res.status(500).json({ error: 'Falha ao salvar pedido' });
  }
});

// DELETE finalizar pedido (remove de pedidos ativos, mantém no histórico e marca como completed nele)
app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const orders = await readOrders();
    const userOrders = await readUserOrders();
    const existing = orders.find(o => o.id === id);
    if (!existing) return res.status(404).json({ error: 'Pedido não encontrado' });

    const remaining = orders.filter(o => o.id !== id);
    // Marca como completed no histórico (se existir)
    userOrders.forEach(o => {
      if (o.id === id) {
        o.status = 'completed';
        o.completedAt = new Date().toISOString(); // campo adicional não tipado, mas útil
      }
    });

    await writeOrders(remaining);
    await writeUserOrders(userOrders);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao finalizar pedido', err);
    res.status(500).json({ error: 'Falha ao finalizar pedido' });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Users API running on http://localhost:${PORT}`);
});
