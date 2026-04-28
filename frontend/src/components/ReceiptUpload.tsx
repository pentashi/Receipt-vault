import { useState } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader2, Sparkles, Camera, X, Zap, Receipt } from 'lucide-react'
import { uploadReceipt } from '../services/api'

interface ReceiptUploadProps {
  onUploadSuccess: () => void
}

export default function ReceiptUpload({ onUploadSuccess }: ReceiptUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setSuccess(false)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first')
      return
    }

    try {
      setUploading(true)
      setError(null)
      
      await uploadReceipt(file)
      
      setSuccess(true)
      setFile(null)
      setPreview(null)
      
      setTimeout(() => {
        onUploadSuccess()
      }, 2000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process receipt. Please ensure it is a clear image.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-8 border-b dark:border-gray-800 bg-gradient-to-br from-primary-600 to-primary-800 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Sparkles className="w-24 h-24" />
          </div>
          <div className="relative z-10 flex items-center space-x-4">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">Smart Scan</h2>
              <p className="text-primary-100 text-sm font-bold opacity-80 uppercase tracking-widest">AI Extraction Engine</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Upload Area */}
          <div className={`relative border-2 border-dashed rounded-3xl p-1 transition-all ${
            preview ? 'border-primary-500 bg-primary-50/5' : 'border-gray-200 dark:border-gray-800 hover:border-primary-400 dark:hover:border-primary-500'
          }`}>
            {preview ? (
              <div className="relative p-4 text-center">
                <button 
                  onClick={() => { setFile(null); setPreview(null); }}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all z-20"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="relative inline-block group">
                  <img 
                    src={preview} 
                    alt="Receipt preview" 
                    className="max-h-96 mx-auto rounded-2xl shadow-2xl border-4 border-white dark:border-gray-800 transition-transform group-hover:scale-[1.01]"
                  />
                </div>
                <p className="mt-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Ready for analysis</p>
              </div>
            ) : (
              <div className="py-12 text-center group">
                <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-10 h-10 text-primary-500" />
                </div>
                <div>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="bg-primary-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-primary-700 shadow-xl shadow-primary-200 dark:shadow-none inline-block transition-all active:scale-95">
                      Choose File
                    </span>
                    <p className="mt-6 text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter">Or drag and drop your receipt</p>
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Benefits Icons */}
          {!preview && (
            <div className="grid grid-cols-3 gap-4 pt-4">
              {[
                { label: 'Categorize', icon: Sparkles },
                { label: 'VAT Scan', icon: Zap },
                { label: 'Line Items', icon: Receipt }
              ].map((item, i) => (
                <div key={i} className="text-center p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                  <item.icon className="w-5 h-5 text-primary-500 mx-auto mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Status Messages */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 rounded-2xl p-4 flex items-start animate-in zoom-in duration-300">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
              <div>
                <p className="text-sm font-black text-red-800 dark:text-red-200 uppercase tracking-tight">Processing Error</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-bold">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/40 rounded-2xl p-8 text-center animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-xl font-black text-green-800 dark:text-green-200 uppercase tracking-tight">Success!</p>
              <p className="text-sm text-green-600 dark:text-green-400 font-bold mt-1">Receipt vault entry confirmed.</p>
            </div>
          )}

          {/* Upload Button */}
          {!success && (
            <div className="pt-4">
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-lg transition-all flex items-center justify-center space-x-3 ${
                  !file || uploading
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700 shadow-2xl shadow-primary-200 dark:shadow-none active:scale-[0.98]'
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-6 h-6 fill-white" />
                    <span>Extract Data</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="text-center">
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] mb-4">Accepted Formats</p>
            <div className="flex justify-center space-x-3">
              {['PDF', 'JPG', 'PNG'].map(ext => (
                <span key={ext} className="px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg text-[10px] font-black text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700">{ext}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

