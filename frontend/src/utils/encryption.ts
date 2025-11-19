/**
 * Simple encryption utilities for storing sensitive data in localStorage
 * Uses base64 encoding with a simple XOR cipher
 * Note: This is basic obfuscation, not secure encryption. For production,
 * consider using Web Crypto API or a proper encryption library.
 */

const SECRET_KEY = 'RAG_AI_ASSISTANT_SECRET_KEY_2025';

/**
 * Encrypt a string using XOR cipher
 */
export const encryptData = (data: string): string => {
  if (!data) return '';
  
  let encrypted = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
    encrypted += String.fromCharCode(charCode);
  }
  
  // Convert to base64 for safe storage
  return btoa(encrypted);
};

/**
 * Decrypt a string that was encrypted with encryptData
 */
export const decryptData = (encryptedData: string): string => {
  if (!encryptedData) return '';
  
  try {
    // Decode from base64
    const encrypted = atob(encryptedData);
    
    let decrypted = '';
    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      decrypted += String.fromCharCode(charCode);
    }
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt data:', error);
    return '';
  }
};

/**
 * Store encrypted data in localStorage
 */
export const setEncryptedItem = (key: string, value: string): void => {
  const encrypted = encryptData(value);
  localStorage.setItem(key, encrypted);
};

/**
 * Retrieve and decrypt data from localStorage
 */
export const getEncryptedItem = (key: string): string => {
  const encrypted = localStorage.getItem(key);
  if (!encrypted) return '';
  return decryptData(encrypted);
};

/**
 * Remove encrypted item from localStorage
 */
export const removeEncryptedItem = (key: string): void => {
  localStorage.removeItem(key);
};
