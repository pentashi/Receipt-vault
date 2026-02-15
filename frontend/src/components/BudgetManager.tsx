import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Edit, Trash2, AlertTriangle } from 'lucide-react'
import { getBudgets, createBudget, updateBudget, deleteBudget, getCategories } from '../services/api'
import ConfirmDialog from './ConfirmDialog'

export default function BudgetManager() {
  const [budgets, setBudgets] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBudget, setEditingBudget] = useState<any>(null)
  const [formData, setFormData] = useState({
    category: '',
    monthly_limit: '',
    alert_threshold: '80'
  })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number|null>(null)
  const [shownWarnings, setShownWarnings] = useState<{[key: number]: boolean}>({});
  // Show warning toast for approaching limit, only once per budget per session
  useEffect(() => {
    budgets.forEach(budget => {
      const percentageUsed = budget.percentage_used || 0;
      const isWarning = percentageUsed >= budget.alert_threshold && !budget.is_exceeded;
      if (isWarning && !shownWarnings[budget.id]) {
        toast((t) => (
          <span>
            <AlertTriangle className="inline w-5 h-5 text-yellow-600 mr-2" />
            <b>Warning:</b> Approaching limit for <b>{budget.category}</b>
          </span>
        ), { icon: null, duration: 4000 });
        setShownWarnings(prev => ({ ...prev, [budget.id]: true }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets]);

  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [budgetsData, categoriesData] = await Promise.all([
        getBudgets(currentMonth, currentYear),
        getCategories()
      ])
      setBudgets(budgetsData.budgets || [])
      setCategories(categoriesData.categories || [])
    } catch (error) {
      console.error('Error loading budgets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingBudget) {
        await updateBudget(editingBudget.id, {
          monthly_limit: parseFloat(formData.monthly_limit),
          alert_threshold: parseFloat(formData.alert_threshold)
        })
      } else {
        await createBudget({
          category: formData.category,
          monthly_limit: parseFloat(formData.monthly_limit),
          month: currentMonth,
          year: currentYear,
          alert_threshold: parseFloat(formData.alert_threshold)
        })
      }
      
      setShowModal(false)
      setEditingBudget(null)
      setFormData({ category: '', monthly_limit: '', alert_threshold: '80' })
      loadData()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save budget')
    }
  }

  const handleEdit = (budget: any) => {
    setEditingBudget(budget)
    setFormData({
      category: budget.category,
      monthly_limit: budget.monthly_limit.toString(),
      alert_threshold: budget.alert_threshold.toString()
    })
    setShowModal(true)
  }

  const handleDelete = (budgetId: number) => {
    setDeleteId(budgetId)
    setConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (deleteId == null) return
    try {
      await deleteBudget(deleteId)
      toast.success('Budget deleted successfully')
      loadData()
    } catch (error) {
      toast.error('Failed to delete budget')
    } finally {
      setConfirmOpen(false)
      setDeleteId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading budgets...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow p-6 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Budget Manager</h2>
          <p className="text-gray-700 mt-1">
            Manage your monthly budgets for {new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingBudget(null)
            setFormData({ category: '', monthly_limit: '', alert_threshold: '80' })
            setShowModal(true)
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Budget</span>
        </button>
      </div>

      {/* Budgets Grid */}
      {budgets.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No budgets set for this month</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create Your First Budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map(budget => {
            const percentageUsed = budget.percentage_used || 0;
            const isWarning = percentageUsed >= budget.alert_threshold && !budget.is_exceeded;
            const isExceeded = budget.is_exceeded;

            return (
              <div
                key={budget.id}
                className={`bg-white rounded-lg shadow-lg p-6 border-2 transition-all ${
                  isExceeded ? 'border-red-500 shadow-red-200' : isWarning ? 'border-yellow-500 shadow-yellow-200' : 'border-transparent'
                }`}
              >
                {/* Only show persistent badge if EXCEEDED */}
                {isExceeded && (
                  <div className="mb-3 flex items-center space-x-2 p-3 rounded-lg bg-red-100 border border-red-300">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-semibold text-red-700">
                      ⚠️ BUDGET EXCEEDED!
                    </span>
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{budget.category}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {budget.monthly_limit} AED / month
                    </p>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleEdit(budget)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Spent</span>
                      <span className="font-semibold">{budget.actual_spending.toFixed(2)} AED</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isExceeded ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-500">{percentageUsed.toFixed(1)}% used</span>
                      <span className={`font-medium ${budget.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(budget.remaining).toFixed(2)} AED {budget.remaining >= 0 ? 'left' : 'over'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete Budget"
        message="Are you sure you want to delete this budget? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => { setConfirmOpen(false); setDeleteId(null) }}
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-50 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-900">
                {editingBudget ? 'Edit Budget' : 'Create Budget'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  disabled={!!editingBudget}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Limit (AED)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.monthly_limit}
                  onChange={(e) => setFormData({ ...formData, monthly_limit: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alert Threshold (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.alert_threshold}
                  onChange={(e) => setFormData({ ...formData, alert_threshold: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You'll be alerted when spending reaches this percentage
                </p>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingBudget ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingBudget(null)
                    setFormData({ category: '', monthly_limit: '', alert_threshold: '80' })
                  }}
                  className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
