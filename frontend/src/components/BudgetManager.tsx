import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Edit, Trash2, AlertTriangle, PieChart, Target, Zap } from 'lucide-react'
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

  useEffect(() => {
    budgets.forEach(budget => {
      const percentageUsed = budget.percentage_used || 0;
      const isWarning = percentageUsed >= budget.alert_threshold && !budget.is_exceeded;
      if (isWarning && !shownWarnings[budget.id]) {
        toast(() => (
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <span className="text-sm font-bold">
              Approaching limit for <span className="text-primary-600">{budget.category}</span>
            </span>
          </div>
        ), { duration: 4000 });
        setShownWarnings(prev => ({ ...prev, [budget.id]: true }));
      }
    });
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
      // Load categories first or independently to ensure dropdown works even if budgets fail
      try {
        const categoriesData = await getCategories();
        setCategories(categoriesData.categories || []);
      } catch (catError) {
        console.error('Error loading categories:', catError);
        toast.error('Could not load expense categories');
      }

      try {
        const budgetsData = await getBudgets(currentMonth, currentYear);
        setBudgets(budgetsData.budgets || []);
      } catch (budgetError) {
        console.error('Error loading budgets:', budgetError);
        // Don't toast here if it's just an empty list or first time use
      }
    } catch (error) {
      console.error('General data loading error:', error)
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
        toast.success('Budget updated')
      } else {
        await createBudget({
          category: formData.category,
          monthly_limit: parseFloat(formData.monthly_limit),
          month: currentMonth,
          year: currentYear,
          alert_threshold: parseFloat(formData.alert_threshold)
        })
        toast.success('Budget created')
      }
      setShowModal(false)
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
      toast.success('Budget removed')
      loadData()
    } catch (error) {
      toast.error('Deletion failed')
    } finally {
      setConfirmOpen(false)
      setDeleteId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/40 rounded-2xl">
            <Target className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Budget Vault</h2>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              {new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingBudget(null)
            setFormData({ category: '', monthly_limit: '', alert_threshold: '80' })
            setShowModal(true)
          }}
          className="flex items-center justify-center space-x-2 px-8 py-4 bg-primary-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary-700 shadow-xl shadow-primary-200 dark:shadow-none transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>New Budget</span>
        </button>
      </div>

      {/* Budgets Grid */}
      {budgets.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-20 text-center">
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <PieChart className="w-10 h-10 text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm mb-6">No active budgets for this month</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-black uppercase tracking-widest text-xs hover:opacity-90 transition-all"
          >
            Setup Monthly Goals
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
                className={`bg-white dark:bg-gray-900 rounded-3xl shadow-sm border-2 p-6 transition-all group ${
                  isExceeded 
                    ? 'border-red-500 bg-red-50/10 dark:bg-red-950/5' 
                    : isWarning 
                      ? 'border-yellow-500 bg-yellow-50/10 dark:bg-yellow-950/5' 
                      : 'border-gray-100 dark:border-gray-800'
                }`}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/30 px-2 py-1 rounded mb-2 inline-block">
                      {budget.category}
                    </span>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                      {budget.monthly_limit.toLocaleString()} <span className="text-xs font-normal opacity-50">AED</span>
                    </h3>
                  </div>
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(budget)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-baseline mb-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Spending Progress</p>
                      <p className={`text-sm font-black ${isExceeded ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-gray-900 dark:text-white'}`}>
                        {budget.actual_spending.toFixed(0)} <span className="text-[10px] font-normal">AED</span>
                      </p>
                    </div>
                    
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isExceeded ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-primary-600'
                        }`}
                        style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">
                        {percentageUsed.toFixed(0)}% Utilized
                      </span>
                      <div className="flex items-center space-x-1">
                        {isExceeded ? (
                          <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter bg-red-100 dark:bg-red-950 px-2 py-0.5 rounded">
                            {Math.abs(budget.remaining).toFixed(0)} AED OVER
                          </span>
                        ) : (
                          <span className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-tighter bg-green-100 dark:bg-green-950 px-2 py-0.5 rounded">
                            {budget.remaining.toFixed(0)} AED LEFT
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {isExceeded && (
                    <div className="flex items-center space-x-2 p-3 bg-red-100 dark:bg-red-950 rounded-2xl border border-red-200 dark:border-red-900/50 animate-pulse">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span className="text-[10px] font-black text-red-800 dark:text-red-200 uppercase tracking-widest">Critical: Limit Exceeded</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <ConfirmDialog
        open={confirmOpen}
        title="Remove Budget Goal"
        message="Are you sure you want to delete this budget tracking? This will stop alerts for this category."
        onConfirm={confirmDelete}
        onCancel={() => { setConfirmOpen(false); setDeleteId(null) }}
        confirmText="Confirm Delete"
        cancelText="Keep Budget"
      />

      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border dark:border-gray-800">
            <div className="p-8 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                {editingBudget ? 'Adjust Budget' : 'Set New Goal'}
              </h3>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">AED Currency</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  disabled={!!editingBudget}
                  required
                  className="w-full px-4 py-4 border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3">
                    Monthly Limit
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.monthly_limit}
                    onChange={(e) => setFormData({ ...formData, monthly_limit: e.target.value })}
                    required
                    className="w-full px-4 py-4 border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white font-black focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3">
                    Alert At (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.alert_threshold}
                    onChange={(e) => setFormData({ ...formData, alert_threshold: e.target.value })}
                    required
                    className="w-full px-4 py-4 border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>
              
              <div className="flex flex-col space-y-3 pt-4">
                <button
                  type="submit"
                  className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary-700 shadow-xl shadow-primary-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center space-x-2"
                >
                  <Zap className="w-4 h-4 fill-white" />
                  <span>{editingBudget ? 'Save Changes' : 'Activate Budget'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingBudget(null)
                    setFormData({ category: '', monthly_limit: '', alert_threshold: '80' })
                  }}
                  className="w-full py-4 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-[10px] hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
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
