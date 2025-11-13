import type { User } from "../types";

const API_URL = "http://localhost:5000/api";

// Validar CPF (formato básico)
export const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/\D/g, "");
  return cleanCPF.length === 11;
};

// Buscar usuário por CPF via API
export const findUserByCPF = async (cpf: string): Promise<User | null> => {
  try {
    const response = await fetch(`${API_URL}/users/cpf/${cpf}`);
    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    return null;
  }
};

// Registrar novo usuário via API
export const registerUser = async (userData: {
  name: string;
  cpf: string;
  email: string;
  telefone: string;
}): Promise<User | null> => {
  try {
    const response = await fetch(`${API_URL}/users/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (response.ok) {
      return data.user;
    } else {
      console.error("Erro ao registrar:", data.error);
      return null;
    }
  } catch (error) {
    console.error("Erro ao registrar usuário:", error);
    return null;
  }
};

// Salvar pedido via API
export const saveOrder = async (
  userId: string,
  items: any[],
  total: number
) => {
  try {
    const response = await fetch(`${API_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        items,
        total,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return data.order;
    } else {
      console.error("Erro ao salvar pedido:", data.error);
      return null;
    }
  } catch (error) {
    console.error("Erro ao salvar pedido:", error);
    return null;
  }
};

// Obter histórico do usuário via API
export const getUserHistory = async (userId: string) => {
  try {
    const response = await fetch(`${API_URL}/users/${userId}/historico`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Erro ao obter histórico:", error);
    return [];
  }
};
