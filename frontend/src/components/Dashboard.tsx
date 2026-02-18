import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { DollarSign, TrendingUp, Receipt, AlertTriangle } from 'lucide-react'
import { getExpenseSummary, getExpenseTrends, getBudgetAlerts } from '../services/api'

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6']

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null)
  const [trends, setTrends] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const currentDate = new Date()
      
      const [summaryData, trendsData, alertsData] = await Promise.all([
        getExpenseSummary({ 
          period: 'month', 
          year: currentDate.getFullYear(), 
          month: currentDate.getMonth() + 1 
        }),
        getExpenseTrends(6),
        getBudgetAlerts(currentDate.getMonth() + 1, currentDate.getFullYear())
      ])
      
      setSummary(summaryData)
      setTrends(trendsData.trends || [])
      setAlerts(alertsData.alerts || [])
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  const categoryData = summary?.category_breakdown 
    ? Object.entries(summary.category_breakdown).map(([name, value]) => ({
        name,
        value: Number(value)
      }))
    : []

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white border-l-4 border-red-500 rounded-lg shadow p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Budget Alerts</h3>
              <div className="mt-2 text-sm text-gray-700">
                {alerts.map((alert, idx) => (
                  <div key={idx}>• {alert.message}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {summary?.total_spent?.toFixed(2) || '0.00'} AED
              </p>
            </div>
            <div className="p-3">
              <DollarSign className="w-8 h-8 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Receipts This Month</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {summary?.receipt_count || 0}
              </p>
            </div>
            <div className="p-3">
              <Receipt className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Per Receipt</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {summary?.average_per_receipt?.toFixed(2) || '0.00'} AED
              </p>
            </div>
            <div className="p-3">
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={100}
                  paddingAngle={4}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="vertical" align="right" verticalAlign="middle" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              No expense data available
            </div>
          )}
        </div>

        {/* Monthly Trends */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Spending Trends (Last 6 Months)</h3>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total_spent" fill="#0ea5e9" name="Total Spent (AED)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              No trend data available
            </div>
          )}
        </div>
      </div>

      {/* VAT Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">VAT Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total VAT Paid</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {summary?.total_vat?.toFixed(2) || '0.00'} AED
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">VAT Rate</p>
            <p className="text-xl font-bold text-gray-900 mt-1">5%</p>
          </div>
        </div>
      </div>
    </div>
  )
}
