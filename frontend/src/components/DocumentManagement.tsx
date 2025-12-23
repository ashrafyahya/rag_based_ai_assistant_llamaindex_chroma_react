/**
 * Document Management Component
 * Handles document upload, listing, and deletion
 */
import React, { useEffect, useRef, useState } from 'react';
import apiService from '../services/api';
import { Document } from '../types';
import './DocumentManagement.css';
import Toast, { ToastType } from './Toast';

interface ToastState {
  message: string;
  type: ToastType;
}

interface DocumentManagementProps {
  onClose: () => void;
}

const DocumentManagement: React.FC<DocumentManagementProps> = ({ onClose }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await apiService.listDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  const handleUploadClick = async () => {
    if (selectedFiles.length === 0) return;

    console.log('Starting upload for', selectedFiles.length, 'file(s)');
    setUploading(true);
    
    try {
      const uploadPromises = selectedFiles.map(file => {
        console.log('Uploading file:', file.name, 'Size:', file.size, 'bytes');
        return apiService.uploadDocument(file);
      });
      
      const results = await Promise.all(uploadPromises);
      console.log('Upload results:', results);
      
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadDocuments();
      console.log('Documents reloaded successfully');
      
      showToast(
        `Successfully uploaded ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`,
        'success'
      );
    } catch (error: any) {
      console.error('Error uploading documents:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Unknown error occurred';
      showToast(`Error uploading documents: ${errorMsg}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  const handleUploadAreaClick = () => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  const removeSelectedFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    // Reset file input to allow re-selection of files
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await apiService.deleteDocument(docId);
      await loadDocuments();
      showToast('Document deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting document:', error);
      showToast('Error deleting document. Please try again.', 'error');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL documents?')) {
      return;
    }

    try {
      await apiService.clearAllDocuments();
      await loadDocuments();
      showToast('All documents cleared successfully', 'success');
    } catch (error) {
      console.error('Error clearing documents:', error);
      showToast('Error clearing documents. Please try again.', 'error');
    }
  };

  return (
    <div className="document-management">
      <div className="upload-section">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.pdf,.docx,.md"
          onChange={handleFileSelection}
          style={{ display: 'none' }}
        />
        
        <div 
          className={`upload-area ${isDragging ? 'dragging' : ''}`}
          onClick={handleUploadAreaClick}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="upload-status">
              <div className="spinner"></div>
              <span>Uploading...</span>
            </div>
          ) : (
            <>
              <svg className="upload-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h3>Upload documents</h3>
              <p>Drag and drop files here or click to browse</p>
              <span className="file-types">Limit 200MB per file • TXT, PDF, DOCX, MD</span>
            </>
          )}
        </div>

        {selectedFiles.length > 0 && (
          <div className="selected-files">
            <h4>Selected Files ({selectedFiles.length})</h4>
            <div className="file-list">
              {selectedFiles.map((file, index) => (
                <div key={index} className="file-item">
                  <div className="file-info">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9.333 1.333H4a1.333 1.333 0 0 0-1.333 1.334v10.666A1.333 1.333 0 0 0 4 14.667h8a1.333 1.333 0 0 0 1.333-1.334V5.333L9.333 1.333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9.333 1.333v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="file-name">{file.name}</span>
                  </div>
                  <div className="file-actions">
                    <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                    <button
                      className="remove-file-btn"
                      onClick={() => removeSelectedFile(index)}
                      title="Remove file"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              className="upload-btn"
              onClick={handleUploadClick}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {selectedFiles.length === 0 && (
          <button
            className="browse-button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            Browse files
          </button>
        )}

        {documents.length > 0 && (
          <button
            className="clear-button"
            onClick={handleClearAll}
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Clear database</span>
          </button>
        )}
      </div>

      <div className="documents-section">
        <h3 className="section-title">Uploaded Documents: ({documents.length})</h3>
        
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <p>No documents uploaded yet</p>
          </div>
        ) : (
          <ul className="documents-list">
            {documents.map((doc) => (
              <li key={doc.ids[0]} className="document-item">
                <div className="doc-info">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9.333 1.333H4a1.333 1.333 0 0 0-1.333 1.334v10.666A1.333 1.333 0 0 0 4 14.667h8a1.333 1.333 0 0 0 1.333-1.334V5.333L9.333 1.333Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9.333 1.333v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="doc-label">{doc.name}</span>
                </div>
                <button
                  className="delete-button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteDocument(doc.ids[0]);
                  }}
                  title="Delete document"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default DocumentManagement;
