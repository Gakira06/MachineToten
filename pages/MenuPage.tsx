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

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  quantityInCart?: number; // quantidade atual deste produto no carrinho
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, quantityInCart = 0 }) => (
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
        <div className="flex items-center gap-2">
          {quantityInCart > 0 && (
            <span className="bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded-full text-sm">
              {quantityInCart} no carrinho
            </span>
          )}
          <button
            onClick={() => onAddToCart(product)}
            className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600 transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  </div>
);

// CartSidebar atualizado para suportar modo mobile drawer
interface CartSidebarProps {
  cartItems: CartItem[];
  cartTotal: number;
  updateQuantity: (id: string, q: number) => void;
  onCheckout: () => void;
  isPlacingOrder: boolean;
  cartSuggestion?: string;
  // props novos:
  isMobile?: boolean; // quando true renderiza como drawer full-screen
  onClose?: () => void; // usado no mobile para fechar
}

const CartSidebar: React.FC<CartSidebarProps> = ({
  cartItems,
  cartTotal,
  updateQuantity,
  onCheckout,
  isPlacingOrder,
  cartSuggestion,
  isMobile = false,
  onClose,
}) => {
  // classes diferentes para mobile vs desktop
  const containerClass = isMobile
    ? "fixed inset-x-0 bottom-0 top-0 bg-white p-6 rounded-t-2xl shadow-xl z-50 flex flex-col"
    : "hidden lg:flex w-full lg:w-1/3 xl:w-1/4 bg-white p-6 rounded-2xl shadow-xl lg:relative lg:h-fit lg:sticky lg:top-24 flex flex-col";

  return (
    <div className={containerClass}>
      {isMobile && (
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-amber-800">Seu Pedido</h2>
          <button
            onClick={onClose}
            className="text-stone-600 bg-stone-100 p-2 rounded-full"
            aria-label="Fechar carrinho"
          >
            ✕
          </button>
        </div>
      )}
      {!isMobile && (
        <h2 className="text-2xl font-bold text-amber-800 border-b-2 border-amber-200 pb-2 mb-4">
          Seu Pedido
        </h2>
      )}
      {cartItems.length === 0 ? (
        <p className="text-stone-500">Seu carrinho está vazio.</p>
      ) : (
        <>
          {cartSuggestion && (
            <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-500 rounded text-sm text-amber-800 italic">
              💡 {cartSuggestion}
            </div>
          )}
          <div className="space-y-4 overflow-y-auto pr-2 flex-1 max-h-[60vh]">
            {cartItems.map((item) => (
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
                    }
                    className="w-14 text-center border rounded"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t-2 border-dashed border-amber-300">
            <div className="flex justify-between font-bold text-xl">
              <span>Total</span>
              <span>R${cartTotal.toFixed(2)}</span>
            </div>
            <button
              onClick={onCheckout}
              disabled={isPlacingOrder}
              className="w-full mt-4 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-300 disabled:cursor-wait"
            >
              {isPlacingOrder ? "Enviando Pedido..." : "Finalizar Pedido"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// --- Componente CategorySidebar (Sidebar de Categorias) ---

interface CategorySidebarProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  isMobile?: boolean;
  onClose?: () => void;
}

const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  isMobile = false,
  onClose,
}) => {
  const containerClass = isMobile
    ? "fixed inset-x-0 left-0 top-0 bottom-0 w-64 bg-white shadow-lg z-40 flex flex-col p-4"
    : "hidden lg:flex flex-col w-48 bg-white rounded-2xl shadow-xl p-4 h-fit sticky top-24";

  return (
    <div className={containerClass}>
      {isMobile && (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-amber-800">Categorias</h2>
          <button
            onClick={onClose}
            className="text-stone-600 bg-stone-100 p-2 rounded-full"
            aria-label="Fechar categorias"
          >
            ✕
          </button>
        </div>
      )}

      {!isMobile && (
        <h3 className="text-xl font-bold text-amber-800 mb-4">Categorias</h3>
      )}

      <button
        onClick={() => onSelectCategory(null)}
        className={`w-full py-3 px-4 rounded-lg font-semibold mb-2 text-left transition-all ${
          selectedCategory === null
            ? "bg-amber-500 text-white shadow-lg"
            : "bg-stone-100 text-stone-800 hover:bg-stone-200"
        }`}
      >
        🔥 Todos
      </button>

      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelectCategory(category)}
          className={`w-full py-3 px-4 rounded-lg font-semibold mb-2 text-left transition-all ${
            selectedCategory === category
              ? "bg-amber-500 text-white shadow-lg"
              : "bg-stone-100 text-stone-800 hover:bg-stone-200"
          }`}
        >
          {category === "Pastel" && "🥟 Pastéis"}
          {category === "Bebida" && "🥤 Bebidas"}
          {category === "Doce" && "🍰 Doces"}
        </button>
      ))}
    </div>
  );
};

// --- Componente Principal da Página do Menu ---

const MenuPage: React.FC = () => {
  const [menu, setMenu] = useState<Product[]>([]);
  const [suggestion, setSuggestion] = useState<string>("");
  const [cartSuggestion, setCartSuggestion] = useState<string>("");
  const [chefMessage, setChefMessage] = useState<string>("");
  const [isChefLoading, setIsChefLoading] = useState<boolean>(false);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [orderConfirmationMessage, setOrderConfirmationMessage] = useState<
    string | null
  >(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);

  const { currentUser, addOrderToHistory } = useAuth();
  const { cartItems, addToCart, clearCart, cartTotal, updateQuantity } =
    useCart();

  useEffect(() => {
    setMenu(MENU_DATA as Product[]);
  }, []);

  useEffect(() => {
    const fetchSuggestion = async () => {
      if (currentUser) {
        setIsSuggestionLoading(true);
        const newSuggestion = await getMenuSuggestion(
          currentUser.historico,
          cartItems,
          menu,
          currentUser.name
        );
        setIsSuggestionLoading(false);
      }
    };
    if (menu.length > 0) {
      fetchSuggestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, currentUser, menu]);

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
    if (!currentUser || cartItems.length === 0) return;
    setIsPlacingOrder(true);

    const payload = {
      userId: currentUser.id,
      userName: currentUser.name,
      items: cartItems.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      total: cartTotal,
    };

    try {
      const resp = await fetch('http://localhost:3001/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error('Falha ao enviar pedido');
      const saved: Order = await resp.json();
      // ainda mantemos o histórico local para experiência do usuário
      addOrderToHistory(saved);
      setOrderConfirmationMessage('Pedido realizado com sucesso!');
      setTimeout(() => setOrderConfirmationMessage(null), 4000);
      clearCart();
    } catch (err) {
      console.error(err);
      setOrderConfirmationMessage('Erro ao enviar pedido. Tente novamente.');
      setTimeout(() => setOrderConfirmationMessage(null), 5000);
    } finally {
      setIsPlacingOrder(false);
      setIsMobileCartOpen(false);
    }
  };

  const categorizedMenu = useMemo(() => {
    return menu.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    }, {} as Record<Product["category"], Product[]>);
  }, [menu]);

  return (
    <>
      {orderConfirmationMessage && (
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

      <div className="container mx-auto flex flex-col md:flex-row gap-8 md:mb-40">
        {/* Sidebar de Categorias - Desktop */}
        <CategorySidebar
          categories={Object.keys(categorizedMenu).sort()}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        <div className="w-full flex-1">
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-800 p-4 rounded-lg mb-4 shadow">
            <h3 className="font-bold">Mensagem Especial do Chef</h3>
            {isChefLoading ? (
              <p className="italic">O Chef está preparando algo especial...</p>
            ) : (
              <p>{chefMessage}</p>
            )}
          </div>

          {selectedCategory === null ? (
            // Mostrar todas as categorias
            Object.entries(categorizedMenu).map(
              ([category, products]: [string, Product[]]) => (
                <div key={category} className="mb-12">
                  <h2 className="text-3xl font-bold text-amber-800 mb-6 border-b-2 border-amber-200 pb-2">
                    {category === "Pastel" && "🥟 Pastéis"}
                    {category === "Bebida" && "🥤 Bebidas"}
                    {category === "Doce" && "🍰 Doces"}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAddToCart={addToCart}
                        quantityInCart={cartItems.find(item => item.id === product.id)?.quantity || 0}
                      />
                    ))}
                  </div>
                </div>
              )
            )
          ) : (
            // Mostrar apenas a categoria selecionada
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-amber-800 mb-6 border-b-2 border-amber-200 pb-2">
                {selectedCategory === "Pastel" && "🥟 Pastéis"}
                {selectedCategory === "Bebida" && "🥤 Bebidas"}
                {selectedCategory === "Doce" && "🍰 Doces"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {categorizedMenu[selectedCategory]?.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    quantityInCart={cartItems.find(item => item.id === product.id)?.quantity || 0}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Versão desktop do cart (visível apenas em lg+) */}
        <CartSidebar
          cartItems={cartItems}
          cartTotal={cartTotal}
          updateQuantity={updateQuantity}
          onCheckout={handleCheckout}
          isPlacingOrder={isPlacingOrder}
          cartSuggestion={cartSuggestion}
          // isMobile não passado => desktop behavior
        />
      </div>

      {/* Botões flutuantes mobile - Bolinhas pequenas */}
      <div className="lg:hidden fixed bottom-6 left-6 z-40 flex flex-col gap-3">
        {/* Botão Carrinho */}
        <button
          className="bg-amber-500 text-white p-3 rounded-full shadow-lg hover:bg-amber-600 transition-all flex items-center justify-center w-14 h-14 animate-pulse"
          onClick={() => setIsMobileCartOpen(true)}
          aria-label="Abrir carrinho"
          title="Carrinho"
        >
          <span className="text-2xl">🧺</span>
          {cartItems.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {cartItems.length}
            </span>
          )}
        </button>

        {/* Botão Categorias */}
        <button
          className="bg-amber-600 text-white p-3 rounded-full shadow-lg hover:bg-amber-700 transition-all flex items-center justify-center w-14 h-14"
          onClick={() => setIsMobileCategoryOpen(!isMobileCategoryOpen)}
          aria-label="Abrir categorias"
          title="Categorias"
        >
          <span className="text-2xl">📋</span>
        </button>
      </div>

      {/* Drawer mobile */}
      {/* Drawer de categorias mobile */}
      {isMobileCategoryOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
            onClick={() => setIsMobileCategoryOpen(false)}
          />
          <CategorySidebar
            categories={Object.keys(categorizedMenu).sort()}
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setIsMobileCategoryOpen(false);
            }}
            isMobile
            onClose={() => setIsMobileCategoryOpen(false)}
          />
        </>
      )}

      {isMobileCartOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
            onClick={() => setIsMobileCartOpen(false)}
          />
          <CartSidebar
            cartItems={cartItems}
            cartTotal={cartTotal}
            updateQuantity={updateQuantity}
            onCheckout={handleCheckout}
            isPlacingOrder={isPlacingOrder}
            cartSuggestion={cartSuggestion}
            isMobile
            onClose={() => setIsMobileCartOpen(false)}
          />
        </>
      )}
    </>
  );
};

export default MenuPage;
