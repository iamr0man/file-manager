interface UploadResponse {
  uploadId: string;
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