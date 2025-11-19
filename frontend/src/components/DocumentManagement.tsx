/**
 * Document Management Component
 * Handles document upload, listing, and deletion
 */
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonText,
} from '@ionic/react';
import {
  cloudUploadOutline,
  documentTextOutline,
  trashOutline,
} from 'ionicons/icons';
import React, { useEffect, useRef, useState } from 'react';
import apiService from '../services/api';
import { Document } from '../types';
import './DocumentManagement.css';

interface DocumentManagementProps {
  onClose: () => void;
}

const DocumentManagement: React.FC<DocumentManagementProps> = ({ onClose }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleFiles = async (files: FileList) => {
    if (!files || files.length === 0) return;

    console.log('Starting upload for', files.length, 'file(s)');
    setUploading(true);
    
    try {
      const uploadPromises = [];
      for (let i = 0; i < files.length; i++) {
        console.log('Uploading file:', files[i].name, 'Size:', files[i].size, 'bytes');
        uploadPromises.push(apiService.uploadDocument(files[i]));
      }
      
      const results = await Promise.all(uploadPromises);
      console.log('Upload results:', results);
      
      await loadDocuments();
      console.log('Documents reloaded successfully');
    } catch (error: any) {
      console.error('Error uploading documents:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Unknown error occurred';
      alert(`Error uploading documents: ${errorMsg}\n\nPlease check the console for more details.`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      await handleFiles(files);
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
    // Only set to false if leaving the upload-area itself, not its children
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFiles(files);
    }
  };

  const handleUploadAreaClick = (e: React.MouseEvent) => {
    // Prevent triggering if already uploading
    if (uploading) {
      e.preventDefault();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await apiService.deleteDocument(docId);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error deleting document. Please try again.');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL documents?')) {
      return;
    }

    try {
      await apiService.clearAllDocuments();
      await loadDocuments();
    } catch (error) {
      console.error('Error clearing documents:', error);
      alert('Error clearing documents. Please try again.');
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
          onChange={handleFileUpload}
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
              <IonSpinner />
              <span>Uploading...</span>
            </div>
          ) : (
            <>
              <IonIcon icon={cloudUploadOutline} className="upload-icon" />
              <h3>Upload documents</h3>
              <p>Drag and drop files here</p>
              <span className="file-types">Limit 200MB per file • TXT, PDF, DOCX, MD</span>
            </>
          )}
        </div>

        <IonButton
          expand="block"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="browse-button"
        >
          Browse files
        </IonButton>

        {documents.length > 0 && (
          <IonButton
            expand="block"
            fill="outline"
            onClick={handleClearAll}
            disabled={loading}
            className="clear-button"
          >
            <IonIcon icon={trashOutline} slot="start" />
            Clear database
          </IonButton>
        )}
      </div>

      <div className="documents-section">
        <h3 className="section-title">Uploaded Documents: ({documents.length})</h3>
        
        {loading ? (
          <div className="loading-container">
            <IonSpinner />
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <IonIcon icon={documentTextOutline} className="empty-icon" />
            <IonText color="medium">
              <p>No documents uploaded yet</p>
            </IonText>
          </div>
        ) : (
          <IonList className="documents-list">
            {documents.map((doc) => (
              <IonItem key={doc.ids[0]} className="document-item" lines="none">
                <IonIcon icon={documentTextOutline} slot="start" className="doc-icon" />
                <IonLabel className="doc-label">{doc.name}</IonLabel>
                <IonButton
                  fill="clear"
                  onClick={() => handleDeleteDocument(doc.ids[0])}
                  className="delete-button"
                >
                  <IonIcon icon={trashOutline} />
                </IonButton>
              </IonItem>
            ))}
          </IonList>
        )}
      </div>
    </div>
  );
};

export default DocumentManagement;
