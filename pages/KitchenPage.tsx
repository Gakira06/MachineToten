import React, { useState, useEffect } from 'react';
import type { Order } from '../types';
import ORDERS_DATA from '../data/orders.json';

// --- Componente auxiliar para exibir um pedido ---
// Interface que define as props esperadas pelo OrderCard
interface OrderCardProps {
  order: Order; // objeto de pedido a ser exibido
  onComplete: (orderId: string) => void; // callback quando pedido for marcado como pronto
}

// Componente funcional que renderiza um cartão com os detalhes do pedido
const OrderCard: React.FC<OrderCardProps> = ({ order, onComplete }) => (
  // card principal com estilos utilitários (Tailwind)
  <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-amber-500">
    <div className="flex justify-between items-start mb-4">
      <div>
        {/* Título com número do pedido (mostrando apenas os últimos 6 caracteres) */}
        <h3 className="font-bold text-xl text-stone-800">Pedido #{order.id.slice(-6)}</h3>
        {/* Exibe a hora do pedido formatada localmente */}
        <p className="text-sm text-stone-500">
          {new Date(order.timestamp).toLocaleTimeString()}
        </p>
      </div>
      {/* Valor total do pedido formatado com duas casas decimais */}
      <span className="font-bold text-lg">R${order.total.toFixed(2)}</span>
    </div>

    {/* Lista de itens do pedido */}
    <ul className="space-y-2 mb-4">
      {order.items.map(item => (
        // Cada item mostra quantidade, nome e subtotal (preço * quantidade)
        <li key={item.productId} className="flex justify-between border-b pb-1">
          <span>{item.quantity}x {item.name}</span>
          <span className="text-stone-600">R${(item.price * item.quantity).toFixed(2)}</span>
        </li>
      ))}
    </ul>

    {/* Botão que aciona a função onComplete recebida via props */}
    <button
      onClick={() => onComplete(order.id)}
      className="w-full bg-green-500 text-white font-bold py-2 rounded-lg hover:bg-green-600 transition-colors"
    >
      Marcar como Pronto
    </button>
  </div>
);

// --- Componente principal da página da cozinha ---
const KitchenPage: React.FC = () => {
  // Estado com os pedidos ativos a exibir
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  // Estado que controla o indicador de carregamento
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  // Simula uma chamada para buscar pedidos (poderia ser GET /pedidos)
  setLoading(true);
  setTimeout(() => {
    // Filtra apenas pedidos com status 'active' para simular fila de cozinha
    const orders = (ORDERS_DATA as Order[]).filter(o => o.status === 'active');
    setActiveOrders(orders);
    setLoading(false);
  }, 500); // atraso artificial para demonstrar carregamento
  // [] garante que esse efeito rode apenas uma vez ao montar o componente
  }, []);

  // Função que marca um pedido como concluído localmente
  const handleCompleteOrder = (orderId: string) => {
  // Em uma aplicação real, aqui faria uma requisição DELETE/PUT para atualizar o servidor
  console.log(`Completing order ${orderId}. This would remove it from 'pedidos.json' but not 'usuarios.json'`);
  // Atualiza o estado removendo o pedido concluído da lista ativa
  setActiveOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
  };

  return (
  <div className="container mx-auto">
    {/* Cabeçalho da página */}
    <h1 className="text-4xl font-bold text-amber-800 mb-8">Pedidos Ativos na Cozinha</h1>

    {/* Lógica condicional de renderização:
      - mostra uma mensagem de carregamento enquanto loading === true
      - se não houver pedidos ativos, mostra tela "Tudo pronto!"
      - caso contrário, renderiza os cartões de pedido em grid */}
    {loading ? (
    <p>Carregando pedidos...</p>
    ) : activeOrders.length === 0 ? (
    <div className="text-center py-16 bg-white rounded-xl shadow-md">
      <h2 className="text-2xl font-semibold text-stone-700">Tudo pronto!</h2>
      <p className="text-stone-500 mt-2">Nenhum pedido ativo no momento.</p>
    </div>
    ) : (
    // Grid responsivo que contém um OrderCard para cada pedido ativo
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {activeOrders.map(order => (
      <OrderCard key={order.id} order={order} onComplete={handleCompleteOrder} />
      ))}
    </div>
    )}
  </div>
  );
};

export default KitchenPage; // Exporta o componente como padrão para uso em rotas/páginas
