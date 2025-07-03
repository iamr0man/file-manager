import React, { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import { clsx } from 'clsx';

export interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  maxFileSize?: number; // in bytes
  acceptedTypes?: string[];
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  maxFileSize = 1024 * 1024 * 1024, // 1GB
  acceptedTypes,
  multiple = true,
  disabled = false,
  className,
}) => {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback((files: File[]) => {
    const validFiles: File[] = [];

    files.forEach((file) => {
      let isValid = true;

      // Check file size
      if (file.size > maxFileSize) {
        isValid = false;
      }

      // Check file type
      if (acceptedTypes && !acceptedTypes.includes(file.type)) {
        isValid = false;
      }

      if (isValid) {
        validFiles.push(file);
      }
    });

    if (validFiles.length > 0) {
      onFileSelect(validFiles);
    }
  }, [maxFileSize, acceptedTypes, onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [handleFiles, disabled]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  }, [handleFiles]);



  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={clsx('w-full', className)}>
      {/* Drag & Drop Area */}
      <div
        className={clsx(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'
        )}
        onDragEnter={() => !disabled && setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !disabled && document.getElementById('file-input')?.click()}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-sm text-gray-600 mb-2">
          Drag files here or click to select
        </p>
        <p className="text-xs text-gray-500">
          Maximum size: {formatFileSize(maxFileSize)} • Maximum 50 files per upload
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Files are uploaded in batches of 20 for large selections
        </p>
        
        <input
          id="file-input"
          type="file"
          multiple={multiple}
          accept={acceptedTypes?.join(',')}
          onChange={handleChange}
          disabled={disabled}
          className="hidden"
        />
      </div>


    </div>
  );
}; 