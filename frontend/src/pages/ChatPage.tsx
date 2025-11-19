/**
 * Main Chat Page Component
 * Container for the entire RAG application with sidebar layout
 */
import React, { useEffect, useState } from 'react';
import APISettings from '../components/APISettings';
import ChatInterface from '../components/ChatInterface';
import DocumentManagement from '../components/DocumentManagement';
import apiService from '../services/api';
import { APIKeys, Message, Provider } from '../types';
import { getEncryptedItem, setEncryptedItem } from '../utils/encryption';
import './ChatPage.css';

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [showAPISettings, setShowAPISettings] = useState(false);
  const [showDocuments, setShowDocuments] = useState(true);
  const [apiKeys, setApiKeys] = useState<APIKeys>({
    groq: '',
    openai: '',
    gemini: '',
    deepseek: '',
  });
  const [selectedProvider, setSelectedProvider] = useState<Provider>('groq');

  useEffect(() => {
    loadSavedSettings();
  }, []);

  const loadSavedSettings = async () => {
    try {
      // Load encrypted API keys from localStorage
      const encryptedKeys: APIKeys = {
        groq: getEncryptedItem('api_key_groq'),
        openai: getEncryptedItem('api_key_openai'),
        gemini: getEncryptedItem('api_key_gemini'),
        deepseek: getEncryptedItem('api_key_deepseek'),
      };
      setApiKeys(encryptedKeys);
      
      // Load selected provider from localStorage
      const savedProvider = localStorage.getItem('selected_provider') as Provider;
      if (savedProvider) {
        setSelectedProvider(savedProvider);
      }
      
      // Also sync with backend
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

    // Create placeholder for assistant message
    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    const newMessages = [...messages, userMessage, assistantMessage];
    setMessages(newMessages);

    try {
      console.log('[FRONTEND] Sending query:', query);
      console.log('[FRONTEND] Using provider:', selectedProvider);
      
      await apiService.queryRAGStream(
        {
          query,
          api_provider: selectedProvider,
          api_key_groq: apiKeys.groq,
          api_key_openai: apiKeys.openai,
          api_key_gemini: apiKeys.gemini,
          api_key_deepseek: apiKeys.deepseek,
        },
        (chunk: string) => {
          // Update the last message (assistant) with accumulated content
          setMessages(prevMessages => {
            const updated = [...prevMessages];
            const lastIndex = updated.length - 1;
            if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
              // Create a new message object instead of mutating
              updated[lastIndex] = {
                ...updated[lastIndex],
                content: updated[lastIndex].content + chunk
              };
            }
            return updated;
          });
        }
      );
      
      console.log('[FRONTEND] Stream completed');
    } catch (error: any) {
      console.error('[FRONTEND ERROR]', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error.response?.data?.detail || error.message || 'Failed to get response'}`,
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
    
    try {
      // Save encrypted API keys to localStorage
      if (keys.groq) setEncryptedItem('api_key_groq', keys.groq);
      if (keys.openai) setEncryptedItem('api_key_openai', keys.openai);
      if (keys.gemini) setEncryptedItem('api_key_gemini', keys.gemini);
      if (keys.deepseek) setEncryptedItem('api_key_deepseek', keys.deepseek);
      
      // Save selected provider to localStorage
      localStorage.setItem('selected_provider', provider);
      
      // Also sync with backend
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
    <div className="app-container">
      <header className="app-header">
        <div className="header-title">
          <span className="logo-text">RAG-based AI Assistant</span>
        </div>
        <div className="header-actions">
          <button
            className="header-btn"
            onClick={() => setShowAPISettings(!showAPISettings)}
            title="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16.167 12.5a1.375 1.375 0 0 0 .275 1.517l.05.05a1.668 1.668 0 1 1-2.359 2.358l-.05-.05a1.375 1.375 0 0 0-1.516-.275 1.375 1.375 0 0 0-.834 1.258v.142a1.667 1.667 0 0 1-3.333 0v-.075a1.375 1.375 0 0 0-.9-1.258 1.375 1.375 0 0 0-1.517.275l-.05.05a1.668 1.668 0 1 1-2.358-2.358l.05-.05a1.375 1.375 0 0 0 .275-1.517 1.375 1.375 0 0 0-1.258-.834H2.5a1.667 1.667 0 0 1 0-3.333h.075a1.375 1.375 0 0 0 1.258-.9 1.375 1.375 0 0 0-.275-1.517l-.05-.05a1.668 1.668 0 1 1 2.359-2.358l.05.05a1.375 1.375 0 0 0 1.516.275h.067a1.375 1.375 0 0 0 .833-1.258V2.5a1.667 1.667 0 0 1 3.334 0v.075a1.375 1.375 0 0 0 .833 1.258 1.375 1.375 0 0 0 1.517-.275l.05-.05a1.668 1.668 0 1 1 2.358 2.359l-.05.05a1.375 1.375 0 0 0-.275 1.516v.067a1.375 1.375 0 0 0 1.259.833h.141a1.667 1.667 0 0 1 0 3.334h-.075a1.375 1.375 0 0 0-1.258.833v0Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </header>

      <div className="app-layout">
        <aside className={`sidebar ${showDocuments ? 'visible' : 'hidden'}`}>
          <div className="sidebar-header">
            <h2>Document Management</h2>
            <button 
              className="toggle-sidebar-btn"
              onClick={() => setShowDocuments(!showDocuments)}
              title="Toggle sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <DocumentManagement onClose={() => setShowDocuments(false)} />
        </aside>

        <main className="main-content">
          {!showDocuments && (
            <button 
              className="open-sidebar-btn"
              onClick={() => setShowDocuments(true)}
              title="Open Document Management"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 10h14M3 5h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          
          {showAPISettings && (
            <div className="modal-overlay" onClick={() => setShowAPISettings(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <APISettings
                  apiKeys={apiKeys}
                  selectedProvider={selectedProvider}
                  onSave={handleSaveAPIKeys}
                  onClose={() => setShowAPISettings(false)}
                />
              </div>
            </div>
          )}
          
          {!showAPISettings && (
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              onClearChat={handleClearChat}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default ChatPage;
