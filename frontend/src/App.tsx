import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import ReceiptUpload from './components/ReceiptUpload'
import ReceiptList from './components/ReceiptList'
import BudgetManager from './components/BudgetManager'
import { Upload, Receipt, PieChart, TrendingUp, Bell } from 'lucide-react'
import { getBudgetAlerts } from './services/api'

type TabType = 'dashboard' | 'upload' | 'receipts' | 'budgets'
import { Toaster } from 'react-hot-toast'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [alerts, setAlerts] = useState<any[]>([])
  const [showAlerts, setShowAlerts] = useState(false)

  useEffect(() => {
    loadAlerts()
    // Refresh alerts every 30 seconds (not 5 minutes - too long)
    const interval = setInterval(loadAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Reload alerts when switching tabs (especially after adding receipts or budgets)
    loadAlerts()
  }, [activeTab])

  useEffect(() => {
    // Close alerts dropdown when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (showAlerts && !target.closest('.alerts-dropdown')) {
        setShowAlerts(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showAlerts])

  const loadAlerts = async () => {
    try {
      const data = await getBudgetAlerts()
      setAlerts(data.alerts || [])
    } catch (error) {
      console.error('Error loading alerts:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      {/* Header */}
      <header className="bg-primary-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Receipt className="w-8 h-8" />
              <h1 className="text-2xl font-bold">ReceiptVault</h1>
            </div>
            <div className="flex items-center space-x-4">
              <p className="text-sm text-primary-100">Smart Expense Tracking</p>
              
              {/* Notification Bell */}
              <div className="relative alerts-dropdown">
                <button
                  onClick={() => setShowAlerts(!showAlerts)}
                  className={`relative p-2 hover:bg-primary-700 rounded-lg transition-colors ${
                    alerts.length > 0 ? 'animate-pulse' : ''
                  }`}
                  title="Budget Alerts"
                >
                  <Bell className={`w-6 h-6 ${alerts.length > 0 ? 'text-yellow-300' : ''}`} />
                  {alerts.length > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full animate-bounce">
                      {alerts.length}
                    </span>
                  )}
                </button>

                {/* Alerts Dropdown */}
                {showAlerts && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-50">
                    <div className="p-4 border-b">
                      <h3 className="font-semibold text-gray-900">Budget Alerts</h3>
                    </div>
                    
                    {alerts.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        No budget alerts. You're on track! 🎉
                      </div>
                    ) : (
                      <div className="max-h-96 overflow-y-auto">
                        {alerts.map((alert, idx) => (
                          <div
                            key={idx}
                            className={`p-4 border-b last:border-b-0 ${
                              alert.alert_type === 'exceeded'
                                ? 'bg-red-50'
                                : 'bg-yellow-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                                      alert.alert_type === 'exceeded'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-yellow-600 text-white'
                                    }`}
                                  >
                                    {alert.alert_type === 'exceeded' ? '⚠️ EXCEEDED' : '⚠️ WARNING'}
                                  </span>
                                  <span className="font-medium text-gray-900">{alert.category}</span>
                                </div>
                                <p className="mt-1 text-sm text-gray-700">{alert.message}</p>
                                <div className="mt-2 text-xs text-gray-600">
                                  <span className="font-medium">Spent:</span> {alert.actual_spending.toFixed(2)} AED
                                  {' / '}
                                  <span className="font-medium">Budget:</span> {alert.monthly_limit} AED
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="p-3 bg-gray-50 text-center">
                      <button
                        onClick={() => {
                          setShowAlerts(false)
                          setActiveTab('budgets')
                        }}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Manage Budgets →
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
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-primary-600'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              <span>Dashboard</span>
            </button>
            
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-primary-600'
              }`}
            >
              <Upload className="w-5 h-5" />
              <span>Upload Receipt</span>
            </button>
            
            <button
              onClick={() => setActiveTab('receipts')}
              className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                activeTab === 'receipts'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-primary-600'
              }`}
            >
              <Receipt className="w-5 h-5" />
              <span>My Receipts</span>
            </button>
            
            <button
              onClick={() => setActiveTab('budgets')}
              className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                activeTab === 'budgets'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-primary-600'
              }`}
            >
              <PieChart className="w-5 h-5" />
              <span>Budgets</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'upload' && <ReceiptUpload onUploadSuccess={() => setActiveTab('receipts')} />}
        {activeTab === 'receipts' && <ReceiptList />}
        {activeTab === 'budgets' && <BudgetManager />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          <p>© 2026 ReceiptVault - Track Your Expenses in UAE</p>
        </div>
      </footer>
    </div>
  )
}

export default App
