/**
 * Wallet connection utilities and error handling
 */

export type WalletType = 'privateKey' | 'mpc' | 'metamask';

export interface WalletConnectionError {
  type: 'CONNECTION_FAILED' | 'EXTENSION_NOT_FOUND' | 'USER_REJECTED' | 'NETWORK_ERROR';
  message: string;
  walletType: WalletType;
  originalError?: any;
}

export interface WalletConnectionResult {
  success: boolean;
  address?: string;
  walletType?: WalletType;
  error?: WalletConnectionError;
}

/**
 * Standardized error messages for different wallet connection scenarios
 */
export const WALLET_ERROR_MESSAGES = {
  EXTENSION_NOT_FOUND: {
    mpc: 'Partisia Wallet extension not found. Please install it from the Partisia Blockchain website.',
    metamask: 'MetaMask extension not found. Please install MetaMask and try again.',
    privateKey: 'Invalid private key format. Please check your private key and try again.'
  },
  USER_REJECTED: {
    mpc: 'Connection to MPC wallet was cancelled by user.',
    metamask: 'Connection to MetaMask was cancelled by user.',
    privateKey: 'Private key connection was cancelled.'
  },
  CONNECTION_FAILED: {
    mpc: 'Failed to connect to MPC wallet. Please check that the extension is unlocked.',
    metamask: 'Failed to connect to MetaMask. Please check that MetaMask is unlocked.',
    privateKey: 'Failed to connect with private key. Please verify the key is correct.'
  },
  NETWORK_ERROR: {
    mpc: 'Network error while connecting to MPC wallet. Please try again.',
    metamask: 'Network error while connecting to MetaMask. Please try again.',
    privateKey: 'Network error during connection. Please try again.'
  }
};

/**
 * Create a standardized wallet connection error
 */
export function createWalletError(
  type: WalletConnectionError['type'],
  walletType: WalletType,
  originalError?: any
): WalletConnectionError {
  return {
    type,
    walletType,
    message: WALLET_ERROR_MESSAGES[type][walletType],
    originalError
  };
}

/**
 * Check if a wallet extension is available
 */
export function checkWalletAvailability(walletType: WalletType): boolean {
  switch (walletType) {
    case 'mpc':
      // Check for Partisia SDK or MPC wallet extension
      return typeof window !== 'undefined' && 
             (window as any).partisia !== undefined;
    
    case 'metamask':
      // Check for MetaMask
      return typeof window !== 'undefined' && 
             (window as any).ethereum !== undefined;
    
    case 'privateKey':
      // Private key is always available
      return true;
    
    default:
      return false;
  }
}

/**
 * Get user-friendly wallet type display name
 */
export function getWalletDisplayName(walletType: WalletType): string {
  const displayNames = {
    'privateKey': 'Private Key',
    'mpc': 'MPC Wallet',
    'metamask': 'MetaMask'
  };
  
  return displayNames[walletType] || 'Unknown Wallet';
}

/**
 * Get wallet type icon/emoji
 */
export function getWalletIcon(walletType: WalletType): string {
  const icons = {
    'privateKey': '🔑',
    'mpc': '🛡️',
    'metamask': '🦊'
  };
  
  return icons[walletType] || '🔗';
}

/**
 * Validate private key format
 */
export function isValidPrivateKey(privateKey: string): boolean {
  if (!privateKey || typeof privateKey !== 'string') {
    return false;
  }
  
  // Remove any whitespace
  const cleanKey = privateKey.trim();
  
  // Check if it's a valid hex string (64 characters for 256-bit key)
  const hexRegex = /^[0-9a-fA-F]{64}$/;
  return hexRegex.test(cleanKey);
}

/**
 * Sanitize and format private key
 */
export function formatPrivateKey(privateKey: string): string {
  return privateKey.trim().toLowerCase();
}

/**
 * Show wallet connection status in UI
 */
export function updateWalletConnectionUI(
  result: WalletConnectionResult,
  statusElementId: string = 'connection-status'
): void {
  const statusElement = document.querySelector(`#${statusElementId}`);
  if (!statusElement) return;
  
  // Remove existing status classes
  statusElement.classList.remove('connected', 'connecting', 'error');
  
  if (result.success && result.address) {
    statusElement.classList.add('connected');
    const icon = getWalletIcon(result.walletType!);
    const displayName = getWalletDisplayName(result.walletType!);
    
    statusElement.innerHTML = `
      <p>
        ${icon} Connected via ${displayName}: 
        <span class="wallet-address">${result.address}</span>
      </p>
    `;
  } else if (result.error) {
    statusElement.classList.add('error');
    statusElement.innerHTML = `
      <p>Connection Error: ${result.error.message}</p>
    `;
  }
}

/**
 * Show loading state for wallet connection
 */
export function setWalletConnectionLoading(
  walletType: WalletType,
  buttonId: string,
  statusElementId: string = 'connection-status'
): void {
  const button = document.querySelector(`#${buttonId}`) as HTMLButtonElement;
  const statusElement = document.querySelector(`#${statusElementId}`);
  
  if (button) {
    button.disabled = true;
    button.classList.add('loading');
    button.setAttribute('data-original-text', button.textContent || '');
    button.textContent = 'Connecting...';
  }
  
  if (statusElement) {
    statusElement.classList.remove('connected', 'error');
    statusElement.classList.add('connecting');
    
    const displayName = getWalletDisplayName(walletType);
    statusElement.innerHTML = `<p>Connecting to ${displayName}...</p>`;
  }
}

/**
 * Reset wallet connection UI to default state
 */
export function resetWalletConnectionUI(
  buttonId: string,
  statusElementId: string = 'connection-status'
): void {
  const button = document.querySelector(`#${buttonId}`) as HTMLButtonElement;
  const statusElement = document.querySelector(`#${statusElementId}`);
  
  if (button) {
    button.disabled = false;
    button.classList.remove('loading');
    const originalText = button.getAttribute('data-original-text');
    if (originalText) {
      button.textContent = originalText;
      button.removeAttribute('data-original-text');
    }
  }
  
  if (statusElement) {
    statusElement.classList.remove('connected', 'connecting', 'error');
    statusElement.innerHTML = '<p>Currently not logged in.</p>';
  }
}

/**
 * Show temporary notification message
 */
export function showNotification(
  message: string,
  type: 'info' | 'success' | 'error' = 'info',
  duration: number = 5000
): void {
  const notificationArea = document.querySelector('#application-messages');
  if (!notificationArea) return;
  
  notificationArea.textContent = message;
  notificationArea.className = `alert alert-${type}`;
  notificationArea.classList.remove('hidden');
  
  // Auto-hide after duration
  setTimeout(() => {
    notificationArea.classList.add('hidden');
    notificationArea.textContent = '';
  }, duration);
}

/**
 * Log wallet connection attempt for debugging
 */
export function logWalletConnection(
  walletType: WalletType,
  result: WalletConnectionResult
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    walletType,
    success: result.success,
    address: result.address,
    error: result.error?.type
  };
  
  if (result.success) {
    console.log('Wallet connection successful:', logData);
  } else {
    console.error('Wallet connection failed:', logData, result.error);
  }
}

/**
 * Handle common wallet connection errors
 */
export function handleWalletConnectionError(error: any, walletType: WalletType): WalletConnectionError {
  if (!error) {
    return createWalletError('CONNECTION_FAILED', walletType);
  }
  
  const errorMessage = error.message || String(error);
  
  // Check for common error patterns
  if (errorMessage.includes('Extension not Found') || 
      errorMessage.includes('not installed')) {
    return createWalletError('EXTENSION_NOT_FOUND', walletType, error);
  }
  
  if (errorMessage.includes('user rejected') || 
      errorMessage.includes('cancelled') ||
      errorMessage.includes('denied')) {
    return createWalletError('USER_REJECTED', walletType, error);
  }
  
  if (errorMessage.includes('network') || 
      errorMessage.includes('fetch') ||
      errorMessage.includes('timeout')) {
    return createWalletError('NETWORK_ERROR', walletType, error);
  }
  
  // Default to connection failed
  return createWalletError('CONNECTION_FAILED', walletType, error);
}

/**
 * Enhanced wallet connection wrapper with proper error handling
 */
export async function connectWalletSafely(
  walletType: WalletType,
  connectionFunction: () => Promise<any>,
  buttonId: string
): Promise<WalletConnectionResult> {
  try {
    // Set loading state
    setWalletConnectionLoading(walletType, buttonId);
    
    // Check wallet availability first
    if (!checkWalletAvailability(walletType) && walletType !== 'privateKey') {
      throw new Error('Extension not Found');
    }
    
    // Attempt connection
    const account = await connectionFunction();
    
    if (!account || !account.getAddress) {
      throw new Error('Invalid account object returned');
    }
    
    const address = account.getAddress();
    if (!address) {
      throw new Error('No address returned from wallet');
    }
    
    const result: WalletConnectionResult = {
      success: true,
      address,
      walletType
    };
    
    // Update UI for success
    updateWalletConnectionUI(result);
    showNotification(`Successfully connected to ${getWalletDisplayName(walletType)}!`, 'success');
    logWalletConnection(walletType, result);
    
    return result;
    
  } catch (error) {
    const walletError = handleWalletConnectionError(error, walletType);
    
    const result: WalletConnectionResult = {
      success: false,
      error: walletError
    };
    
    // Update UI for error
    updateWalletConnectionUI(result);
    showNotification(walletError.message, 'error');
    logWalletConnection(walletType, result);
    
    return result;
    
  } finally {
    // Reset button state
    setTimeout(() => {
      resetWalletConnectionUI(buttonId);
    }, 1000);
  }
}

/**
 * Get installation instructions for wallet extensions
 */
export function getWalletInstallationInstructions(walletType: WalletType): {
  title: string;
  description: string;
  link: string;
  buttonText: string;
} {
  const instructions = {
    mpc: {
      title: 'Install Partisia Wallet',
      description: 'The Partisia Blockchain MPC wallet extension provides secure multi-party computation for your transactions.',
      link: 'https://partisiablockchain.com/wallet/',
      buttonText: 'Install Partisia Wallet'
    },
    metamask: {
      title: 'Install MetaMask',
      description: 'MetaMask is a browser extension that allows you to interact with blockchain applications.',
      link: 'https://metamask.io/download/',
      buttonText: 'Install MetaMask'
    },
    privateKey: {
      title: 'Private Key Access',
      description: 'Connect directly using your private key. Only use this on trusted devices.',
      link: '#',
      buttonText: 'Learn More'
    }
  };
  
  return instructions[walletType];
}

/**
 * Show wallet installation modal/instructions
 */
export function showWalletInstallationModal(walletType: WalletType): void {
  const instructions = getWalletInstallationInstructions(walletType);
  
  // Create modal HTML
  const modalHTML = `
    <div class="wallet-install-modal-overlay" id="wallet-install-modal">
      <div class="wallet-install-modal">
        <div class="wallet-install-header">
          <h3>${instructions.title}</h3>
          <button class="wallet-install-close" onclick="closeWalletInstallModal()">&times;</button>
        </div>
        <div class="wallet-install-body">
          <p>${instructions.description}</p>
          <div class="wallet-install-actions">
            <a href="${instructions.link}" target="_blank" class="btn btn-primary">
              ${instructions.buttonText}
            </a>
            <button class="btn btn-secondary" onclick="closeWalletInstallModal()">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Add close function to global scope
  (window as any).closeWalletInstallModal = () => {
    const modal = document.getElementById('wallet-install-modal');
    if (modal) {
      modal.remove();
    }
  };
}

/**
 * Utility to truncate wallet addresses for display
 */
export function truncateAddress(address: string, startLength: number = 6, endLength: number = 4): string {
  if (!address || address.length <= startLength + endLength) {
    return address;
  }
  
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

/**
 * Copy address to clipboard with user feedback
 */
export function copyAddressToClipboard(address: string): void {
  if (!navigator.clipboard) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = address;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  } else {
    navigator.clipboard.writeText(address);
  }
  
  showNotification('Address copied to clipboard!', 'success', 2000);
}

/**
 * Format wallet connection time
 */
export function formatConnectionTime(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return `${seconds}s ago`;
  }
}

/**
 * Wallet connection health check
 */
export async function checkWalletConnection(account: any): Promise<boolean> {
  try {
    if (!account || typeof account.getAddress !== 'function') {
      return false;
    }
    
    const address = account.getAddress();
    return !!address && address.length > 0;
    
  } catch (error) {
    console.error('Wallet connection health check failed:', error);
    return false;
  }
}

/**
 * Auto-reconnection utility for wallet connections
 */
export class WalletAutoReconnect {
  private reconnectAttempts = 0;
  private maxAttempts = 3;
  private reconnectDelay = 5000; // 5 seconds
  
  constructor(
    private walletType: WalletType,
    private connectionFunction: () => Promise<any>,
    private onReconnectSuccess: (account: any) => void,
    private onReconnectFailed: () => void
  ) {}
  
  async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxAttempts) {
      console.log('Max reconnection attempts reached');
      this.onReconnectFailed();
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`Attempting wallet reconnection (${this.reconnectAttempts}/${this.maxAttempts})`);
    
    try {
      const account = await this.connectionFunction();
      const isHealthy = await checkWalletConnection(account);
      
      if (isHealthy) {
        console.log('Wallet reconnection successful');
        this.reconnectAttempts = 0; // Reset counter on success
        this.onReconnectSuccess(account);
        return;
      }
      
      throw new Error('Wallet connection unhealthy');
      
    } catch (error) {
      console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      
      if (this.reconnectAttempts < this.maxAttempts) {
        setTimeout(() => this.attemptReconnect(), this.reconnectDelay);
      } else {
        this.onReconnectFailed();
      }
    }
  }
  
  reset(): void {
    this.reconnectAttempts = 0;
  }
}