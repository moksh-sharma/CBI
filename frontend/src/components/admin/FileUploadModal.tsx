import { useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (config: { name: string; type: string; fileName: string; fileSize: number; uploadedAt: string }) => void;
  /** When provided, called with (file, name) to perform actual upload. Modal closes on success. */
  onUpload?: (file: File, name: string) => Promise<void>;
}

export default function FileUploadModal({ isOpen, onClose, onSave, onUpload }: FileUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dataSourceName, setDataSourceName] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setDataSourceName(file.name.replace(/\.[^/.]+$/, ''));
      setUploadStatus('idle');
      setErrorMessage('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !dataSourceName.trim()) {
      setErrorMessage('Please select a file and provide a name');
      setUploadStatus('error');
      return;
    }

    if (onUpload) {
      setUploadStatus('loading');
      setErrorMessage('');
      try {
        await onUpload(selectedFile, dataSourceName.trim());
        setUploadStatus('success');
        setTimeout(handleClose, 800);
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : 'Upload failed');
        setUploadStatus('error');
      }
      return;
    }

    setUploadStatus('success');
    setTimeout(() => {
      onSave?.({
        name: dataSourceName,
        type: getFileType(selectedFile.name),
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        uploadedAt: new Date().toISOString(),
      });
      handleClose();
    }, 1000);
  };

  const getFileType = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') return 'Excel';
    if (ext === 'csv') return 'CSV';
    if (ext === 'json') return 'JSON';
    if (ext === 'xml') return 'XML';
    return 'File';
  };

  const handleClose = () => {
    setSelectedFile(null);
    setDataSourceName('');
    setUploadStatus('idle');
    setErrorMessage('');
    onClose();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setDataSourceName(file.name.replace(/\.[^/.]+$/, ''));
      setUploadStatus('idle');
      setErrorMessage('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Upload Data File</h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Data Source Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Source Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={dataSourceName}
              onChange={(e) => setDataSourceName(e.target.value)}
              placeholder="e.g., Sales Data Q1 2024"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data File <span className="text-red-500">*</span>
            </label>
            <div 
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500 transition-colors"
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <label className="cursor-pointer">
                <span className="text-sm text-green-600 hover:text-green-700 font-medium">
                  Click to upload
                </span>
                <span className="text-sm text-gray-500"> or drag and drop</span>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".xlsx,.xls,.csv,.json,.xml,.txt"
                />
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Supported: Excel, CSV, JSON, XML, TXT
              </p>
            </div>
            {selectedFile && (
              <div className="mt-3 flex items-center text-sm text-gray-700 bg-gray-50 px-4 py-3 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{selectedFile.name}</p>
                  <p className="text-gray-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-600 ml-2 flex-shrink-0" />
              </div>
            )}
          </div>

          {/* Status Messages */}
          {uploadStatus === 'success' && (
            <div className="flex items-center text-sm text-green-700 bg-green-50 px-4 py-3 rounded-lg">
              <CheckCircle className="w-5 h-5 mr-2" />
              File uploaded successfully!
            </div>
          )}

          {uploadStatus === 'error' && errorMessage && (
            <div className="flex items-center text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg">
              <AlertCircle className="w-5 h-5 mr-2" />
              {errorMessage}
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Supported File Formats:</h4>
            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Excel:</strong> .xlsx, .xls (with headers in first row)</li>
              <li><strong>CSV:</strong> Comma-separated values</li>
              <li><strong>JSON:</strong> Array of objects or nested data</li>
              <li><strong>XML:</strong> Structured XML data</li>
              <li><strong>Text:</strong> Tab or comma delimited</li>
            </ul>
            <p className="text-xs text-blue-800 mt-2">
              Maximum file size: 10MB
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || !dataSourceName.trim() || uploadStatus === 'loading'}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {uploadStatus === 'loading' ? (
              <span className="animate-pulse">Uploading...</span>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload & Create
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
