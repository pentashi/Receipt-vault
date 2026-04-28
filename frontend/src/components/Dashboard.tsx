import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { DollarSign, TrendingUp, Receipt, AlertTriangle, Store, Zap, Calendar, ArrowRight, RefreshCcw, ShieldCheck } from 'lucide-react'
import { getExpenseSummary, getDailyTrends, getBudgetAlerts, getTopStores, getSubscriptions, getSpendingForecast, exportExpenses } from '../services/api'
import toast from 'react-hot-toast'

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6']

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null)
  const [dailyTrends, setDailyTrends] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [topStores, setTopStores] = useState<any[]>([])
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [forecast, setForecast] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    loadDashboardData()
    // Check if dark mode is active
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    checkDark()
    
    // Watch for class changes on documentElement
    const observer = new MutationObserver(checkDark)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const currentDate = new Date()
      const month = currentDate.getMonth() + 1
      const year = currentDate.getFullYear()
      
      const [summaryData, dailyTrendsData, alertsData, storesData, subsData, forecastData] = await Promise.all([
        getExpenseSummary({ 
          period: 'month', 
          year, 
          month 
        }),
        getDailyTrends(month, year),
        getBudgetAlerts(month, year),
        getTopStores(5),
        getSubscriptions(),
        getSpendingForecast()
      ])
      
      setSummary(summaryData)
      setDailyTrends(dailyTrendsData.trends || [])
      setAlerts(alertsData.alerts || [])
      setTopStores(storesData.top_stores || [])
      setSubscriptions(subsData.subscriptions || [])
      setForecast(forecastData)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVATExport = async () => {
    try {
      const data = await exportExpenses();
      // Data is already CSV string from backend
      const blob = new Blob([data as any], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FTA_VAT_Export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('VAT Export generated for FTA compliance');
    } catch (error) {
      toast.error('Failed to generate VAT export');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const categoryData = summary?.category_breakdown 
    ? Object.entries(summary.category_breakdown).map(([name, value]) => ({
        name,
        value: Number(value)
      }))
    : []

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const currentDay = new Date().getDate();
  const dailyAverage = summary?.total_spent ? (summary.total_spent / currentDay) : 0;
  const projectedSpend = dailyAverage * daysInMonth;

  return (
    <div className="w-full max-w-screen-lg mx-auto px-2 space-y-6">
      {/* Header with quick stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Insights</h2>
          <p className="text-gray-500 dark:text-gray-400">Track your spending habits across the UAE</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleVATExport}
            className="flex items-center space-x-2 bg-primary-600 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-primary-200 dark:shadow-none font-bold text-xs uppercase tracking-widest hover:bg-primary-700 transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>FTA VAT Export</span>
          </button>
          <div className="flex items-center space-x-2 bg-white dark:bg-gray-900 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
            <Calendar className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
              {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500 rounded-2xl shadow-sm p-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-center">
            <div className="bg-red-100 dark:bg-red-900/40 p-2 rounded-xl mr-4">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-800 dark:text-red-200">Budget Warning</h3>
              <div className="mt-1 text-sm text-red-700 dark:text-red-300 space-y-1">
                {alerts.map((alert, idx) => (
                  <div key={idx} className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2"></span>
                    {alert.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Spent', value: summary?.total_spent?.toFixed(2) || '0.00', unit: 'AED', icon: DollarSign, color: 'text-gray-900 dark:text-white', bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-600 dark:text-green-400', sub: 'Current Month' },
          { label: 'Forecasted', value: forecast?.projected_total?.toFixed(0) || '0', unit: 'AED', icon: TrendingUp, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400', sub: 'EO Month Predict' },
          { label: 'Receipts', value: summary?.receipt_count || 0, unit: '', icon: Receipt, color: 'text-gray-900 dark:text-white', bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-600 dark:text-purple-400', sub: 'Transactions' },
          { label: 'VAT Paid', value: summary?.total_vat?.toFixed(2) || '0.00', unit: 'AED', icon: Store, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-600 dark:text-orange-400', sub: 'Tax Tracking' }
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-all">
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{card.label}</p>
            <p className={`text-2xl font-black ${card.color}`}>
              {card.value} <span className="text-xs font-normal text-gray-500">{card.unit}</span>
            </p>
            <div className={`mt-4 flex items-center text-[10px] font-black uppercase tracking-tighter ${card.bg} ${card.text} px-2 py-1 rounded-lg w-fit`}>
              <card.icon className="w-3 h-3 mr-1" />
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Spending Trend */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Daily Spending</h3>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-3 py-1 rounded-lg">Current Month</div>
          </div>
          {dailyTrends.length > 0 ? (
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrends}>
                  <defs>
                    <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#1e293b" : "#f1f5f9"} />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: isDark ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 700}}
                    dy={10}
                    label={{ value: 'Day of Month', position: 'insideBottom', offset: -5, fill: isDark ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 800 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: isDark ? '#64748b' : '#94a3b8', fontSize: 10, fontWeight: 700}}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#fff',
                      borderRadius: '16px',
                      border: 'none',
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                      color: isDark ? '#fff' : '#000'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total_spent" 
                    stroke="#0ea5e9" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorSpent)" 
                    name="Spent (AED)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-80 text-gray-400 font-bold uppercase tracking-widest text-xs">
              Insufficient data for trends
            </div>
          )}
        </div>

        {/* Merchant Leaderboard */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Top Merchants</h3>
          <div className="space-y-5">
            {topStores.length > 0 ? topStores.map((store, idx) => (
              <div key={idx} className="flex items-center justify-between group cursor-default">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center border border-gray-100 dark:border-gray-700 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
                    <Store className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{store.store_name}</p>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-tighter">{store.visit_count} visits</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-gray-900 dark:text-white">{store.total_spent.toFixed(0)} <span className="text-[10px] font-normal opacity-50">AED</span></p>
                  <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-primary-500 rounded-full" 
                      style={{ width: `${(store.total_spent / topStores[0].total_spent) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-center text-gray-400 py-10 text-xs font-bold uppercase tracking-widest">No merchants recorded</p>
            )}
          </div>
          <button className="w-full mt-8 py-3 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2">
            <span>View All Merchants</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Subscriptions Tracker */}
      {subscriptions.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Detected Subscriptions</h3>
            <div className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">Auto-Detected</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subscriptions.map((sub, idx) => (
              <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border dark:border-gray-700 flex items-center space-x-4">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                  <RefreshCcw className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{sub.merchant}</p>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-0.5">{sub.avg_amount.toFixed(0)} AED / {sub.frequency}</p>
                  <p className="text-[9px] text-primary-500 font-bold mt-1">Next: {new Date(sub.next_predicted).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Spending by Category</h3>
          {categoryData.length > 0 ? (
            <div className="w-full h-80 flex flex-col sm:row items-center">
              <div className="w-full sm:w-1/2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {categoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: isDark ? '#0f172a' : '#fff',
                        borderRadius: '16px',
                        border: 'none',
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                        color: isDark ? '#fff' : '#000'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full sm:w-1/2 space-y-3 mt-4 sm:mt-0 sm:pl-6">
                {categoryData.slice(0, 5).map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400 truncate max-w-[120px]">{entry.name}</span>
                    </div>
                    <span className="text-xs font-black text-gray-900 dark:text-white">{((entry.value / summary.total_spent) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-80 text-gray-400 font-bold uppercase tracking-widest text-xs">
              No categories detected
            </div>
          )}
        </div>

        {/* Prediction & Projection */}
        <div className="bg-primary-600 dark:bg-primary-700 rounded-3xl shadow-xl p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <TrendingUp className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-6">
              <Zap className="w-6 h-6 text-yellow-300 fill-yellow-300" />
              <h3 className="text-xl font-black uppercase tracking-tight">Projections</h3>
            </div>
            <p className="text-primary-100 text-sm font-medium leading-relaxed mb-8">
              Based on your current speed of <span className="text-white font-black underline decoration-yellow-300 underline-offset-4">{dailyAverage.toFixed(2)} AED/day</span>, 
              you'll likely end the month at:
            </p>
            <div className="flex items-baseline space-x-2">
              <span className="text-6xl font-black tracking-tighter">{projectedSpend.toFixed(0)}</span>
              <span className="text-xl font-bold text-primary-200 uppercase tracking-widest">AED</span>
            </div>
          </div>
          
          <div className="mt-12 bg-white/10 dark:bg-black/20 backdrop-blur-xl rounded-2xl p-5 border border-white/20 relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary-200 mb-2">Smart Status</p>
            <p className="text-sm font-bold leading-snug">
              {projectedSpend > 5000 
                ? "⚠️ Higher than average spending. Your Shopping category is 20% above normal."
                : "✅ You're on track to stay under budget. Great discipline this month!"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


