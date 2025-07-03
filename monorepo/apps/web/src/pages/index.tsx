import { type NextPage } from 'next';
import React, { useState, useMemo, useEffect } from 'react';
import { FileUpload } from '@file-manager/ui';
import { trpc } from '../utils/trpc';
import { uploadFiles, uploadFilesWithProgress } from '../utils/upload';
import type { File as FileType } from '@file-manager/types';
import { FiSearch, FiChevronLeft, FiChevronRight, FiDownload, FiTrash2, FiEye, FiCheckCircle, FiAlertCircle, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

type SortField = 'name' | 'size' | 'createdAt';
type SortOrder = 'asc' | 'desc';

interface SelectedFile {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress?: number; // 0-100
  uploadSpeed?: number; // bytes/second
  estimatedTimeRemaining?: number; // seconds
  error?: string;
}

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 20];
const MAX_PREVIEW_SIZE = 200 * 1024 * 1024; // 200MB

// Video Preview Component
interface VideoPreviewProps {
  file: FileType & { previewUrl: string | null };
  onError: (error: string) => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ file, onError }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getVideoUrl = async () => {
      try {
        // Try to get a signed URL for better CORS handling
        const response = await fetch(`http://localhost:3001/trpc/getDownloadUrl?input=${encodeURIComponent(JSON.stringify({ id: file.id }))}`);
        const downloadResponse = await response.json();
        
        if (downloadResponse.result.data.success) {
          setVideoUrl(downloadResponse.result.data.data.url);
        } else {
          // Fallback to direct URL
          setVideoUrl(file.previewUrl || file.url);
        }
      } catch (error) {
        console.error('Failed to get video URL:', error);
        setVideoUrl(file.previewUrl || file.url);
      } finally {
        setLoading(false);
      }
    };

    getVideoUrl();
  }, [file]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading video...</span>
      </div>
    );
  }

  return (
    <video
      src={videoUrl || undefined}
      controls
      className="max-w-full max-h-[70vh] mx-auto"
      onError={(e) => {
        const target = e.target as HTMLVideoElement;
        const errorMessage = target.error?.message || 'Unknown video error';
        onError(`Failed to load video: ${errorMessage}`);
      }}
      onLoadStart={() => console.log('Video loading started')}
      onCanPlay={() => console.log('Video can play')}
    >
      Your browser does not support the video tag.
    </video>
  );
};

const Home: NextPage = () => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [previewFile, setPreviewFile] = useState<FileType & { previewUrl: string | null } | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const { data: filesResponse, isLoading, refetch } = trpc.list.useQuery({});
  const deleteMutation = trpc.delete.useMutation({
    onSuccess: () => refetch(),
  });

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && previewFile) {
        closePreview();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewFile]);

  const handleFileSelect = async (files: File[]) => {
    if (!files.length) return;

    // Show warning for large file batches
    if (files.length > 20) {
      const batchCount = Math.ceil(files.length / 20);
      toast(
        `📦 Uploading ${files.length} files in ${batchCount} batches of up to 20 files each. This may take a while.`,
        { 
          duration: 6000,
          icon: '⚠️',
          style: {
            background: '#3b82f6',
            color: 'white',
          }
        }
      );
    }

    // Check if exceeding server limits
    if (files.length > 50) {
      toast.error(
        `Too many files selected (${files.length}). Maximum 50 files allowed per upload session.`,
        { duration: 8000 }
      );
      return;
    }
    
    // Convert File[] to SelectedFile[] with pending status
    const selectedFiles = files.map(file => ({
      file,
      status: 'pending' as const,
    }));
    
    setSelectedFiles(selectedFiles);
    const toastId = 'upload';
    
    try {
      // Set all files to uploading status
      setSelectedFiles(prev => 
        prev.map(sf => ({ ...sf, status: 'uploading' as const }))
      );
      
      const batchCount = Math.ceil(files.length / 20);
      const loadingMessage = files.length > 20 
        ? `Uploading ${files.length} files in ${batchCount} batches...`
        : `Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`;
      
      toast.loading(loadingMessage, {
        id: toastId,
      });

      const result = await uploadFilesWithProgress(files, (progressData) => {
        // Update progress for each file
        setSelectedFiles(prev => 
          prev.map(sf => {
            const fileProgress = progressData[sf.file.name];
            if (fileProgress) {
              return {
                ...sf,
                progress: fileProgress.progress,
                uploadSpeed: fileProgress.speed,
                estimatedTimeRemaining: fileProgress.timeRemaining,
              };
            }
            return sf;
          })
        );
      });
      await refetch();
      
      // Update individual file statuses based on upload result
      setSelectedFiles(prev => 
        prev.map(sf => {
          const uploadResult = result.files?.find(
            (f: any) => f.filename === sf.file.name
          );
          
          if (uploadResult) {
            return {
              ...sf,
              status: uploadResult.success ? 'done' as const : 'error' as const,
              error: uploadResult.error,
            };
          }
          
          return { ...sf, status: 'error' as const, error: 'Upload failed' };
        })
      );
      
      // Track uploaded files for visual feedback
      const uploadedFileNames = result.files
        ?.filter((f: any) => f.success)
        ?.map((f: any) => f.filename) || [];
      
      setUploadedFiles(uploadedFileNames);
      
      // Clear uploaded files indicator after 3 seconds
      setTimeout(() => {
        setUploadedFiles([]);
      }, 3000);
      
      // Clear selected files after upload completion
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
      
      // Set all files to error status
      setSelectedFiles(prev => 
        prev.map(sf => ({ 
          ...sf, 
          status: 'error' as const, 
          error: error instanceof Error ? error.message : 'Upload failed' 
        }))
      );
      
      toast.error(error instanceof Error ? error.message : 'Upload failed. Please try again.', {
        id: toastId,
      });
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
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/heic',
      'image/heif',
      
      // Documents
      'application/pdf',
      
      // Text files
      'text/plain',
      'text/csv',
      'application/json',
      'text/html',
      
      // Videos
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/webm',
      'video/x-ms-wmv',
      'video/avi',
      'video/mov',
    ];
    
    // Check for LRV files (typically have .lrv extension)
    const isLrvFile = file.name.toLowerCase().endsWith('.lrv');
    
    return (supportedTypes.includes(file.mimeType) || isLrvFile) && file.size <= MAX_PREVIEW_SIZE;
  };

  const handlePreview = async (file: FileType & { previewUrl: string | null }) => {
    if (!isPreviewSupported(file)) {
      const supportedTypes = [
        // Images
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'image/heic',
        'image/heif',
        
        // Documents
        'application/pdf',
        
        // Text files
        'text/plain',
        'text/csv',
        'application/json',
        'text/html',
        
        // Videos
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/webm',
        'video/x-ms-wmv',
        'video/avi',
        'video/mov',
      ];
      
      const isLrvFile = file.name.toLowerCase().endsWith('.lrv');
      const isUnsupportedType = !supportedTypes.includes(file.mimeType) && !isLrvFile;
      const isOversized = file.size > MAX_PREVIEW_SIZE;
      
      if (isUnsupportedType) {
        toast.error(`Preview not supported for ${file.mimeType} files`);
      } else if (isOversized) {
        toast.error(`Preview disabled for files larger than ${formatFileSize(MAX_PREVIEW_SIZE)} (file is ${formatFileSize(file.size)})`);
      } else {
        toast.error('Preview not available for this file');
      }
      return;
    }
    
    setPreviewFile(file);
    setPreviewContent(null);
    
    // Fetch content for text-based files
    if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
      setPreviewLoading(true);
      
      try {
        // Try to get content using the API endpoint with CORS headers
        const response = await fetch(`http://localhost:3001/trpc/getDownloadUrl?input=${encodeURIComponent(JSON.stringify({ id: file.id }))}`);
        const downloadResponse = await response.json();
        
        if (downloadResponse.result.data.success) {
          // Use the signed URL to fetch content
          const contentResponse = await fetch(downloadResponse.result.data.data.url);
          const content = await contentResponse.text();
          setPreviewContent(content);
        } else {
          throw new Error('Failed to get download URL');
        }
      } catch (error) {
        console.error('Failed to fetch preview content:', error);
        setPreviewContent('Failed to load preview content. The file may have CORS restrictions.');
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewContent(null);
    setPreviewLoading(false);
  };

  // Bulk operations
  const handleSelectFile = (fileId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedFileIds(prev => [...prev, fileId]);
    } else {
      setSelectedFileIds(prev => prev.filter(id => id !== fileId));
    }
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedFileIds(paginatedFiles.map(file => file.id));
    } else {
      setSelectedFileIds([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFileIds.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedFileIds.length} file(s)?`)) {
      return;
    }

    const toastId = 'bulk-delete';
    try {
      toast.loading(`Deleting ${selectedFileIds.length} files...`, { id: toastId });
      
      await Promise.all(
        selectedFileIds.map(fileId => 
          deleteMutation.mutateAsync({ 
            id: fileId,
            deletedBy: 'current-user'
          })
        )
      );
      
      toast.success(`Successfully deleted ${selectedFileIds.length} files`, { id: toastId });
      setSelectedFileIds([]);
    } catch (error) {
      console.error('Bulk delete failed:', error);
      toast.error('Some files could not be deleted. Please try again.', { id: toastId });
    }
  };

  const handleBulkDownload = async () => {
    if (selectedFileIds.length === 0) return;

    const toastId = 'bulk-download';
    try {
      toast.loading(`Preparing ${selectedFileIds.length} files for download...`, { id: toastId });
      
      for (const fileId of selectedFileIds) {
        const file = sortedAndFilteredFiles.find(f => f.id === fileId);
        if (file) {
          await handleDownload(file);
        }
      }
      
      toast.success(`Started download of ${selectedFileIds.length} files`, { id: toastId });
    } catch (error) {
      console.error('Bulk download failed:', error);
      toast.error('Some files could not be downloaded.', { id: toastId });
    }
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
              maxFileSize={1024 * 1024 * 1024} // 1GB
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
                {selectedFiles.map((selectedFile, index) => (
                  <div key={index} className="space-y-2 mb-3 last:mb-0">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2 flex-1">
                        <span className={`${
                          selectedFile.status === 'done' ? 'text-green-700' : 
                          selectedFile.status === 'error' ? 'text-red-700' : 
                          'text-blue-700'
                        }`}>{selectedFile.file.name}</span>
                        <span className="text-gray-500">({formatFileSize(selectedFile.file.size)})</span>
                        
                        {selectedFile.status === 'pending' && <FiCheckCircle size={16} className="text-blue-600" />}
                        {selectedFile.status === 'uploading' && <FiCheckCircle size={16} className="animate-spin text-blue-600" />}
                        {selectedFile.status === 'done' && <FiCheckCircle size={16} className="text-green-500" />}
                        {selectedFile.status === 'error' && <FiAlertCircle size={16} className="text-red-500" />}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {selectedFile.status === 'error' && selectedFile.error && (
                          <span className="text-xs text-red-600" title={selectedFile.error}>
                            {selectedFile.error.substring(0, 30)}...
                          </span>
                        )}
                        <button
                          onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <FiX size={16} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    {selectedFile.status === 'uploading' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{selectedFile.progress ? `${selectedFile.progress}%` : '0%'}</span>
                          <div className="flex space-x-2">
                            {selectedFile.uploadSpeed && (
                              <span>{formatFileSize(selectedFile.uploadSpeed)}/s</span>
                            )}
                            {selectedFile.estimatedTimeRemaining && (
                              <span>
                                {selectedFile.estimatedTimeRemaining > 60 
                                  ? `${Math.floor(selectedFile.estimatedTimeRemaining / 60)}m ${Math.floor(selectedFile.estimatedTimeRemaining % 60)}s` 
                                  : `${Math.floor(selectedFile.estimatedTimeRemaining)}s`} remaining
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${selectedFile.progress || 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search and Filter Section */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
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

            {/* Bulk Actions */}
            {selectedFileIds.length > 0 && (
              <div className="flex items-center space-x-2 ml-4">
                <span className="text-sm text-gray-600">
                  {selectedFileIds.length} selected
                </span>
                <button
                  onClick={handleBulkDownload}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FiDownload className="mr-2 h-4 w-4" />
                  Download
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <FiTrash2 className="mr-2 h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Files Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedFileIds.length === paginatedFiles.length && paginatedFiles.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
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
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : paginatedFiles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No files found
                    </td>
                  </tr>
                ) : (
                  paginatedFiles.map((file) => (
                    <tr key={file.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input
                          type="checkbox"
                          checked={selectedFileIds.includes(file.id)}
                          onChange={(e) => handleSelectFile(file.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
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
                    {previewLoading ? (
                      <div className="flex items-center justify-center h-[70vh]">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2">Loading preview...</span>
                      </div>
                    ) : previewFile.mimeType.startsWith('image/') ? (
                      <img
                        src={previewFile.previewUrl || previewFile.url}
                        alt={previewFile.name}
                        className="max-w-full max-h-[70vh] object-contain mx-auto"
                      />
                    ) : previewFile.mimeType.startsWith('video/') || previewFile.name.toLowerCase().endsWith('.lrv') ? (
                      previewContent && previewContent.startsWith('Video preview failed:') ? (
                        <div className="text-center text-red-500 bg-red-50 p-4 rounded-md">
                          {previewContent}
                        </div>
                      ) : (
                        <VideoPreview 
                          file={previewFile}
                          onError={(error: string) => {
                            console.error('Video preview error:', error);
                            setPreviewContent(`Video preview failed: ${error}`);
                          }}
                        />
                      )
                    ) : previewFile.mimeType === 'application/pdf' ? (
                      <iframe
                        src={previewFile.previewUrl || previewFile.url}
                        title={previewFile.name}
                        className="w-full h-[70vh]"
                      />
                    ) : previewFile.mimeType === 'text/csv' ? (
                      <div className="max-h-[70vh] overflow-auto">
                        {previewContent ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <tbody className="bg-white divide-y divide-gray-200">
                                {previewContent.split('\n').slice(0, 100).map((row, index) => (
                                  <tr key={index} className={index === 0 ? 'bg-gray-50' : ''}>
                                    {row.split(',').map((cell, cellIndex) => (
                                      <td key={cellIndex} className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 border-r">
                                        {cell.trim()}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {previewContent.split('\n').length > 100 && (
                              <div className="text-center text-gray-500 mt-2">
                                Showing first 100 rows...
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center text-gray-500">
                            Failed to load CSV content
                          </div>
                        )}
                      </div>
                    ) : (previewFile.mimeType.startsWith('text/') || previewFile.mimeType === 'application/json') ? (
                      <div className="max-h-[70vh] overflow-auto">
                        {previewContent ? (
                          <pre className="bg-gray-100 p-4 rounded-md text-sm whitespace-pre-wrap">
                            {previewContent}
                          </pre>
                        ) : (
                          <div className="text-center text-gray-500">
                            Failed to load text content
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500">
                        Preview not available for this file type
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