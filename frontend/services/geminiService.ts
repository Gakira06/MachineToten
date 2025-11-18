import type { Order, CartItem, Product } from "../types";

// Pega a URL do backend das variáveis de ambiente (ou usa localhost como padrão)
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const API_URL = `${BASE_URL}/api/ai`;

/**
 * Gera uma sugestão de compra personalizada baseada no histórico e carrinho.
 */
export const getMenuSuggestion = async (
  userHistory: Order[],
  cartItems: CartItem[],
  menu: Product[],
  userName?: string
): Promise<string> => {
  const clientReference = userName ? `${userName}` : "cliente";

  // Prepara os dados para o prompt
  const popularProducts = menu
    .filter((p) => p.popular)
    .map((p) => `${p.name} (R$${p.price.toFixed(2)})`)
    .join(", ");

  const cartText =
    cartItems.length > 0
      ? cartItems.map((item) => `${item.quantity}x ${item.name}`).join(", ")
      : "vazio";

  const historyText =
    userHistory.length > 0
      ? `${userHistory.length} pedidos anteriores`
      : "cliente novo";

  // Monta o prompt para enviar ao backend
  const prompt = `
    Aja como um assistente de vendas amigável de uma pastelaria.
    Cliente: ${clientReference}.
    Perfil: ${historyText}.
    Carrinho atual: ${cartText}.
    Itens populares da loja: ${popularProducts}.
    
    Tarefa: Crie uma sugestão de venda curta, entusiástica e personalizada (máximo 1 frase).
    Se o carrinho estiver vazio, sugira um item popular. Se já tiver algo, sugira um acompanhamento (bebida ou sobremesa).
  `;

  try {
    const response = await fetch(`${API_URL}/suggestion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) throw new Error("Erro na requisição");

    const data = await response.json();
    return (
      data.text || "Experimente nossos deliciosos pastéis com caldo de cana!"
    );
  } catch (error) {
    console.error("Erro ao obter sugestão:", error);
    return "Que tal um pastel quentinho hoje?";
  }
};

/**
 * Gera sugestões dinâmicas ("Que tal levar também...?") baseadas no que já está no carrinho.
 */
export const getDynamicCartSuggestion = async (
  cartItems: CartItem[],
  menu: Product[],
  userName?: string
): Promise<string> => {
  if (cartItems.length === 0) return "";

  const clientReference = userName ? `${userName}` : "você";
  const cartNames = cartItems.map((item) => item.name).join(", ");

  // Estratégia simples de categorias faltantes
  const categoriesInCart = new Set(cartItems.map((i) => i.category));
  let focusCategory = "";
  if (!categoriesInCart.has("Bebida")) focusCategory = "uma bebida gelada";
  else if (!categoriesInCart.has("Doce")) focusCategory = "uma sobremesa doce";
  else focusCategory = "mais um sabor de pastel";

  const prompt = `
    O cliente ${clientReference} tem no carrinho: ${cartNames}.
    Falta comprar: ${focusCategory}.
    Gere uma frase curta e tentadora sugerindo adicionar isso ao pedido (máximo 15 palavras).
  `;

  try {
    const response = await fetch(`${API_URL}/suggestion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();
    return data.text || "";
  } catch (error) {
    return "";
  }
};

/**
 * Gera uma mensagem de boas-vindas ou agradecimento "do Chef".
 */
export const getChefMessage = async (
  userHistory: Order[],
  userName?: string,
  menu?: Product[]
): Promise<string> => {
  const clientReference = userName ? `${userName}` : "amigo";

  const prompt = `
    Aja como o Chef da pastelaria. Escreva uma mensagem curta e acolhedora (1 frase) para o cliente ${clientReference}.
    Se ele for novo, dê boas-vindas. Se for recorrente, diga que é bom vê-lo novamente.
    Use um tom caseiro e simpático.
  `;

  try {
    const response = await fetch(`${API_URL}/suggestion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();
    return (
      data.text ||
      `Olá ${clientReference}, o Chef preparou tudo com carinho para você!`
    );
  } catch (error) {
    return `Olá ${clientReference}, seja bem-vindo à nossa pastelaria!`;
  }
};

/**
 * Inicia a sessão de chat (neste modelo stateless, é apenas para log/placeholder).
 */
export const startChat = () => {
  console.log("Sessão de chat inicializada (gerenciada pelo backend).");
};

/**
 * Envia mensagem do usuário para o Chatbot e retorna a resposta.
 */
export const sendMessageToChatbot = async (
  message: string
): Promise<string> => {
  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) throw new Error("Erro no chat");

    const data = await response.json();
    return data.text || "Desculpe, não entendi. Pode repetir?";
  } catch (error) {
    console.error("Erro no chatbot:", error);
    return "Estou com dificuldade de conexão no momento. Tente novamente mais tarde.";
  }
};
