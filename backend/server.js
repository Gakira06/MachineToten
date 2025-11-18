import express from "express";
import fs from "fs/promises"; // Mantido para a função de SEED inicial
import path from "path";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import knex from "knex"; // NOVO: Construtor de consultas SQL
import "sqlite3"; // NOVO: Driver para SQLite

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

// --- CONFIGURAÇÃO E CONEXÃO COM O BANCO DE DADOS (Knex + SQLite) ---
const db = knex({
  client: 'sqlite3',
  connection: {
    // O arquivo do DB será criado em data/kiosk.sqlite
    filename: path.join(process.cwd(), "data", "kiosk.sqlite"), 
  },
  // Usamos useNullAsDefault para SQLite, Knex recomenda true
  useNullAsDefault: true, 
});

// Função para inicializar as tabelas e carregar dados iniciais (SEED)
async function initDatabase() {
    console.log("⏳ Verificando e inicializando tabelas do banco de dados...");
    
    // Tabela de Produtos (substitui menu.json)
    await db.schema.createTableIfNotExists('products', (table) => {
        table.string('id').primary();
        table.string('name').notNullable();
        table.text('description');
        table.decimal('price', 8, 2).notNullable(); // Precisão para preço
        table.string('category').notNullable();
        table.string('videoUrl');
        table.boolean('popular').defaultTo(false);
    });

    // Tabela de Usuários (substitui users.json)
    await db.schema.createTableIfNotExists('users', (table) => {
        table.string('id').primary();
        table.string('name').notNullable();
        table.string('email').unique();
        table.string('cpf').unique();
        // O histórico será salvo como uma string JSON no DB
        table.json('historico').defaultTo('[]'); 
        table.integer('pontos').defaultTo(0);
    });

    // Tabela de Pedidos (substitui orders.json e user_orders.json)
    await db.schema.createTableIfNotExists('orders', (table) => {
        table.string('id').primary();
        table.string('userId').references('id').inTable('users').onDelete('SET NULL');
        table.string('userName');
        table.decimal('total', 8, 2).notNullable();
        table.string('timestamp').notNullable();
        table.string('status').defaultTo('active');
        // A lista de itens do pedido é salva como uma string JSON
        table.json('items').notNullable(); 
        table.timestamp('completedAt');
    });

    // Lógica para carregar dados iniciais do menu.json se a tabela estiver vazia
    const productCount = await db('products').count('id as count').first();
    if (productCount && productCount.count === 0) {
        console.log("🛠️ Carregando dados iniciais do menu.json...");
        const menuDataPath = path.join(process.cwd(), "data", "menu.json");
        try {
             const rawData = await fs.readFile(menuDataPath, "utf-8");
             const MENU_DATA = JSON.parse(rawData);
             await db('products').insert(MENU_DATA);
             console.log("✅ Dados do menu carregados.");
        } catch (e) {
             console.error("⚠️ Não foi possível carregar dados do menu.json para o DB. Ignorando seed.", e.message);
        }
    }
}

// Executa a inicialização do DB antes de continuar
try {
    await initDatabase();
} catch (err) {
    console.error("❌ ERRO FATAL ao inicializar o banco de dados:", err);
    process.exit(1);
}

// --- Middlewares ---
app.use(
  cors({
    origin: "*", 
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
  })
);
app.use(express.json());

// Log de requisições para debug
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- Rota Raiz (Health Check) ---
app.get("/", (req, res) => {
  res.send(
    "<h2>Pastelaria Backend Online 🚀</h2><p>Usando Knex/SQLite para dados.</p>"
  );
});

// ==========================================
// ROTAS DE PRODUTOS (CARDÁPIO)
// ==========================================
app.get("/api/menu", async (req, res) => {
    // Busca todos os produtos e ordena por ID (ou a ordem que você preferir)
    const products = await db('products').select('*').orderBy('id');
    res.json(products);
});

// ==========================================
// ROTAS DE USUÁRIOS
// ==========================================

app.get("/api/users", async (req, res) => {
  const users = await db('users').select('*');
  // Converte o histórico de JSON string de volta para array para o frontend
  const parsedUsers = users.map(u => ({ ...u, historico: JSON.parse(u.historico || '[]') }));
  res.json(parsedUsers);
});

app.post("/api/users", async (req, res) => {
  const payload = req.body;
  if (!payload || !payload.cpf) {
    return res.status(400).json({ error: "CPF é obrigatório" });
  }

  const cpfLimpo = String(payload.cpf).replace(/\D/g, "");

  // Verifica duplicidade no DB
  const exists = await db('users').where({ cpf: cpfLimpo }).first();
  if (exists) {
    return res.status(409).json({ error: "CPF já cadastrado" });
  }

  const newUser = {
    id: payload.id || `user_${Date.now()}`,
    name: payload.name || "Sem Nome",
    email: payload.email || "",
    cpf: cpfLimpo,
    historico: JSON.stringify([]), // Salva histórico como JSON string
    pontos: 0,
  };

  try {
    await db('users').insert(newUser);
    // Retorna o objeto com array vazio para o frontend
    res.status(201).json({ ...newUser, historico: [] }); 
  } catch (err) {
    console.error("Erro ao salvar usuário no DB:", err);
    res.status(500).json({ error: "Erro ao salvar usuário" });
  }
});

// ==========================================
// ROTAS DE PEDIDOS (COZINHA & HISTÓRICO)
// ==========================================

// GET Pedidos Ativos (para a tela da Cozinha)
app.get("/api/orders", async (req, res) => {
  const orders = await db('orders').where({ status: 'active' }).select('*').orderBy('timestamp', 'asc');
  
  // Converte a string JSON 'items' para objeto e o total para número
  const parsedOrders = orders.map(o => ({
      ...o,
      items: JSON.parse(o.items),
      total: parseFloat(o.total),
  }));
  res.json(parsedOrders);
});

// GET Histórico de Pedidos
app.get("/api/user-orders", async (req, res) => {
  const { userId } = req.query;
  let query = db('orders').orderBy('timestamp', 'desc');

  if (userId) {
    query = query.where({ userId });
  }

  const allOrders = await query.select('*');

  // Converte a string JSON 'items' para objeto e o total para número
  const parsedOrders = allOrders.map(o => ({
    ...o,
    items: JSON.parse(o.items),
    total: parseFloat(o.total),
  }));
  res.json(parsedOrders);
});

// POST Novo Pedido
app.post("/api/orders", async (req, res) => {
  const payload = req.body;
  if (!payload || !payload.userId || !Array.isArray(payload.items)) {
    return res
      .status(400)
      .json({ error: "Dados inválidos: userId e items são obrigatórios." });
  }

  const id = `order_${Date.now()}`;
  const total =
      typeof payload.total === "number"
        ? payload.total
        : payload.items.reduce((acc, it) => acc + it.price * it.quantity, 0);

  const newOrder = {
    id,
    userId: payload.userId,
    userName: payload.userName || "",
    items: JSON.stringify(payload.items), // Salva como JSON string
    total,
    timestamp: new Date().toISOString(),
    status: "active",
  };

  try {
    // Transação para garantir que a inserção e atualização ocorram juntas
    await db.transaction(async (trx) => {
      // 1. Adiciona na tabela de pedidos
      await trx('orders').insert(newOrder);

      // 2. Atualiza o histórico dentro do objeto do usuário
      const user = await trx('users').where({ id: payload.userId }).first();
      if (user) {
        let historico = JSON.parse(user.historico || '[]');
        // Cria um objeto de pedido compatível com o histórico (items como array)
        historico.push({ ...newOrder, items: payload.items, total }); 
        await trx('users').where({ id: payload.userId }).update({ historico: JSON.stringify(historico) });
      }
    });

    // Retorna o objeto com items como array para o frontend
    res.status(201).json({ ...newOrder, items: payload.items, total });
  } catch (err) {
    console.error("Erro ao processar pedido no DB:", err);
    res.status(500).json({ error: "Falha ao salvar pedido" });
  }
});

// DELETE Finalizar Pedido (Marca como 'completed' no DB)
app.delete("/api/orders/:id", async (req, res) => {
  const { id } = req.params;
  const completedAt = new Date().toISOString();
  try {
    // Atualiza o status do pedido
    const updated = await db('orders').where({ id }).update({
      status: "completed",
      completedAt,
    });

    if (updated === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao finalizar pedido no DB:", err);
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
  console.log(`🗄️ Banco de dados SQLite em: ${path.join(process.cwd(), "data", "kiosk.sqlite")}`);
});