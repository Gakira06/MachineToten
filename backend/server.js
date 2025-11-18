import express from "express";
import fs from "fs/promises";
import path from "path";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 3001;

// --- Configuração da IA (Google Gemini) ---
// A chave deve estar no arquivo .env do backend como GEMINI_API_KEY
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "⚠️ AVISO: A variável GEMINI_API_KEY não foi definida. As funcionalidades de IA não funcionarão."
  );
}

// --- Caminhos dos Arquivos de Dados ---
const usersFile = path.join(process.cwd(), "data", "users.json");
const ordersFile = path.join(process.cwd(), "data", "orders.json"); // Pedidos ativos (cozinha)
const userOrdersFile = path.join(process.cwd(), "data", "user_orders.json"); // Histórico completo

// --- Middlewares ---
app.use(
  cors({
    origin: "*", // Em produção, recomenda-se restringir para o domínio do seu frontend
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
  })
);
app.use(express.json());

// Log de requisições para debug
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- Funções Auxiliares para Arquivos JSON ---
async function readJson(file) {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    // Se o arquivo não existir ou der erro, retorna array vazio
    return [];
  }
}

async function writeJson(file, data) {
  try {
    await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Erro ao escrever no arquivo ${file}:`, err);
    throw err;
  }
}

// --- Rota Raiz (Health Check) ---
app.get("/", (req, res) => {
  res.send(
    "<h2>Pastelaria Backend Online 🚀</h2><p>Use os endpoints /api/...</p>"
  );
});

// ==========================================
// ROTAS DE USUÁRIOS
// ==========================================

app.get("/api/users", async (req, res) => {
  const users = await readJson(usersFile);
  res.json(users);
});

app.post("/api/users", async (req, res) => {
  const payload = req.body;
  if (!payload || !payload.cpf) {
    return res.status(400).json({ error: "CPF é obrigatório" });
  }

  const users = await readJson(usersFile);
  const cpfLimpo = String(payload.cpf).replace(/\D/g, "");

  // Verifica duplicidade
  const exists = users.find(
    (u) => String(u.cpf).replace(/\D/g, "") === cpfLimpo
  );
  if (exists) {
    return res.status(409).json({ error: "CPF já cadastrado" });
  }

  const newUser = {
    id: payload.id || `user_${Date.now()}`,
    name: payload.name || "Sem Nome",
    email: payload.email || "",
    cpf: cpfLimpo,
    historico: [],
    pontos: 0,
  };

  users.push(newUser);

  try {
    await writeJson(usersFile, users);
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: "Erro ao salvar usuário" });
  }
});

// ==========================================
// ROTAS DE PEDIDOS (COZINHA & HISTÓRICO)
// ==========================================

// GET Pedidos Ativos (para a tela da Cozinha)
app.get("/api/orders", async (req, res) => {
  const orders = await readJson(ordersFile);
  res.json(orders);
});

// GET Histórico de Pedidos (Opcional: filtrar por userId)
app.get("/api/user-orders", async (req, res) => {
  const all = await readJson(userOrdersFile);
  const { userId } = req.query;
  if (userId) {
    return res.json(all.filter((o) => o.userId === userId));
  }
  res.json(all);
});

// POST Novo Pedido
app.post("/api/orders", async (req, res) => {
  const payload = req.body;
  if (!payload || !payload.userId || !Array.isArray(payload.items)) {
    return res
      .status(400)
      .json({ error: "Dados inválidos: userId e items são obrigatórios." });
  }

  try {
    const orders = await readJson(ordersFile);
    const userOrders = await readJson(userOrdersFile);
    const users = await readJson(usersFile);

    const id = `order_${Date.now()}`;
    const total =
      typeof payload.total === "number"
        ? payload.total
        : payload.items.reduce((acc, it) => acc + it.price * it.quantity, 0);

    const newOrder = {
      id,
      userId: payload.userId,
      userName: payload.userName || "",
      items: payload.items,
      total,
      timestamp: new Date().toISOString(),
      status: "active",
    };

    // 1. Adiciona na lista de pedidos ativos (Cozinha)
    orders.push(newOrder);

    // 2. Adiciona no histórico geral de pedidos
    userOrders.push(newOrder);

    // 3. Atualiza o histórico dentro do objeto do usuário
    const userIdx = users.findIndex((u) => u.id === newOrder.userId);
    if (userIdx >= 0) {
      users[userIdx].historico = users[userIdx].historico || [];
      users[userIdx].historico.push({ ...newOrder });
    }

    // Salva todos os arquivos
    await Promise.all([
      writeJson(ordersFile, orders),
      writeJson(userOrdersFile, userOrders),
      writeJson(usersFile, users),
    ]);

    res.status(201).json(newOrder);
  } catch (err) {
    console.error("Erro ao processar pedido:", err);
    res.status(500).json({ error: "Falha ao salvar pedido" });
  }
});

// DELETE Finalizar Pedido (Remove da cozinha, marca como completo no histórico)
app.delete("/api/orders/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const orders = await readJson(ordersFile);
    const userOrders = await readJson(userOrdersFile);

    // Remove dos ativos
    const novosPedidosAtivos = orders.filter((o) => o.id !== id);

    // Atualiza status no histórico
    let pedidoEncontrado = false;
    const novoHistorico = userOrders.map((o) => {
      if (o.id === id) {
        pedidoEncontrado = true;
        return {
          ...o,
          status: "completed",
          completedAt: new Date().toISOString(),
        };
      }
      return o;
    });

    if (!pedidoEncontrado && orders.length === novosPedidosAtivos.length) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    await Promise.all([
      writeJson(ordersFile, novosPedidosAtivos),
      writeJson(userOrdersFile, novoHistorico),
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao finalizar pedido:", err);
    res.status(500).json({ error: "Falha ao finalizar pedido" });
  }
});

// ==========================================
// ROTAS DE INTELIGÊNCIA ARTIFICIAL (GEMINI)
// ==========================================

// Sugestão de Cardápio e Upsell
app.post("/api/ai/suggestion", async (req, res) => {
  if (!genAI) {
    return res
      .status(503)
      .json({ error: "Serviço de IA indisponível (Chave não configurada)" });
  }

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt é obrigatório" });

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    res.json({ text });
  } catch (error) {
    console.error("Erro na API Gemini (Sugestão):", error);
    res.status(500).json({ error: "Erro ao gerar sugestão" });
  }
});

// Chatbot
app.post("/api/ai/chat", async (req, res) => {
  if (!genAI) {
    return res.status(503).json({ error: "Serviço de IA indisponível" });
  }

  const { message } = req.body;
  if (!message)
    return res.status(400).json({ error: "Mensagem é obrigatória" });

  try {
    // Configura o modelo com uma instrução de sistema clara
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `Você é um assistente virtual da 'Pastelaria Kiosk Pro'. 
      Seu tom é amigável, prestativo e brasileiro.
      Responda dúvidas sobre o cardápio (Pastéis, Bebidas, Doces), horários (9h às 22h) e ajude a escolher.
      Não invente preços que não conhece.
      Seja conciso nas respostas.`,
    });

    const result = await model.generateContent(message);
    const response = result.response;
    const text = response.text();

    res.json({ text });
  } catch (error) {
    console.error("Erro na API Gemini (Chat):", error);
    res.status(500).json({ error: "Erro ao processar mensagem" });
  }
});

// --- Inicialização ---
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`📂 Arquivos de dados em: ${path.join(process.cwd(), "data")}`);
});
