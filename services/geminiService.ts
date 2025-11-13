// Importa a biblioteca do Google Generative AI e os tipos necessários
import { GoogleGenAI, Chat } from "@google/genai";
import type { Order, CartItem, Product } from "../types";

// Obtém a chave da API das variáveis de ambiente
const API_KEY = process.env.API_KEY;

// Inicializa o cliente da IA Gemini, se a chave estiver disponível
let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  // Aviso se a chave não estiver configurada
  console.warn(
    "API_KEY environment variable not set. Gemini API calls will fail."
  );
}

// Define os modelos a serem usados para sugestões e chat
const suggestionModel = "gemini-2.5-flash";
const chatModel = "gemini-2.5-flash";
// Armazena a instância do chat
let chat: Chat | null = null;

// Gera sugestões de produtos personalizadas baseado no histórico do cliente
export const getMenuSuggestion = async (
  userHistory: Order[], // Histórico de pedidos anteriores
  cartItems: CartItem[], // Itens atualmente no carrinho
  menu: Product[], // Cardápio disponível
  userName?: string // Nome do cliente (opcional)
): Promise<string> => {
  // Retorna mensagem padrão se a IA não estiver disponível
  if (!ai) return "Sugestões de IA indisponíveis no momento.";

  // Verifica se é um cliente novo (sem histórico de pedidos)
  const isNewCustomer = userHistory.length === 0;

  // Obtém produtos populares do cardápio
  const popularProducts = menu
    .filter((p) => p.popular)
    .map((p) => `${p.name} (R$${p.price.toFixed(2)})`);

  // Variáveis para construir o contexto da sugestão
  let historyText = "";
  let promptInstructions = "";
  let clientReference = userName ? `${userName}` : "cliente";

  // CASO 1: Cliente novo SEM itens no carrinho - faz boas-vindas
  if (isNewCustomer && cartItems.length === 0) {
    historyText = `Este é um cliente novo na pastelaria. Nome do cliente: ${clientReference}.`;
    promptInstructions = `
    Seja extremamente amigável e acolhedor!
    Faça uma boas-vindas calorosa usando o nome do cliente (${clientReference}) e sugira os produtos mais populares e bem avaliados da loja.
    Itens mais populares: ${popularProducts.join(", ")}.
    A sugestão deve ser entusiasmada, curta, personalizada com o nome e amigável.
    Exemplo: "Bem-vindo ${clientReference}! 🎉 Nossos clientes adoram o Pastel de Carne e a Coca-Cola gelada. Já experimentou?"`;
  }
  // CASO 2: Cliente novo COM itens no carrinho - sugere complementos
  else if (isNewCustomer && cartItems.length > 0) {
    historyText = `Este é um cliente novo na pastelaria. Nome do cliente: ${clientReference}. Itens selecionados no carrinho: ${cartItems
      .map((item) => `${item.quantity}x ${item.name}`)
      .join(", ")}.`;
    promptInstructions = `
    Você é um assistente de vendas amigável para um cliente novo na pastelaria.
    O cliente já adicionou alguns itens ao carrinho. Parabéns pela escolha!
    Agora sugira itens complementares ou alternativos baseado no que ele já escolheu.
    Use o nome do cliente (${clientReference}) para personalizar a sugestão.
    Seja entusiasmado, breve e amigável.
    Exemplo: "${clientReference}, ótima escolha! Para acompanhar, que tal uma Coca-Cola gelada?"`;
  }
  // CASO 3: Cliente antigo - faz sugestões baseadas no histórico
  else {
    historyText = `Cliente: ${clientReference}. Histórico de pedidos: ${userHistory
      .map((order) =>
        order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")
      )
      .join("; ")}.`;
    promptInstructions = `
    Você é um assistente de vendas amigável que conhece bem o cliente ${clientReference}.
    Seu objetivo é fazer uma sugestão de upsell inteligente com base no histórico de compras.
    Itens no carrinho atual: ${
      cartItems.length > 0
        ? cartItems.map((item) => `${item.quantity}x ${item.name}`).join(", ")
        : "carrinho vazio"
    }.
    Personalize a sugestão usando o nome do cliente e de acordo com os produtos que ele já comprou.
    Não sugira itens que já estão no carrinho.
    Exemplo: "${clientReference}, vimos que você gosta de pastéis. Que tal experimentar nosso Pastel de Nutella com Morango?"`;
  }

  // Formata informações do carrinho atual
  const cartText =
    cartItems.length > 0
      ? `Itens no carrinho atual: ${cartItems
          .map((item) => `${item.quantity}x ${item.name}`)
          .join(", ")}.`
      : "O carrinho está vazio.";

  // Formata informações do cardápio disponível
  const menuText = `Cardápio disponível: ${menu
    .map((p) => `${p.name} (R$${p.price.toFixed(2)})${p.popular ? " ⭐" : ""}`)
    .join(", ")}.`;

  // Monta o prompt completo para enviar à IA
  const prompt = `
    Você é um assistente de vendas amigável para uma pastelaria.
    
    ${historyText}
    ${cartText}
    ${menuText}

    ${promptInstructions}

    Gere uma sugestão para este cliente (máximo uma frase, curta e amigável):
  `;

  try {
    // Envia o prompt para a IA e obtém a resposta
    const response = await ai.models.generateContent({
      model: suggestionModel,
      contents: prompt,
    });
    // Extrai o texto da resposta (tenta diferentes caminhos possíveis)
    const text =
      response?.text ||
      response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";
    // Retorna a sugestão ou uma mensagem padrão se vazia
    return (
      text || "Bem-vindo à nossa pastelaria! Explore nossos deliciosos pastéis!"
    );
  } catch (error) {
    // Em caso de erro, registra no console e retorna mensagem padrão
    console.error("Error generating suggestion:", error);
    return "Bem-vindo à nossa pastelaria! Explore nossos deliciosos pastéis!";
  }
};

// Gera sugestões dinâmicas baseadas nas categorias de produtos no carrinho
export const getDynamicCartSuggestion = async (
  cartItems: CartItem[], // Itens no carrinho
  menu: Product[], // Cardápio disponível
  userName?: string // Nome do cliente (opcional)
): Promise<string> => {
  // Retorna vazio se IA indisponível ou carrinho vazio
  if (!ai) return "";
  if (cartItems.length === 0) return "";

  // Identifica categorias que o cliente já adicionou ao carrinho
  const cartCategories = new Set(cartItems.map((item) => item.category));
  // Identifica IDs dos produtos já no carrinho
  const cartProductIds = new Set(cartItems.map((item) => item.id));
  const clientReference = userName ? `${userName}` : "você";

  // Cria uma sugestão inicial baseada em categorias faltantes
  let suggestion = "";

  // Se não tem bebida no carrinho, sugere uma
  if (!cartCategories.has("Bebida")) {
    const drinks = menu.filter(
      (p) => p.category === "Bebida" && !cartProductIds.has(p.id)
    );
    if (drinks.length > 0) {
      suggestion = `Que tal acompanhar com uma bebida, ${clientReference}? ${drinks
        .map((d) => d.name)
        .join(" ou ")}?`;
    }
  }
  // Se não tem doce no carrinho, sugere um
  else if (!cartCategories.has("Doce")) {
    const desserts = menu.filter(
      (p) => p.category === "Doce" && !cartProductIds.has(p.id)
    );
    if (desserts.length > 0) {
      suggestion = `${clientReference}, que tal um doce para sobremesa? ${desserts
        .map((d) => d.name)
        .join(" ou ")}?`;
    }
  }
  // Se já tem bebida e doce, sugere itens populares adicionais
  else {
    const others = menu.filter((p) => !cartProductIds.has(p.id) && p.popular);
    if (others.length > 0) {
      suggestion = `${clientReference}, que tal adicionar mais? Nossos clientes também adoram ${others
        .map((p) => p.name)
        .join(" e ")}!`;
    }
  }

  // Se não conseguiu montar nenhuma sugestão, retorna vazio
  if (!suggestion) return "";

  try {
    // Monta prompt pedindo à IA para melhorar a sugestão inicial
    const prompt = `
      Você é um assistente de vendas amigável para uma pastelaria.
      
      Cliente: ${clientReference}
      Itens no carrinho: ${cartItems
        .map((item) => `${item.quantity}x ${item.name}`)
        .join(", ")}.
      
      Sugestão inicial: "${suggestion}"
      
      Melhore e reescreva essa sugestão para deixá-la mais atrativa, personalizada com o nome do cliente, curta (máximo uma frase) e amigável:
    `;

    // Envia o prompt para a IA
    const response = await ai.models.generateContent({
      model: suggestionModel,
      contents: prompt,
    });

    // Extrai o texto da resposta
    const text =
      response?.text ||
      response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";
    // Retorna a sugestão melhorada ou a original se vazia
    return text || suggestion;
  } catch (error) {
    // Em caso de erro, registra no console e retorna sugestão original
    console.error("Error generating dynamic suggestion:", error);
    return suggestion;
  }
};

// Gera uma mensagem especial do Chef separada das sugestões de compra.
export const getChefMessage = async (
  userHistory: Order[],
  userName?: string,
  menu?: Product[]
): Promise<string> => {
  if (!ai) return "Mensagem do Chef indisponível no momento.";

  const clientReference = userName ? `${userName}` : "amigo";
  const popularList = menu
    ? menu
        .filter((p) => p.popular)
        .slice(0, 3)
        .map((p) => p.name)
        .join(", ")
    : "";

  const historySummary =
    userHistory && userHistory.length > 0
      ? `O cliente já pediu anteriormente: ${userHistory
          .map((o) => o.items.map((i) => `${i.quantity}x ${i.name}`).join(", "))
          .join("; ")}.`
      : "";

  const prompt = `
    Você é o Chef da pastelaria, carismático e memorável. Crie UMA mensagem curta e calorosa (máximo duas frases) destinada ao cliente chamada '${clientReference}', que o faça se sentir especial e convidado a voltar. Evite linguagem genérica; personalize usando o nome quando disponível e, se fizer sentido, mencione algum item popular (${popularList}) ou um toque sobre o histórico: ${historySummary}
    Termine com um pequeno convite para voltar (ex: "Volte sempre, ${clientReference}!").
  `;

  try {
    const response = await ai.models.generateContent({
      model: suggestionModel,
      contents: prompt,
    });
    const text =
      response?.text ||
      response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";
    return (
      text ||
      `Olá ${clientReference}! O Chef recomenda experimentar nossos campeões — ${popularList}. Volte sempre!`
    );
  } catch (error) {
    console.error("Error generating chef message:", error);
    return `Olá ${clientReference}! O Chef recomenda experimentar nossos campeões — ${
      popularList || "alguns de nossos favoritos"
    }. Volte sempre!`;
  }
};

// Inicia uma nova sessão de chat com a IA
export const startChat = () => {
  if (!ai) {
    console.error("Cannot start chat without Gemini AI client.");
    return;
  }
  // Cria uma nova instância de chat com instruções específicas
  chat = ai.chats.create({
    model: chatModel,
    config: {
      // Define o comportamento do chatbot
      systemInstruction: `Você é um chatbot de atendimento ao cliente para a "Pastelaria Kiosk Pro". Seja amigável, prestativo e conciso. Responda perguntas sobre o cardápio, horários de funcionamento (9h às 22h) e ajude os clientes com dúvidas gerais. Não processe pedidos, apenas tire dúvidas. O cardápio inclui pastéis, bebidas e doces.`,
    },
  });
};

// Envia uma mensagem para o chatbot e retorna a resposta
export const sendMessageToChatbot = async (
  message: string // Mensagem do usuário
): Promise<string> => {
  // Retorna mensagem de indisponibilidade se IA não estiver pronta
  if (!ai) return "Chatbot indisponível.";

  // Se o chat não foi iniciado ainda, inicia agora
  if (!chat) {
    startChat();
    // Verifica novamente se conseguiu iniciar o chat
    if (!chat) return "Chatbot indisponível.";
  }

  try {
    // Envia a mensagem e obtém a resposta
    const response = await chat!.sendMessage({ message });
    // Extrai o texto da resposta (tenta diferentes caminhos possíveis)
    const text =
      response?.text ||
      response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";
    // Retorna a resposta ou mensagem padrão se vazia
    return (
      text || "Desculpe, não consegui processar sua mensagem. Tente novamente."
    );
  } catch (error) {
    // Em caso de erro, registra no console e retorna mensagem de erro
    console.error("Error sending message to chatbot:", error);
    return "Desculpe, estou com problemas para me conectar. Tente novamente mais tarde.";
  }
};
