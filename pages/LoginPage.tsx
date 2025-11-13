import React, { useState, useEffect } from 'react';
// useNavigate é do react-router para navegar programaticamente entre rotas
import { useNavigate } from 'react-router-dom';
// hook de contexto de autenticação (fornece login, logout, etc.)
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../types';
// dados estáticos de usuários (no exemplo substitui uma chamada real de API)
import USERS_DATA from '../data/users.json';

const LoginPage: React.FC = () => {
  // estado local para lista de usuários que serão exibidos na tela
  const [users, setUsers] = useState<User[]>([]);
  // função de login obtida do contexto de autenticação
  const { login } = useAuth();
  // hook para navegar entre rotas (ex: após login ir para /menu)
  const navigate = useNavigate();

  useEffect(() => {
    // efeito que roda uma vez ao montar o componente
    // aqui simulamos uma "busca" carregando dados estáticos
    setUsers(USERS_DATA as User[]);
  }, []); // array de dependências vazio = executa apenas na montagem

  // função chamada quando o usuário clica em um perfil para fazer login
  const handleLogin = (user: User) => {
    // chama a função de login do contexto para setar o usuário autenticado
    login(user);
    // redireciona para a rota /menu após o login
    navigate('/menu');
  };

  return (
    // container principal centralizado verticalmente na página
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-128px)]">
      {/* cartão branco com sombra onde ficam os perfis */}
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center">
          {/* título da página */}
          <h1 className="text-3xl font-bold text-amber-800">Bem-vindo(a) de volta!</h1>
          {/* subtítulo explicando o que fazer */}
          <p className="mt-2 text-stone-600">Por favor, selecione seu perfil para continuar.</p>
        </div>

        {/* lista de botões, um por usuário */}
        <div className="space-y-4">
          {users.map(user => (
            // cada botão representa um perfil; ao clicar chama handleLogin com o usuário
            <button
              key={user.id}
              onClick={() => handleLogin(user)}
              className="w-full flex items-center p-4 text-lg text-stone-700 bg-amber-50 rounded-xl border-2 border-amber-200 hover:bg-amber-100 hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all duration-300 ease-in-out transform hover:-translate-y-1"
            >
              {/* avatar circular com a inicial do nome */}
              <div className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xl mr-4">
                {user.name.charAt(0)}
              </div>
              {/* nome do usuário exibido no botão */}
              <span>{user.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;