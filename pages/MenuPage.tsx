import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import {
  getMenuSuggestion,
  getDynamicCartSuggestion,
  getChefMessage,
} from "../services/geminiService";
import type { Product, CartItem, Order } from "../types";
import MENU_DATA from "../data/menu.json";
// Dados de pedidos simulados
import ORDERS_DATA from "../data/orders.json";
import USERS_DATA from "../data/users.json";

// --- Componentes auxiliares definidos fora para evitar re-renderizações ---

// Interface para as propriedades do componente ProductCard
interface ProductCardProps {
  product: Product; // Produto a ser exibido
  onAddToCart: (product: Product) => void; // Função para adicionar o produto ao carrinho
}

// Componente que representa um cartão de produto
const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300 flex flex-col">
    <video
      className="w-full h-40 object-cover"
      autoPlay
      muted
      loop
      playsInline
      onClick={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLVideoElement).play().catch(() => {});
      }}
      onPause={(e) => {
        (e.currentTarget as HTMLVideoElement).play().catch(() => {});
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <source src={product.videoUrl} type="video/mp4" />
    </video>
    <div className="p-4 flex flex-col flex-grow">
      <h3 className="font-bold text-lg text-amber-800">{product.name}</h3>
      <p className="text-stone-600 text-sm mt-1 flex-grow">
        {product.description}
      </p>
      <div className="flex justify-between items-center mt-4">
        <span className="text-xl font-semibold text-stone-800">
          R${product.price.toFixed(2)}
        </span>
        <button
          onClick={() => onAddToCart(product)}
          className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors"
        >
          Adicionar
        </button>
      </div>
    </div>
  </div>
);

// Interface para as propriedades do componente CartSidebar
interface CartSidebarProps {
  cartItems: CartItem[]; // Itens no carrinho
  cartTotal: number; // Total do carrinho
  updateQuantity: (id: string, q: number) => void; // Função para atualizar a quantidade de um item
  onCheckout: () => void; // Função para finalizar o pedido
  isPlacingOrder: boolean; // Estado que indica se o pedido está sendo realizado
  cartSuggestion?: string; // Sugestão dinâmica para o carrinho
}

// Componente que representa a barra lateral do carrinho
const CartSidebar: React.FC<CartSidebarProps> = ({
  cartItems,
  cartTotal,
  updateQuantity,
  onCheckout,
  isPlacingOrder,
  cartSuggestion,
}) => (
  <div className="w-full lg:w-1/3 xl:w-1/4 bg-white p-6 rounded-2xl shadow-xl h-fit sticky top-24">
    <h2 className="text-2xl font-bold text-amber-800 border-b-2 border-amber-200 pb-2 mb-4">
      Seu Pedido
    </h2>
    {cartItems.length === 0 ? ( // Verifica se o carrinho está vazio
      <p className="text-stone-500">Seu carrinho está vazio.</p>
    ) : (
      <>
        {cartSuggestion && (
          <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-500 rounded text-sm text-amber-800 italic">
            💡 {cartSuggestion}
          </div>
        )}
        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
          {cartItems.map(
            (
              item // Mapeia os itens do carrinho
            ) => (
              <div key={item.id} className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-stone-500">
                    R${item.price.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateQuantity(item.id, parseInt(e.target.value))
                    } // Atualiza a quantidade do item
                    className="w-14 text-center border rounded"
                  />
                </div>
              </div>
            )
          )}
        </div>
        <div className="mt-6 pt-4 border-t-2 border-dashed border-amber-300">
          <div className="flex justify-between font-bold text-xl">
            <span>Total</span>
            <span>R${cartTotal.toFixed(2)}</span>
          </div>
          <button
            onClick={onCheckout} // Chama a função de finalizar pedido
            disabled={isPlacingOrder} // Desabilita o botão se o pedido estiver sendo realizado
            className="w-full mt-4 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-300 disabled:cursor-wait"
          >
            {isPlacingOrder ? "Enviando Pedido..." : "Finalizar Pedido"}
          </button>
        </div>
      </>
    )}
  </div>
);

// --- Componente Principal da Página do Menu ---

const MenuPage: React.FC = () => {
  const [menu, setMenu] = useState<Product[]>([]); // Estado para armazenar o menu
  // const [suggestion, setSuggestion] = useState<string>(""); // Estado para armazenar a sugestão do chef
  const [cartSuggestion, setCartSuggestion] = useState<string>(""); // Estado para armazenar a sugestão dinâmica do carrinho
  const [chefMessage, setChefMessage] = useState<string>(""); // Mensagem especial do Chef (independente)
  const [isChefLoading, setIsChefLoading] = useState<boolean>(false);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false); // Estado para indicar se a sugestão está sendo carregada
  const [isPlacingOrder, setIsPlacingOrder] = useState(false); // Estado para indicar se o pedido está sendo realizado
  const [orderConfirmationMessage, setOrderConfirmationMessage] = useState<
    string | null
  >(null); // Mensagem de confirmação do pedido

  const { currentUser, addOrderToHistory } = useAuth(); // Hook de autenticação
  const { cartItems, addToCart, clearCart, cartTotal, updateQuantity } =
    useCart(); // Hook do carrinho

  useEffect(() => {
    // Em um aplicativo real, isso seria uma chamada de API
    setMenu(MENU_DATA as Product[]); // Carrega os dados do menu
  }, []);

  useEffect(() => {
    const fetchSuggestion = async () => {
      if (currentUser) {
        setIsSuggestionLoading(true); // Inicia o carregamento da sugestão
        const newSuggestion = await getMenuSuggestion(
          currentUser.historico,
          cartItems,
          menu,
          currentUser.name
        ); // Obtém a sugestão do menu com o nome do cliente
        // setSuggestion(newSuggestion); // Atualiza a sugestão
        setIsSuggestionLoading(false); // Finaliza o carregamento
      }
    };
    if (menu.length > 0) {
      fetchSuggestion(); // Chama a função para buscar a sugestão se o menu estiver carregado
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, currentUser, menu]);

  // Busca a mensagem especial do Chef (independente da sugestão de compra)
  useEffect(() => {
    const fetchChefMessage = async () => {
      if (menu.length === 0) return;
      setIsChefLoading(true);
      try {
        const msg = await getChefMessage(
          currentUser ? currentUser.historico : [],
          currentUser?.name,
          menu
        );
        setChefMessage(msg);
      } catch (err) {
        console.error("Error fetching chef message:", err);
        setChefMessage("O Chef está preparando uma surpresa para você!");
      } finally {
        setIsChefLoading(false);
      }
    };
    fetchChefMessage();
    // Executa quando o menu ou usuário mudam; é independente do carrinho
  }, [menu, currentUser]);

  useEffect(() => {
    const fetchCartSuggestion = async () => {
      if (menu.length > 0 && cartItems.length > 0) {
        const dynamicSuggestion = await getDynamicCartSuggestion(
          cartItems,
          menu,
          currentUser?.name
        );
        setCartSuggestion(dynamicSuggestion);
      } else {
        setCartSuggestion("");
      }
    };
    fetchCartSuggestion();
  }, [cartItems, menu]);

  const handleCheckout = async () => {
    if (!currentUser || cartItems.length === 0) return; // Verifica se o usuário está autenticado e se há itens no carrinho
    setIsPlacingOrder(true); // Inicia o processo de finalização do pedido

    // --- Simulando a lógica do backend descrita no prompt ---
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Simula atraso de rede

    const newOrder: Order = {
      id: `order_${Date.now()}`, // Gera um ID único para o pedido
      userId: currentUser.id, // ID do usuário
      items: cartItems.map((item) => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })), // Mapeia os itens do carrinho
      total: cartTotal, // Total do pedido
      timestamp: new Date().toISOString(), // Data e hora do pedido
      status: "active", // Status do pedido
    };

    // Ação A (Fila): Adiciona ao pedidos.json
    console.log("Adding to active orders (pedidos.json):", newOrder);

    // Ação B (Histórico): Adiciona ao usuarios.json
    console.log("Adding to user history (usuarios.json):", newOrder);
    addOrderToHistory(newOrder); // Adiciona o pedido ao histórico do usuário

    setOrderConfirmationMessage("Pedido realizado com sucesso!"); // Mensagem de confirmação
    setTimeout(() => setOrderConfirmationMessage(null), 4000); // Remove a mensagem após 4 segundos

    clearCart(); // Limpa o carrinho
    setIsPlacingOrder(false); // Finaliza o processo de finalização do pedido
  };

  const categorizedMenu = useMemo(() => {
    return menu.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = []; // Cria uma nova categoria se não existir
      }
      acc[product.category].push(product); // Adiciona o produto à categoria correspondente
      return acc;
    }, {} as Record<Product["category"], Product[]>);
  }, [menu]);

  return (
    <>
      {orderConfirmationMessage && ( // Exibe a mensagem de confirmação se existir
        <div className="fixed top-20 right-8 bg-green-600 text-white py-3 px-6 rounded-lg shadow-lg z-50 animate-fade-in-down flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="font-semibold">{orderConfirmationMessage}</p>
        </div>
      )}
      <div className="container mx-auto flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:flex-1">
          {/* Mensagem especial do Chef (independente) */}
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-800 p-4 rounded-lg mb-4 shadow">
            <h3 className="font-bold">Mensagem Especial do Chef</h3>
            {isChefLoading ? (
              <p className="italic">O Chef está preparando algo especial...</p>
            ) : (
              <p>{chefMessage}</p>
            )}
          </div>

          

          {Object.entries(categorizedMenu).map(
            (
              [category, products]: [string, Product[]] // Mapeia as categorias do menu
            ) => (
              <div key={category} className="mb-12">
                <h2 className="text-3xl font-bold text-amber-800 mb-6 border-b-2 border-amber-200 pb-2">
                  {category}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {products.map(
                    (
                      product // Mapeia os produtos da categoria
                    ) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAddToCart={addToCart}
                      /> // Renderiza o cartão do produto
                    )
                  )}
                </div>
              </div>
            )
          )}
        </div>
        <CartSidebar
          cartItems={cartItems}
          cartTotal={cartTotal}
          updateQuantity={updateQuantity}
          onCheckout={handleCheckout}
          isPlacingOrder={isPlacingOrder}
          cartSuggestion={cartSuggestion}
        />
      </div>
    </>
  );
};

export default MenuPage; // Exporta o componente MenuPage
