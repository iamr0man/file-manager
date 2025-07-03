interface UploadResponse {
  success: boolean;
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  skippedFiles: number;
  files: Array<{
    filename: string;
    success: boolean;
    file: any;
    error?: string;
    skipped: boolean;
  }>;
}

export const uploadFiles = async (files: File[]): Promise<UploadResponse> => {
  const formData = new FormData();
  
  files.forEach((file) => {
    formData.append('files', file);
  });

  try {
    const response = await fetch('http://localhost:3001/api/files/upload-batch', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || 
        `Upload failed with status ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  } catch (error) {
    console.error('Upload error details:', error);
    throw error;
  }
};

// Constants for upload batching
const MAX_BATCH_SIZE = 20; // Upload files in batches of 20 to avoid server limits
const MAX_SERVER_LIMIT = 50; // Server's maximum file limit

// Helper function to chunk array into smaller arrays
const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

// Single batch upload with progress
const uploadBatchWithProgress = async (
  files: File[],
  batchIndex: number,
  totalBatches: number,
  onProgress?: (progress: { [fileName: string]: { progress: number; speed: number; timeRemaining: number } }) => void
): Promise<UploadResponse> => {
  const formData = new FormData();
  
  files.forEach((file) => {
    formData.append('files', file);
  });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const currentTime = Date.now();
        const timeElapsed = (currentTime - lastTime) / 1000; // seconds
        const bytesUploaded = event.loaded - lastLoaded;
        const uploadSpeed = timeElapsed > 0 ? bytesUploaded / timeElapsed : 0;
        
        const progress = (event.loaded / event.total) * 100;
        const remainingBytes = event.total - event.loaded;
        const timeRemaining = uploadSpeed > 0 ? remainingBytes / uploadSpeed : 0;

        // Create progress object for files in this batch
        const progressData: { [fileName: string]: { progress: number; speed: number; timeRemaining: number } } = {};
        files.forEach(file => {
          progressData[file.name] = {
            progress: Math.round(progress),
            speed: uploadSpeed,
            timeRemaining: timeRemaining
          };
        });

        onProgress && onProgress(progressData);

        lastLoaded = event.loaded;
        lastTime = currentTime;
      }
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(new Error('Invalid JSON response'));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData?.error || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred during upload'));
    };

    xhr.open('POST', 'http://localhost:3001/api/files/upload-batch');
    xhr.send(formData);
  });
};

// Main upload function with smart batching
export const uploadFilesWithProgress = async (
  files: File[],
  onProgress?: (progress: { [fileName: string]: { progress: number; speed: number; timeRemaining: number } }) => void
): Promise<UploadResponse> => {
  // If files are within single batch limit, upload directly
  if (files.length <= MAX_BATCH_SIZE) {
    return uploadBatchWithProgress(files, 1, 1, onProgress);
  }

  // Split files into batches
  const batches = chunkArray(files, MAX_BATCH_SIZE);
  const totalBatches = batches.length;

  // Track overall results
  let totalSuccessful = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const allFiles: any[] = [];

  // Global progress tracking for all files
  const globalProgress: { [fileName: string]: { progress: number; speed: number; timeRemaining: number } } = {};

  // Upload each batch sequentially to avoid overwhelming the server
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchIndex = i + 1;
    
    try {
      console.log(`Uploading batch ${batchIndex}/${totalBatches} (${batch.length} files)`);
      
      const batchResult = await uploadBatchWithProgress(
        batch,
        batchIndex,
        totalBatches,
        (batchProgress) => {
          // Update global progress with this batch's progress
          Object.assign(globalProgress, batchProgress);
          onProgress && onProgress({ ...globalProgress });
        }
      );

      // Accumulate results
      totalSuccessful += batchResult.successfulFiles;
      totalFailed += batchResult.failedFiles;
      totalSkipped += batchResult.skippedFiles;
      allFiles.push(...(batchResult.files || []));

      // Mark completed files as 100% progress
      batch.forEach(file => {
        globalProgress[file.name] = {
          progress: 100,
          speed: 0,
          timeRemaining: 0
        };
      });

      // Update progress one final time for this batch
      onProgress && onProgress({ ...globalProgress });

      // Small delay between batches to be gentle on the server
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`Batch ${batchIndex} failed:`, error);
      
      // Mark failed batch files as failed in progress
      batch.forEach(file => {
        globalProgress[file.name] = {
          progress: 0,
          speed: 0,
          timeRemaining: 0
        };
      });
      
      totalFailed += batch.length;
      allFiles.push(...batch.map(file => ({
        filename: file.name,
        success: false,
        file: null,
        error: error instanceof Error ? error.message : 'Batch upload failed',
        skipped: false
      })));
    }
  }

  return {
    success: totalSuccessful > 0,
    totalFiles: files.length,
    successfulFiles: totalSuccessful,
    failedFiles: totalFailed,
    skippedFiles: totalSkipped,
    files: allFiles
  };
};

export const getUploadProgress = (uploadId: string): WebSocket => {
  const ws = new WebSocket(`ws://localhost:3001/api/files/ws-progress/${uploadId}`);
  
  ws.onopen = () => {
    console.log('WebSocket connection established');
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = (event) => {
    console.log('WebSocket connection closed:', event.code, event.reason);
  };
  
  return ws;
}; 