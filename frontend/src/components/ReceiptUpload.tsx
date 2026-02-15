import { useState } from 'react'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { uploadReceipt } from '../services/api'
import toast from 'react-hot-toast'

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
      // Create preview
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
      setError(err.response?.data?.error || 'Failed to upload receipt')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Upload Receipt</h2>

        {/* Upload Area */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          {preview ? (
            <div className="space-y-4">
              <img 
                src={preview} 
                alt="Receipt preview" 
                className="max-h-96 mx-auto rounded-lg shadow"
              />
              <button
                onClick={() => {
                  setFile(null)
                  setPreview(null)
                }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Remove image
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="w-16 h-16 mx-auto text-gray-400" />
              <div>
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-primary-600 hover:text-primary-700 font-medium">
                    Click to upload
                  </span>
                  <span className="text-gray-600"> or drag and drop</span>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <p className="text-sm text-gray-500">
                PNG, JPG, JPEG or PDF (max 16MB)
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
            <span className="text-sm text-green-700">
              Receipt uploaded successfully! Redirecting...
            </span>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className={`mt-6 w-full py-3 rounded-lg font-medium transition-colors ${
            !file || uploading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          {uploading ? 'Processing...' : 'Upload & Scan Receipt'}
        </button>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Tips for best results:</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Ensure the receipt is well-lit and clearly visible</li>
            <li>Capture the entire receipt including store name and totals</li>
            <li>Avoid shadows and glare on the receipt</li>
            <li>Keep the camera steady for a clear image</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
