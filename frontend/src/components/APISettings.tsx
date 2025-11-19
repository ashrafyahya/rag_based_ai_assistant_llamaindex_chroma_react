/**
 * API Settings Component
 * Manages API key configuration for different LLM providers
 */
import React, { useState } from 'react';
import { APIKeys, Provider, PROVIDERS } from '../types';
import './APISettings.css';

interface APISettingsProps {
  apiKeys: APIKeys;
  selectedProvider: Provider;
  onSave: (keys: APIKeys, provider: Provider) => void;
  onClose: () => void;
}

const APISettings: React.FC<APISettingsProps> = ({
  apiKeys,
  selectedProvider,
  onSave,
  onClose,
}) => {
  const [localProvider, setLocalProvider] = useState<Provider>(selectedProvider);
  const [apiKey, setApiKey] = useState<string>(apiKeys[selectedProvider] || '');

  const handleSave = () => {
    const updatedKeys = { ...apiKeys, [localProvider]: apiKey };
    onSave(updatedKeys, localProvider);
    onClose();
  };

  const handleProviderChange = (provider: Provider) => {
    setLocalProvider(provider);
    setApiKey(apiKeys[provider] || '');
  };

  return (
    <div className="api-settings">
      <div className="settings-card">
        <div className="settings-header">
          <h2>API Settings</h2>
          <button className="close-button" onClick={onClose} title="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        <div className="settings-content">
          <p className="settings-description">
            Configure your API key for the selected LLM provider. You only need to set up one provider to get started.
          </p>

          <div className="provider-selection">
            <label className="form-label">
              <strong>Select Provider:</strong>
            </label>
            <div className="provider-tabs">
              {Object.keys(PROVIDERS).map((provider) => (
                <button
                  key={provider}
                  className={`provider-tab ${localProvider === provider ? 'active' : ''}`}
                  onClick={() => handleProviderChange(provider as Provider)}
                >
                  {PROVIDERS[provider as Provider].name}
                </button>
              ))}
            </div>
          </div>

          <div className="api-key-section">
            <label className="form-label" htmlFor="api-key-input">
              <strong>{PROVIDERS[localProvider].name} API Key</strong>
              <a
                href={PROVIDERS[localProvider].url}
                target="_blank"
                rel="noopener noreferrer"
                className="get-key-link"
              >
                (Get API Key)
              </a>
            </label>
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter ${PROVIDERS[localProvider].name} API key`}
              className="api-key-input"
            />
          </div>

          <div className="actions">
            <button className="save-button" onClick={handleSave}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APISettings;
