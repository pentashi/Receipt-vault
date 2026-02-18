import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ConfirmDialog from './ConfirmDialog';
import { Store, Trash2, Edit, Eye, Download } from 'lucide-react';
import { getReceipts, deleteReceipt, getCategories, updateReceipt } from '../services/api';


export default function ReceiptList() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string|null>(null);
  const [receipts, setReceipts] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    store_name: '',
    category: '',
    start_date: '',
    end_date: ''
  })
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null)
  const [editingReceipt, setEditingReceipt] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    store_name: '',
    category: '',
    date: '',
    total_incl_vat: '',
    vat_amount: '',
    payment_method: ''
  })

  // Log loading state on every render
  console.log('ReceiptList render: loading =', loading)

  // Log loading state changes
  useEffect(() => {
    console.log('useEffect: loading changed to', loading)
  }, [loading])

  useEffect(() => {
    loadData()
  }, [])

  // Apply filters whenever any filter changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const hasAnyFilter = Object.values(filters).some(v => v !== '');
      if (hasAnyFilter) {
        applyFilters();
      } else {
        loadData();
      }
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  // Export receipts to CSV
  const handleExport = () => {
    if (!receipts || receipts.length === 0) {
      alert('No receipts to export.');
      return;
    }
    const headers = [
      'Store Name',
      'Category',
      'Date',
      'Total (AED)',
      'VAT (AED)',
      'Payment Method',
      'Items'
    ];
    const rows = receipts.map(r => [
      r.store_name,
      r.category,
      r.date,
      r.total_incl_vat,
      r.vat_amount,
      r.payment_method || '',
      r.items && r.items.length > 0 ? r.items.map((i: any) => `${i.name} (${i.price})`).join('; ') : ''
    ]);
    const csvContent = [headers, ...rows]
      .map(e => e.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'receipts.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadData = async () => {
    try {
      setLoading(true)
      const [receiptsData, categoriesData] = await Promise.all([
        getReceipts(),
        getCategories()
      ])
      setReceipts(receiptsData.receipts || [])
      setCategories(categoriesData.categories || [])
      console.log('Loaded receipts:', receiptsData.receipts)
      console.log('Receipts loaded: ' + (receiptsData.receipts ? receiptsData.receipts.length : 0));
    } catch (error) {
      console.error('Error loading receipts:', error)
    } finally {
      console.log('Setting loading to false (loadData)')
      setLoading(false)
      console.log('Loading state after setLoading(false) (loadData):', loading)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const applyFilters = async () => {
    try {
      setLoading(true)
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      )
      const data = await getReceipts(activeFilters)
      setReceipts(data.receipts || [])
      console.log('Filtered receipts:', data.receipts)
    } catch (error) {
      console.error('Error applying filters:', error)
    } finally {
      console.log('Setting loading to false (applyFilters)')
      setLoading(false)
      console.log('Loading state after setLoading(false) (applyFilters):', loading)
    }
  }

  const handleDelete = (receiptId: string) => {
    setPendingDeleteId(receiptId);
    setConfirmOpen(true);
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteReceipt(pendingDeleteId);
      setReceipts(receipts.filter(r => r.receipt_id !== pendingDeleteId));
      toast.success('Receipt deleted successfully');
    } catch (error) {
      console.error('Error deleting receipt:', error);
      toast.error('Failed to delete receipt');
    } finally {
      setConfirmOpen(false);
      setPendingDeleteId(null);
    }
  }

  const handleEdit = (receipt: any) => {
    setEditingReceipt(receipt)
    setEditForm({
      store_name: receipt.store_name,
      category: receipt.category,
      date: receipt.date,
      total_incl_vat: receipt.total_incl_vat.toString(),
      vat_amount: receipt.vat_amount.toString(),
      payment_method: receipt.payment_method || ''
    })
  }

  const handleSaveEdit = async () => {
    if (!editingReceipt) return;
    try {
      const response = await updateReceipt(editingReceipt.receipt_id, editForm);
      setReceipts(receipts.map(r =>
        r.receipt_id === editingReceipt.receipt_id ? response.receipt : r
      ));
      setEditingReceipt(null);
      toast.success('Receipt updated successfully!');
    } catch (error) {
      console.error('Error updating receipt:', error);
      toast.error('Failed to update receipt');
    }
  }

  return (
    <>
      <div className="text-3xl font-extrabold text-primary-700 mb-8 text-center">
        MY RECEIPTS
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading receipts...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Total Receipts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{receipts.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Total Spent</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {receipts.reduce((sum, r) => sum + parseFloat(r.total_incl_vat), 0).toFixed(2)} AED
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Total VAT</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {receipts.reduce((sum, r) => sum + parseFloat(r.vat_amount), 0).toFixed(2)} AED
              </p>
            </div>
          </div>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Filter Receipts</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Store Name
                </label>
                <input
                  type="text"
                  value={filters.store_name}
                  onChange={(e) => handleFilterChange('store_name', e.target.value)}
                  placeholder="Search by store"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
            <div className="mt-4 flex space-x-3">
              <button
                onClick={applyFilters}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Apply Filters
              </button>
              <button
                onClick={() => {
                  setFilters({ store_name: '', category: '', start_date: '', end_date: '' })
                  loadData()
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleExport}
                className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ml-auto"
              >
                <Download className="w-5 h-5" />
                <span>Export to CSV</span>
              </button>
            </div>
          </div>
          {/* Receipts List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">
                All Receipts ({receipts.length})
              </h3>
            </div>
            {receipts.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No receipts found. Upload your first receipt to get started!
              </div>
            ) : (
              <div className="divide-y">
                {receipts.map(receipt => (
                  <div key={receipt.receipt_id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <Store className="w-5 h-5 text-gray-400" />
                          <h4 className="font-semibold text-lg text-gray-900">{receipt.store_name}</h4>
                          <span className="px-2 py-1 border border-primary-600 text-primary-700 text-xs rounded-full font-medium">
                            {receipt.category}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-700 mt-3">
                          <div>
                            <span className="font-medium text-gray-900">Date:</span> {receipt.date}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">Total:</span> <span className="text-green-600 font-semibold">{receipt.total_incl_vat} AED</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">VAT:</span> {receipt.vat_amount} AED
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">Payment:</span> {receipt.payment_method || 'N/A'}
                          </div>
                        </div>
                        {receipt.items && receipt.items.length > 0 && (
                          <div className="mt-3 text-sm text-gray-500">
                            {receipt.items.length} item(s)
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => setSelectedReceipt(receipt)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(receipt)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit receipt"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(receipt.receipt_id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete receipt"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete Receipt"
        message="Are you sure you want to delete this receipt? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Receipts</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{receipts.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Spent</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {receipts.reduce((sum, r) => sum + parseFloat(r.total_incl_vat), 0).toFixed(2)} AED
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total VAT</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {receipts.reduce((sum, r) => sum + parseFloat(r.vat_amount), 0).toFixed(2)} AED
          </p>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Filter Receipts</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Store Name
            </label>
            <input
              type="text"
              value={filters.store_name}
              onChange={(e) => handleFilterChange('store_name', e.target.value)}
              placeholder="Search by store"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
            />
          </div>
        </div>
        
        <div className="mt-4 flex space-x-3">
          <button
            onClick={applyFilters}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Apply Filters
          </button>
          <button
            onClick={() => {
              setFilters({ store_name: '', category: '', start_date: '', end_date: '' })
              loadData()
            }}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ml-auto"
          >
            <Download className="w-5 h-5" />
            <span>Export to CSV</span>
          </button>
        </div>
      </div>

      {/* Receipts List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">
            All Receipts ({receipts.length})
          </h3>
        </div>
        
        {receipts.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No receipts found. Upload your first receipt to get started!
          </div>
        ) : (
          <div className="divide-y">
            <div style={{background: 'yellow', color: 'black', fontWeight: 'bold', padding: '8px', textAlign: 'center'}}>RECEIPT LIST RENDERED ({receipts.length})</div>
            {receipts.map((receipt: any) => (
              <div key={receipt.receipt_id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Store className="w-5 h-5 text-gray-400" />
                      <h4 className="font-semibold text-lg text-gray-900">{receipt.store_name}</h4>
                      <span className="px-2 py-1 border border-primary-600 text-primary-700 text-xs rounded-full font-medium">
                        {receipt.category}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-700 mt-3">
                      <div>
                        <span className="font-medium text-gray-900">Date:</span> {receipt.date}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">Total:</span> <span className="text-green-600 font-semibold">{receipt.total_incl_vat} AED</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">VAT:</span> {receipt.vat_amount} AED
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">Payment:</span> {receipt.payment_method || 'N/A'}
                      </div>
                    </div>
                    
                    {receipt.items && receipt.items.length > 0 && (
                      <div className="mt-3 text-sm text-gray-500">
                        {receipt.items.length} item(s)
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => setSelectedReceipt(receipt)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View details"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleEdit(receipt)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Edit receipt"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(receipt.receipt_id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete receipt"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Receipt Detail Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Receipt Details</h3>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Receipt Image */}
              {selectedReceipt.image_path && (
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-2">Receipt Image</p>
                  <img 
                    src={`${import.meta.env.VITE_API_URL}/uploads/${selectedReceipt.image_path.split('/').pop()}`}
                    alt="Receipt"
                    className="max-w-full h-auto border rounded-lg shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Store</p>
                  <p className="font-semibold">{selectedReceipt.store_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Category</p>
                  <p className="font-semibold">{selectedReceipt.category}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-semibold">{selectedReceipt.date}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Time</p>
                  <p className="font-semibold">{selectedReceipt.time || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total (Excl VAT)</p>
                  <p className="font-semibold">{selectedReceipt.total_excl_vat} AED</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">VAT Amount</p>
                  <p className="font-semibold">{selectedReceipt.vat_amount} AED</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total (Incl VAT)</p>
                  <p className="font-semibold text-lg text-primary-600">{selectedReceipt.total_incl_vat} AED</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Payment Method</p>
                  <p className="font-semibold">{selectedReceipt.payment_method || 'N/A'}</p>
                </div>
              </div>
              
              {selectedReceipt.items && selectedReceipt.items.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-3">Items</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Item</th>
                          <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Qty</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedReceipt.items.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm">{item.item_name}</td>
                            <td className="px-4 py-2 text-sm text-center">{item.quantity}</td>
                            <td className="px-4 py-2 text-sm text-right">{item.price} AED</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Receipt Modal */}
      {editingReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Edit Receipt</h3>
                <button
                  onClick={() => setEditingReceipt(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Store Name
                </label>
                <input
                  type="text"
                  value={editForm.store_name}
                  onChange={(e) => setEditForm({ ...editForm, store_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total (AED)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.total_incl_vat}
                    onChange={(e) => setEditForm({ ...editForm, total_incl_vat: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    VAT (AED)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.vat_amount}
                    onChange={(e) => setEditForm({ ...editForm, vat_amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={editForm.payment_method}
                  onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                >
                  <option value="">Unknown</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Digital Wallet">Digital Wallet</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t flex space-x-3">
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingReceipt(null)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
