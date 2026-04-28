import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import ReceiptUpload from './components/ReceiptUpload'
import ReceiptList from './components/ReceiptList'
import BudgetManager from './components/BudgetManager'
import Login from './components/Login'
import { Upload, Receipt, PieChart, TrendingUp, Bell, Sun, Moon, Menu, X, AlertTriangle, LogOut } from 'lucide-react'
import { getBudgetAlerts } from './services/api'
import { isAuthenticated, logout, getCurrentUser } from './services/auth'
import { Toaster } from 'react-hot-toast'

type TabType = 'dashboard' | 'upload' | 'receipts' | 'budgets'

function App() {
  const [isAuth, setIsAuth] = useState(isAuthenticated())
  const [user, setUser] = useState(getCurrentUser())
  const [navOpen, setNavOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [alerts, setAlerts] = useState<any[]>([])
  const [showAlerts, setShowAlerts] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
  }, [darkMode])

  useEffect(() => {
    if (isAuth) {
      loadAlerts()
      const interval = setInterval(loadAlerts, 30000)
      return () => clearInterval(interval)
    }
  }, [isAuth])

  useEffect(() => {
    if (isAuth) {
      loadAlerts()
    }
  }, [activeTab, isAuth])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (showAlerts && !target.closest('.alerts-dropdown')) {
        setShowAlerts(false)
      }
      if (showUserMenu && !target.closest('.user-menu')) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showAlerts, showUserMenu])

  const loadAlerts = async () => {
    try {
      const data = await getBudgetAlerts()
      setAlerts(data.alerts || [])
    } catch (error) {
      console.error('Error loading alerts:', error)
    }
  }

  const handleLoginSuccess = () => {
    setIsAuth(true)
    setUser(getCurrentUser())
  }

  const handleLogout = () => {
    logout()
    setIsAuth(false)
    setUser(null)
  }

  if (!isAuth) {
    return (
      <>
        <Toaster position="top-right" />
        <Login onLoginSuccess={handleLoginSuccess} />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300 w-full">
      <div className="w-full max-w-screen-lg mx-auto px-2">
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-primary-600 p-2 rounded-xl">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">ReceiptVault</h1>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Theme Toggle */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
                </button>

                {/* Notification Bell */}
                <div className="relative alerts-dropdown">
                  <button
                    onClick={() => setShowAlerts(!showAlerts)}
                    className={`relative p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all ${
                      alerts.length > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <Bell className={`w-5 h-5 ${alerts.length > 0 ? 'text-red-500' : ''}`} />
                    {alerts.length > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    )}
                  </button>

                  {/* Alerts Dropdown */}
                  {showAlerts && (
                    <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border dark:border-gray-800 z-50 overflow-hidden">
                      <div className="p-4 border-b dark:border-gray-800">
                        <h3 className="font-bold text-gray-900 dark:text-white">Budget Alerts</h3>
                      </div>
                      
                      {alerts.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                          <p className="text-sm font-medium">You're all set! No alerts. 🎉</p>
                        </div>
                      ) : (
                        <div className="max-h-96 overflow-y-auto">
                          {alerts.map((alert, idx) => (
                            <div
                              key={idx}
                              className={`p-4 border-b dark:border-gray-800 last:border-b-0 ${
                                alert.alert_type === 'exceeded'
                                  ? 'bg-red-50 dark:bg-red-950/20'
                                  : 'bg-yellow-50 dark:bg-yellow-950/20'
                              }`}
                            >
                              <div className="flex items-start space-x-3">
                                <div className={`p-1.5 rounded-lg ${alert.alert_type === 'exceeded' ? 'bg-red-100 dark:bg-red-900/40 text-red-600' : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600'}`}>
                                  <AlertTriangle className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-bold text-gray-900 dark:text-white">{alert.category}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{alert.message}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* User Menu */}
                <div className="relative user-menu ml-2">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-2 p-1 pl-2 pr-3 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all"
                  >
                    <div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm">
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                    <span className="hidden md:block text-sm font-bold text-gray-700 dark:text-gray-300 max-w-[100px] truncate">
                      {user?.name || 'User'}
                    </span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border dark:border-gray-800 z-50 overflow-hidden">
                      <div className="p-4 border-b dark:border-gray-800">
                        <p className="text-sm font-black text-gray-900 dark:text-white truncate">{user?.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{user?.email}</p>
                        {user?.is_guest && (
                          <span className="inline-block mt-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-black uppercase tracking-wider rounded-md">
                            Guest Session
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 mb-6">
          <div className="w-full">
            <div className="hidden sm:flex items-center space-x-1 p-1">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
                { id: 'upload', label: 'Upload', icon: Upload },
                { id: 'receipts', label: 'Receipts', icon: Receipt },
                { id: 'budgets', label: 'Budgets', icon: PieChart },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="text-sm">{tab.label}</span>
                </button>
              ))}
            </div>
            
            {/* Mobile Nav */}
            <div className="sm:hidden flex items-center justify-between p-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-bold ${
                  activeTab === 'dashboard' ? 'text-primary-600 bg-primary-50 dark:bg-primary-950/30' : 'text-gray-500'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setNavOpen(!navOpen)}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
              >
                {navOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

            {navOpen && (
              <div className="sm:hidden p-2 space-y-1 bg-white dark:bg-gray-900 border-t dark:border-gray-800">
                {[
                  { id: 'upload', label: 'Upload Receipt', icon: Upload },
                  { id: 'receipts', label: 'My Receipts', icon: Receipt },
                  { id: 'budgets', label: 'Budgets', icon: PieChart },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as TabType); setNavOpen(false); }}
                    className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl font-bold ${
                      activeTab === tab.id
                        ? 'bg-primary-50 dark:bg-primary-950/30 text-primary-600'
                        : 'text-gray-500'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Main Content */}
        <main className="w-full pb-12">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'upload' && <ReceiptUpload onUploadSuccess={() => setActiveTab('receipts')} />}
          {activeTab === 'receipts' && <ReceiptList />}
          {activeTab === 'budgets' && <BudgetManager />}
        </main>

        {/* Footer */}
        <footer className="py-12 border-t dark:border-gray-800 text-center">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            © 2026 ReceiptVault • Made with ❤️ in UAE
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
