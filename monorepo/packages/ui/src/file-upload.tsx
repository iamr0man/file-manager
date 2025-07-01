import React, { useCallback, useState } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from './button';

export interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  onRemoveFile?: (index: number) => void;
  maxFileSize?: number; // в байтах
  acceptedTypes?: string[];
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

export interface FileWithProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onRemoveFile,
  maxFileSize = 200 * 1024 * 1024, // 200MB
  acceptedTypes,
  multiple = true,
  disabled = false,
  className,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<FileWithProgress[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback((files: File[]) => {
    const validFiles: File[] = [];
    const newFiles: FileWithProgress[] = [];

    files.forEach((file) => {
      let isValid = true;
      let error = '';

      // Проверка размера файла
      if (file.size > maxFileSize) {
        isValid = false;
        error = `Файл слишком большой (${Math.round(file.size / 1024 / 1024)}MB)`;
      }

      // Проверка типа файла
      if (acceptedTypes && !acceptedTypes.includes(file.type)) {
        isValid = false;
        error = 'Неподдерживаемый тип файла';
      }

      if (isValid) {
        validFiles.push(file);
        newFiles.push({
          file,
          progress: 0,
          status: 'pending',
        });
      } else {
        newFiles.push({
          file,
          progress: 0,
          status: 'error',
          error,
        });
      }
    });

    setSelectedFiles(prev => [...prev, ...newFiles]);
    
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

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    onRemoveFile?.(index);
  }, [onRemoveFile]);

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
          Перетащите файлы сюда или нажмите для выбора
        </p>
        <p className="text-xs text-gray-500">
          Максимальный размер: {formatFileSize(maxFileSize)}
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

      {/* File List */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {selectedFiles.map((fileWithProgress, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-2 flex-1">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {fileWithProgress.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(fileWithProgress.file.size)}
                  </p>
                  
                  {fileWithProgress.status === 'error' && (
                    <div className="flex items-center mt-1">
                      <AlertCircle className="h-4 w-4 text-red-500 mr-1" />
                      <p className="text-xs text-red-600">{fileWithProgress.error}</p>
                    </div>
                  )}
                  
                  {fileWithProgress.status === 'uploading' && (
                    <div className="mt-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${fileWithProgress.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {fileWithProgress.progress}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 