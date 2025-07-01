import { type NextPage } from 'next';
import { useState, useMemo } from 'react';
import { FileUpload } from '@file-manager/ui';
import { trpc } from '../utils/trpc';
import { uploadFiles } from '../utils/upload';
import type { File as FileType } from '@file-manager/types';
import { FiSearch, FiChevronLeft, FiChevronRight, FiDownload, FiTrash2, FiEye, FiCheckCircle, FiAlertCircle, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

type SortField = 'name' | 'size' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 20];
const MAX_PREVIEW_SIZE = 20 * 1024 * 1024; // 20MB

const Home: NextPage = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [previewFile, setPreviewFile] = useState<FileType & { previewUrl: string | null } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const { data: filesResponse, isLoading, refetch } = trpc.list.useQuery({});
  const deleteMutation = trpc.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const handleFileSelect = async (files: File[]) => {
    if (!files.length) return;
    
    setSelectedFiles(files);
    const toastId = 'upload';
    
    try {
      toast.loading(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`, {
        id: toastId,
      });

      const result = await uploadFiles(files);
      await refetch();
      
      // Track uploaded files for visual feedback
      const uploadedFileNames = result.files
        ?.filter((f: any) => f.success)
        ?.map((f: any) => f.filename) || [];
      
      setUploadedFiles(uploadedFileNames);
      
      // Clear uploaded files indicator after 3 seconds
      setTimeout(() => {
        setUploadedFiles([]);
      }, 3000);
      
      // Clear the selected files
      setSelectedFiles([]);

      // Show detailed success/warning notification
      if (result.successfulFiles > 0) {
        let message = `Successfully uploaded ${result.successfulFiles} file${result.successfulFiles > 1 ? 's' : ''}`;
        
        if (result.skippedFiles > 0) {
          message += `, skipped ${result.skippedFiles} unsupported file${result.skippedFiles > 1 ? 's' : ''}`;
        }
        
        if (result.failedFiles > 0) {
          message += `, ${result.failedFiles} failed`;
        }
        
        toast.success(message, {
          id: toastId,
          duration: 4000,
        });
      } else {
        toast.error('No files were uploaded. Check file types and try again.', {
          id: toastId,
        });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed. Please try again.', {
        id: toastId,
      });
      // Clear the selected files on error
      setSelectedFiles([]);
    }
  };

  const handleDelete = async (fileId: string) => {
    const toastId = `delete-${fileId}`;
    try {
      toast.loading('Deleting file...', { id: toastId });
      await deleteMutation.mutateAsync({ 
        id: fileId,
        deletedBy: 'current-user' // We'll implement proper user management later
      });
      toast.success('File deleted successfully', { id: toastId });
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Delete failed. Please try again.', { id: toastId });
    }
  };

  const handleDownload = async (file: FileType) => {
    const toastId = `download-${file.id}`;
    try {
      toast.loading('Downloading file...', { id: toastId });
      
      // Get signed download URL from the API using fetch
      const response = await fetch(`http://localhost:3001/trpc/getDownloadUrl?input=${encodeURIComponent(JSON.stringify({ id: file.id }))}`);
      const downloadResponse = await response.json();
      
      if (!downloadResponse.result.data.success) {
        throw new Error(downloadResponse.result.data.error);
      }
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = downloadResponse.result.data.data.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Download started', { id: toastId });
    } catch (error) {
      console.error('Download failed:', error);
      const errorMessage = `Failed to download ${file.name}. Please try again later.`;
      toast.error(errorMessage, { id: toastId });
    }
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const isPreviewSupported = (file: FileType): boolean => {
    const supportedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];
    return supportedTypes.includes(file.mimeType) && file.size <= MAX_PREVIEW_SIZE;
  };

  const handlePreview = (file: FileType & { previewUrl: string | null }) => {
    if (!isPreviewSupported(file)) {
      toast.error('Preview not supported for this file type or size');
      return;
    }
    setPreviewFile(file);
  };

  const closePreview = () => {
    setPreviewFile(null);
  };

  // Sort and filter files
  const sortedAndFilteredFiles = useMemo(() => {
    if (!filesResponse?.success || !filesResponse.data) return [];

    let files = [...filesResponse.data];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      files = files.filter(file => 
        file.name.toLowerCase().includes(query) ||
        file.mimeType.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    files.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return files;
  }, [filesResponse, searchQuery, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedAndFilteredFiles.length / itemsPerPage);
  const paginatedFiles = sortedAndFilteredFiles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">File Manager</h1>
          
          {/* Upload Section */}
          <div className="mb-8">
            <FileUpload
              onFileSelect={handleFileSelect}
              maxFileSize={200 * 1024 * 1024} // 200MB
              multiple={true}
              disabled={false}
            />
            
            {/* Supported File Types Info */}
            <div className="mt-2 text-xs text-gray-500">
              <details className="cursor-pointer">
                <summary className="hover:text-gray-700">Supported file types</summary>
                <div className="mt-1 pl-4">
                  Images: JPEG, PNG, GIF, WebP, SVG<br/>
                  Documents: PDF, Word, Excel<br/>
                  Text: TXT, CSV, JSON, HTML<br/>
                  Archives: ZIP, RAR, 7Z<br/>
                  Media: MP4, MPEG, QuickTime, MP3, WAV, OGG<br/>
                  Other: DMG files
                </div>
              </details>
            </div>
            
            {/* Selected Files Preview */}
            {selectedFiles.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  Selected Files ({selectedFiles.length})
                </h3>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="text-blue-700">{file.name}</span>
                        <span className="text-blue-500">({formatFileSize(file.size)})</span>
                      </div>
                      <div className="text-blue-600">
                        <FiCheckCircle size={16} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search and Filter Section */}
          <div className="mb-6 flex items-center space-x-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {ITEMS_PER_PAGE_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option} per page
                </option>
              ))}
            </select>
          </div>

          {/* Files Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Name {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('size')}
                    className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Size {sortField === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    onClick={() => handleSort('createdAt')}
                    className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Uploaded {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : paginatedFiles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                      No files found
                    </td>
                  </tr>
                ) : (
                  paginatedFiles.map((file) => (
                    <tr key={file.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <span>{file.name}</span>
                          {uploadedFiles.includes(file.name) && (
                            <FiCheckCircle className="text-green-500 animate-pulse" size={16} />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(file.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleDownload(file)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <FiDownload className="inline-block" />
                        </button>
                        {isPreviewSupported(file) && (
                          <button
                            onClick={() => handlePreview(file)}
                            className="text-green-600 hover:text-green-900"
                          >
                            <FiEye className="inline-block" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(file.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FiTrash2 className="inline-block" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">
                      {(currentPage - 1) * itemsPerPage + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, sortedAndFilteredFiles.length)}
                    </span>{' '}
                    of{' '}
                    <span className="font-medium">{sortedAndFilteredFiles.length}</span>{' '}
                    results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                    >
                      <FiChevronLeft className="h-5 w-5" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === currentPage
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                    >
                      <FiChevronRight className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={closePreview}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      {previewFile.name}
                    </h3>
                    {previewFile.previewUrl ? (
                      previewFile.mimeType.startsWith('image/') ? (
                        <img
                          src={previewFile.previewUrl}
                          alt={previewFile.name}
                          className="max-w-full max-h-[70vh] object-contain mx-auto"
                        />
                      ) : (
                        <iframe
                          src={previewFile.previewUrl}
                          title={previewFile.name}
                          className="w-full h-[70vh]"
                        />
                      )
                    ) : (
                      <div className="text-center text-gray-500">
                        Preview not available
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={closePreview}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home; 