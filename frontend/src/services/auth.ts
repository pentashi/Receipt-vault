import api from './api';

export interface User {
  id: number;
  email: string;
  name: string;
  is_guest: boolean;
  preferred_currency: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
}

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await api.post('/auth/login', { email, password });
  const { user, access_token } = response.data;
  localStorage.setItem('token', access_token);
  localStorage.setItem('user', JSON.stringify(user));
  return response.data;
};

export const register = async (email: string, password: string, name: string): Promise<AuthResponse> => {
  const response = await api.post('/auth/register', { email, password, name });
  const { user, access_token } = response.data;
  localStorage.setItem('token', access_token);
  localStorage.setItem('user', JSON.stringify(user));
  return response.data;
};

export const guestLogin = async (): Promise<AuthResponse> => {
  const response = await api.post('/auth/guest-login');
  const { user, access_token } = response.data;
  localStorage.setItem('token', access_token);
  localStorage.setItem('user', JSON.stringify(user));
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('token');
};
