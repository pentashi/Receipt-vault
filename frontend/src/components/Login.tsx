import React, { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus, Zap, ArrowRight, Receipt, Loader2 } from 'lucide-react';
import { login, register, guestLogin } from '../services/auth';
import toast from 'react-hot-toast';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await register(formData.email, formData.password, formData.name);
        toast.success('Account created successfully!');
      } else {
        await login(formData.email, formData.password);
        toast.success('Welcome back!');
      }
      onLoginSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGuestLoading(true);
    try {
      await guestLogin();
      toast.success('Connected via Google (Sandbox)');
      onLoginSuccess();
    } catch (error) {
      toast.error('Google Auth failed');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    try {
      await guestLogin();
      toast.success('Welcome Explorer');
      onLoginSuccess();
    } catch (error) {
      toast.error('Guest login failed');
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border dark:border-gray-800">
        <div className="p-8 text-center bg-primary-600">
          <div className="inline-flex p-3 bg-white/20 backdrop-blur-md rounded-2xl mb-4">
            <Receipt className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">ReceiptVault</h1>
          <p className="text-primary-100 mt-2 font-medium">UAE's Smartest Expense Tracker</p>
        </div>

        <div className="p-8">
          <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-8">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
                !isRegister ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
                isRegister ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <UserPlus className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                </div>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Your Name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white font-bold"
                />
              </div>
            )}

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
              </div>
              <input
                type="email"
                name="email"
                required
                placeholder="email@example.com"
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white font-bold"
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
              </div>
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white font-bold"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-primary-600/20 active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isRegister ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                  <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                </>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest">
              <span className="px-3 bg-white dark:bg-gray-900 text-gray-400 font-bold">Or continue with</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleGoogleLogin}
              disabled={guestLoading}
              className="w-full py-3.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-white border-2 border-gray-200 dark:border-gray-700 rounded-2xl font-bold flex items-center justify-center space-x-3 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[0.98]"
            >
              {guestLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Google</span>
                </>
              )}
            </button>

            <button
              onClick={handleGuestLogin}
              disabled={guestLoading}
              className="w-full py-3.5 bg-gray-950 dark:bg-white text-white dark:text-gray-950 rounded-2xl font-bold flex items-center justify-center space-x-3 transition-all hover:opacity-90 active:scale-[0.98]"
            >
              {guestLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <span>Explore as Guest</span>
                  <ArrowRight className="w-4 h-4 ml-1 opacity-60" />
                </>
              )}
            </button>
          </div>
          
          <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400 leading-relaxed px-4">
            Guest mode creates a unique session just for you. Data is isolated and persists until the session expires.
          </p>
        </div>
      </div>
      
      <p className="mt-8 text-sm font-medium text-gray-500 dark:text-gray-400">
        Built with ❤️ for the UAE Tech Community
      </p>
    </div>
  );
};

export default Login;
