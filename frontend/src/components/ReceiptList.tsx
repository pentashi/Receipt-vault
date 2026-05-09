import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ConfirmDialog from './ConfirmDialog';
import { Store, Trash2, Edit, Eye, Download, Calendar, CreditCard, Search, SlidersHorizontal, Package, X, Plus, MapPin, Phone, Hash, Info } from 'lucide-react';
import { getReceipts, deleteReceipt, getCategories, updateReceipt, createManualReceipt } from '../services/api';

export default function ReceiptList() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string|null>(null);
  const [receipts, setReceipts] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showManualModal, setShowManualModal] = useState(false)
  const [filters, setFilters] = useState({
    store_name: '',
    item_name: '',
    category: '',
    start_date: '',
    end_date: ''
  })
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null)
  const [editingReceipt, setEditingReceipt] = useState<any>(null)
  
  const [manualForm, setManualForm] = useState({
    store_name: '',
    category: 'Other',
    date: new Date().toISOString().split('T')[0],
    total_incl_vat: '',
    vat_amount: '',
    payment_method: 'Cash',
    notes: ''
  })

  const [editForm, setEditForm] = useState({
    store_name: '',
    category: '',
    date: '',
    total_incl_vat: '',
    vat_amount: '',
    payment_method: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  // Fix: Improved search logic - debounce search for store_name and item_name
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      applyFilters();
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [filters.store_name, filters.item_name]);

  // Apply other filters immediately
  useEffect(() => {
    applyFilters();
  }, [filters.category, filters.start_date, filters.end_date]);

  const handleExport = () => {
    if (!receipts || receipts.length === 0) {
      toast.error('No receipts to export.');
      return;
    }
    const headers = ['Store Name', 'Category', 'Date', 'Total (AED)', 'VAT (AED)', 'Payment Method', 'Items'];
    const rows = receipts.map(r => [
      r.store_name, r.category, r.date, r.total_incl_vat, r.vat_amount, r.payment_method || '',
      r.items && r.items.length > 0 ? r.items.map((i: any) => `${i.item_name} (${i.price})`).join('; ') : ''
    ]);
    const csvContent = [headers, ...rows]
      .map(e => e.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ReceiptVault_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load categories first for dropdowns
      try {
        const categoriesData = await getCategories();
        setCategories(categoriesData.categories || []);
      } catch (catErr) {
        console.error('Failed to load categories:', catErr);
      }

      // Then load receipts
      try {
        const receiptsData = await getReceipts();
        setReceipts(receiptsData.receipts || []);
      } catch (recErr) {
        console.error('Failed to load receipts:', recErr);
        toast.error('Could not retrieve receipt records');
      }
    } catch (error) {
      console.error('General error loading record data:', error)
    } finally {
      setLoading(false)
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
    } catch (error) {
      console.error('Error applying filters:', error)
    } finally {
      setLoading(false)
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
      toast.success('Record deleted');
    } catch (error) {
      toast.error('Deletion failed');
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
      toast.success('Receipt corrected');
    } catch (error) {
      toast.error('Update failed');
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await createManualReceipt(manualForm);
      setReceipts([response.receipt, ...receipts]);
      setShowManualModal(false);
      setManualForm({
        store_name: '',
        category: 'Other',
        date: new Date().toISOString().split('T')[0],
        total_incl_vat: '',
        vat_amount: '',
        payment_method: 'Cash',
        notes: ''
      });
      toast.success('Manual entry added to vault');
    } catch (error) {
      toast.error('Failed to add manual entry');
    }
  }

  const totalSpent = receipts.reduce((sum, r) => sum + parseFloat(r.total_incl_vat), 0);

  const handleDownloadImage = async (receipt: any) => {
    if (!receipt?.image_path) {
      toast.error('No image available for this receipt');
      return;
    }

    const fileName = `Receipt_${(receipt.store_name || 'Vault').replace(/[^\w.-]/g, '_')}_${receipt.date || 'image'}.jpg`;

    try {
      const response = await fetch(receipt.image_path);
      if (!response.ok) {
        throw new Error(`Image request failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      const fallbackLink = document.createElement('a');
      fallbackLink.href = receipt.image_path;
      fallbackLink.target = '_blank';
      fallbackLink.rel = 'noopener noreferrer';
      document.body.appendChild(fallbackLink);
      fallbackLink.click();
      document.body.removeChild(fallbackLink);
      toast('Download is blocked by source permissions; opened image in a new tab instead.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Mini Stats & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Vault Records</h2>
          <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-xs mt-1">Transaction History</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-white dark:bg-gray-900 px-6 py-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Vault Value</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{totalSpent.toLocaleString()} <span className="text-xs font-normal opacity-50">AED</span></p>
          </div>
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center space-x-2 px-6 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl hover:opacity-90 transition-all font-black uppercase tracking-widest text-[10px]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Manual</span>
          </button>
          <button
            onClick={handleExport}
            className="p-4 bg-primary-600 text-white rounded-2xl hover:bg-primary-700 shadow-xl shadow-primary-200 dark:shadow-none transition-all active:scale-95"
            title="Export to CSV"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Search & Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="relative flex-[2]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.store_name}
              onChange={(e) => handleFilterChange('store_name', e.target.value)}
              placeholder="Search merchants..."
              className="w-full pl-11 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold"
            />
          </div>
          <div className="relative flex-1">
            <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.item_name}
              onChange={(e) => handleFilterChange('item_name', e.target.value)}
              placeholder="Search items..."
              className="w-full pl-11 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold"
            />
          </div>
          <button className="p-4 bg-gray-50 dark:bg-gray-800 text-gray-400 rounded-2xl hover:bg-gray-100 transition-colors">
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold text-sm"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => handleFilterChange('start_date', e.target.value)}
            className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold text-sm"
          />
          
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => handleFilterChange('end_date', e.target.value)}
            className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold text-sm"
          />
        </div>
      </div>

      {/* Receipts List */}
      <div className="space-y-4 relative min-h-[200px]">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-950/50 z-20 backdrop-blur-[1px] flex items-center justify-center rounded-3xl">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        )}
        
        {receipts.length === 0 && !loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-20 text-center border-2 border-dashed border-gray-100 dark:border-gray-800">
            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm">No records match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {receipts.map((receipt: any) => (
              <div 
                key={receipt.receipt_id} 
                className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 hover:border-primary-500 dark:hover:border-primary-500 transition-all group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center space-x-5">
                    <div className="w-14 h-14 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-gray-700 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
                      <Store className="w-6 h-6 text-gray-400 group-hover:text-primary-600 transition-colors" />
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 dark:text-white text-lg leading-tight mb-1">{receipt.store_name}</h4>
                      <div className="flex items-center space-x-3">
                        <span className="text-[10px] uppercase font-black tracking-widest text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/40 px-2 py-0.5 rounded">
                          {receipt.category}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {receipt.date}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end flex-1 gap-8">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Amount</p>
                      <p className="text-xl font-black text-gray-900 dark:text-white">{receipt.total_incl_vat} <span className="text-xs font-normal opacity-50">AED</span></p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Method</p>
                      <div className="flex items-center justify-end space-x-1 font-bold text-gray-700 dark:text-gray-300">
                        <CreditCard className="w-3 h-3" />
                        <span className="text-xs uppercase">{receipt.payment_method || '---'}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setSelectedReceipt(receipt)}
                        className="p-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleEdit(receipt)}
                        className="p-3 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-xl transition-all"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(receipt.receipt_id)}
                        className="p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border dark:border-gray-800">
            <div className="p-8 border-b dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 sticky top-0 z-10">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                  <Package className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Record View</h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-[0.2em] mt-0.5">VAULT ID: {selectedReceipt.receipt_id.split('-')[0]}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Image Section */}
                <div className="p-10 bg-gray-50 dark:bg-gray-950/50 flex items-center justify-center border-r dark:border-gray-800">
                  {selectedReceipt.image_path ? (
                    <div className="relative group">
                      <img 
                        src={selectedReceipt.image_path}
                        alt="Receipt"
                        className="max-w-full h-auto rounded-[2rem] shadow-2xl border-8 border-white dark:border-gray-800"
                      />
                      <a 
                        href={selectedReceipt.image_path} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute bottom-6 right-6 bg-white dark:bg-gray-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl opacity-0 group-hover:opacity-100 transition-all border dark:border-gray-800"
                      >
                        Enlarge Image
                      </a>
                      <button
                        onClick={() => handleDownloadImage(selectedReceipt)}
                        className="absolute bottom-6 left-6 bg-primary-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl opacity-0 group-hover:opacity-100 transition-all"
                      >
                        Download Image
                      </button>
                    </div>
                  ) : (
                    <div className="w-full aspect-[3/4] bg-gray-100 dark:bg-gray-800 rounded-3xl flex items-center justify-center">
                      <p className="text-gray-400 font-black uppercase tracking-widest">No Digital Image</p>
                    </div>
                  )}
                </div>

                {/* Data Section */}
                <div className="p-10 space-y-10">
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Merchant</p>
                      <p className="text-xl font-black text-gray-900 dark:text-white">{selectedReceipt.store_name}</p>
                      {selectedReceipt.address && (
                        <div className="flex items-start mt-2 text-gray-500 dark:text-gray-400">
                          <MapPin className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] font-bold leading-relaxed">{selectedReceipt.address}</p>
                        </div>
                      )}
                      {selectedReceipt.phone_number && (
                        <div className="flex items-center mt-1 text-gray-500 dark:text-gray-400">
                          <Phone className="w-3 h-3 mr-1 flex-shrink-0" />
                          <p className="text-[10px] font-bold">{selectedReceipt.phone_number}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Category</p>
                      <span className="px-3 py-1 bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 rounded-lg text-[10px] font-black uppercase tracking-widest">{selectedReceipt.category}</span>
                      {selectedReceipt.transaction_trn && (
                        <div className="mt-3 flex items-center text-gray-500 dark:text-gray-400">
                          <Hash className="w-3 h-3 mr-1" />
                          <p className="text-[10px] font-black">TRN: {selectedReceipt.transaction_trn}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Transaction Date</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedReceipt.date} at {selectedReceipt.time || '--:--'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Payment</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">{selectedReceipt.payment_method || 'Unknown'}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-3xl p-8 space-y-4 border dark:border-gray-700">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-500 dark:text-gray-400">
                      <span className="uppercase tracking-widest">Subtotal (Net)</span>
                      <span className="text-gray-900 dark:text-white">{selectedReceipt.total_excl_vat} AED</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-gray-500 dark:text-gray-400">
                      <span className="uppercase tracking-widest">VAT Amount ({selectedReceipt.vat_rate}%)</span>
                      <span className="text-gray-900 dark:text-white">{selectedReceipt.vat_amount} AED</span>
                    </div>
                    <div className="pt-4 mt-4 border-t dark:border-gray-700 flex justify-between items-baseline">
                      <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">Total Value</span>
                      <span className="text-4xl font-black text-primary-600 dark:text-primary-400">{selectedReceipt.total_incl_vat} <span className="text-sm font-normal opacity-50">AED</span></span>
                    </div>
                  </div>

                  {selectedReceipt.notes && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                      <div className="flex items-center space-x-2 mb-1">
                        <Info className="w-3 h-3 text-blue-600" />
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Notes</p>
                      </div>
                      <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">{selectedReceipt.notes}</p>
                    </div>
                  )}
                  
                  {selectedReceipt.items && selectedReceipt.items.length > 0 && (
                    <div className="pb-6 border-b dark:border-gray-800">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6">Line Itemization</h4>
                      <div className="space-y-3">
                        {selectedReceipt.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700">
                            <div className="flex-1">
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{item.item_name}</p>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Qty: {item.quantity}</p>
                            </div>
                            <p className="text-sm font-black text-gray-900 dark:text-white">{item.price} <span className="text-[10px] font-normal opacity-50">AED</span></p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedReceipt.raw_extraction && Object.keys(selectedReceipt.raw_extraction).length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4">Advanced AI Insights</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(selectedReceipt.raw_extraction).map(([key, value]: [string, any], idx) => {
                          // Filter out things we already show prominently
                          if (['supplier_name', 'receipt_date', 'total_amount', 'line_item', 'total_tax_amount'].includes(key)) return null;
                          return (
                            <div key={idx} className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl border dark:border-gray-700">
                              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{key.replace(/_/g, ' ')}</p>
                              <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate max-w-[150px]">{String(value)}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingReceipt && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden border dark:border-gray-800">
            <div className="p-8 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Modify Record</h3>
              <button onClick={() => setEditingReceipt(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Merchant Name</label>
                <input
                  type="text"
                  value={editForm.store_name}
                  onChange={(e) => setEditForm({ ...editForm, store_name: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Vault Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Total (AED)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.total_incl_vat}
                    onChange={(e) => setEditForm({ ...editForm, total_incl_vat: e.target.value })}
                    className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-green-600 font-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">VAT (AED)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.vat_amount}
                    onChange={(e) => setEditForm({ ...editForm, vat_amount: e.target.value })}
                    className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Payment Type</label>
                <select
                  value={editForm.payment_method}
                  onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold"
                >
                  <option value="Unknown">Unknown</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card / Apple Pay</option>
                  <option value="Digital Wallet">Digital Wallet (e&, careem)</option>
                </select>
              </div>
            </div>

            <div className="p-8 border-t dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex space-x-4">
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary-700 shadow-xl shadow-primary-200 dark:shadow-none transition-all active:scale-95"
              >
                Update Vault
              </button>
              <button
                onClick={() => setEditingReceipt(null)}
                className="px-8 py-4 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border dark:border-gray-700 rounded-2xl font-bold uppercase tracking-widest text-[10px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete Record"
        message="This will permanently remove the receipt from your vault and GCS storage. This action is irreversible."
        onConfirm={confirmDelete}
        onCancel={() => { setConfirmOpen(false); setPendingDeleteId(null); }}
        confirmText="Confirm Delete"
        cancelText="Cancel"
      />

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden border dark:border-gray-800">
            <form onSubmit={handleManualSubmit}>
              <div className="p-8 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Manual Spending</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Add entry without receipt</p>
                </div>
                <button type="button" onClick={() => setShowManualModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-5 max-h-[65vh] overflow-y-auto">
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Merchant / Expense Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g., Monthly Rent, Cash Purchase"
                      value={manualForm.store_name}
                      onChange={(e) => setManualForm({ ...manualForm, store_name: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Category</label>
                    <select
                      value={manualForm.category}
                      onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Total (AED)</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={manualForm.total_incl_vat}
                        onChange={(e) => setManualForm({ ...manualForm, total_incl_vat: e.target.value })}
                        className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-black"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">VAT (AED)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={manualForm.vat_amount}
                        onChange={(e) => setManualForm({ ...manualForm, vat_amount: e.target.value })}
                        className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Date</label>
                    <input
                      required
                      type="date"
                      value={manualForm.date}
                      onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Payment Type</label>
                    <select
                      value={manualForm.payment_method}
                      onChange={(e) => setManualForm({ ...manualForm, payment_method: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-bold"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Card">Card / Apple Pay</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Notes</label>
                    <textarea
                      value={manualForm.notes}
                      onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                      placeholder="Add any additional details..."
                      rows={2}
                      className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white font-medium resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 border-t dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex space-x-4">
                <button
                  type="submit"
                  className="flex-1 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-xl"
                >
                  Vault Transaction
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-8 py-4 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border dark:border-gray-700 rounded-2xl font-bold uppercase tracking-widest text-[10px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
