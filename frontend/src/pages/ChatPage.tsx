/**
 * Main Chat Page Component
 * Container for the entire RAG application with sidebar layout
 */
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonPage,
    IonTitle,
    IonToolbar,
} from '@ionic/react';
import { downloadOutline, settingsOutline } from 'ionicons/icons';
import React, { useEffect, useState } from 'react';
import APISettings from '../components/APISettings';
import ChatInterface from '../components/ChatInterface';
import DocumentManagement from '../components/DocumentManagement';
import apiService from '../services/api';
import { APIKeys, Message, Provider } from '../types';
import './ChatPage.css';

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [showAPISettings, setShowAPISettings] = useState(false);
  const [showDocuments, setShowDocuments] = useState(true); // Show by default
  const [apiKeys, setApiKeys] = useState<APIKeys>({
    groq: '',
    openai: '',
    gemini: '',
    deepseek: '',
  });
  const [selectedProvider, setSelectedProvider] = useState<Provider>('groq');

  // Load saved API keys and provider on mount
  useEffect(() => {
    loadSavedSettings();
  }, []);

  const loadSavedSettings = async () => {
    try {
      const providerResponse = await apiService.getSelectedProvider();
      if (providerResponse.provider) {
        setSelectedProvider(providerResponse.provider);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSendMessage = async (query: string) => {
    const userMessage: Message = {
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([...messages, userMessage]);

    try {
      const response = await apiService.queryRAG({
        query,
        api_provider: selectedProvider,
        api_key_groq: apiKeys.groq,
        api_key_openai: apiKeys.openai,
        api_key_gemini: apiKeys.gemini,
        api_key_deepseek: apiKeys.deepseek,
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...messages, userMessage, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error.response?.data?.detail || 'Failed to get response'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...messages, userMessage, errorMessage]);
    }
  };

  const handleClearChat = async () => {
    try {
      await apiService.clearChatMemory();
      setMessages([]);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  const handleSaveAPIKeys = async (keys: APIKeys, provider: Provider) => {
    setApiKeys(keys);
    setSelectedProvider(provider);
    
    // Save to backend
    try {
      for (const [providerName, key] of Object.entries(keys)) {
        if (key) {
          await apiService.saveAPIKey(providerName, key);
        }
      }
      await apiService.setSelectedProvider(provider);
    } catch (error) {
      console.error('Error saving API keys:', error);
    }
  };

  const handleDownloadChat = () => {
    const chatText = messages.map(msg => 
      `[${msg.timestamp}] ${msg.role.toUpperCase()}: ${msg.content}`
    ).join('\n\n');
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <div className="header-title">
              <span className="logo-icon">🤖</span>
              <span className="logo-text">RAG-based AI Assistant</span>
            </div>
          </IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleDownloadChat} disabled={messages.length === 0}>
              <IonIcon icon={downloadOutline} slot="icon-only" />
            </IonButton>
            <IonButton onClick={() => setShowAPISettings(!showAPISettings)}>
              <IonIcon icon={settingsOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="app-layout">
          {/* Sidebar for Documents */}
          <aside className={`sidebar ${showDocuments ? 'visible' : 'hidden'}`}>
            <div className="sidebar-header">
              <h2>Document Management</h2>
              <button 
                className="toggle-sidebar-btn"
                onClick={() => setShowDocuments(!showDocuments)}
                title="Toggle sidebar"
              >
                {showDocuments ? '◀' : '▶'}
              </button>
            </div>
            <DocumentManagement onClose={() => setShowDocuments(false)} />
          </aside>

          {/* Main Chat Area */}
          <main className="main-content">
            {!showDocuments && (
              <button 
                className="open-sidebar-btn"
                onClick={() => setShowDocuments(true)}
                title="Open Document Management"
              >
                📁
              </button>
            )}
            
            {showAPISettings ? (
              <APISettings
                apiKeys={apiKeys}
                selectedProvider={selectedProvider}
                onSave={handleSaveAPIKeys}
                onClose={() => setShowAPISettings(false)}
              />
            ) : (
              <ChatInterface
                messages={messages}
                onSendMessage={handleSendMessage}
                onClearChat={handleClearChat}
              />
            )}
          </main>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ChatPage;
