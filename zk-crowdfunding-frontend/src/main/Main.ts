import { getCrowdfundingApi, isConnected, setContractAddress, getContractAddress } from "./AppState";
import {
  connectPrivateKeyWalletClick,
  disconnectWalletClick,
  updateContractState,
  updateInteractionVisibility,
} from "./WalletIntegration";
import './App.css';

// DOM Elements cache
interface DOMElements {
  // Status elements
  connectionStatus: HTMLElement | null;
  walletAddressDisplay: HTMLElement | null;
  
  // Form elements
  addressInput: HTMLInputElement | null;
  contributionInput: HTMLInputElement | null;
  
  // Transaction display elements
  contributionTxHash: HTMLElement | null;
  contributionTxLink: HTMLAnchorElement | null;
  endCampaignTxHash: HTMLElement | null;
  endCampaignTxLink: HTMLAnchorElement | null;
  withdrawFundsTxHash: HTMLElement | null;
  withdrawFundsTxLink: HTMLAnchorElement | null;
  
  // Transaction info containers
  addContributionTransactionLink: HTMLElement | null;
  endCampaignTransactionLink: HTMLElement | null;
  withdrawFundsTransactionLink: HTMLElement | null;

  // Campaign result elements
  campaignResultContainer: HTMLElement | null;
  resultBox: HTMLElement | null;
  campaignResult: HTMLElement | null;
}

let elements: DOMElements = {
  // Status elements
  connectionStatus: null,
  walletAddressDisplay: null,
  
  // Form elements
  addressInput: null,
  contributionInput: null,
  
  // Transaction display elements
  contributionTxHash: null,
  contributionTxLink: null,
  endCampaignTxHash: null,
  endCampaignTxLink: null,
  withdrawFundsTxHash: null,
  withdrawFundsTxLink: null,
  
  // Transaction info containers
  addContributionTransactionLink: null,
  endCampaignTransactionLink: null,
  withdrawFundsTransactionLink: null,

  // Campaign result elements
  campaignResultContainer: null,
  resultBox: null,
  campaignResult: null
};

// Initialize DOM elements cache
function initializeElements() {
  elements = {
    // Status elements
    connectionStatus: document.querySelector("#connection-status"),
    walletAddressDisplay: document.querySelector("#wallet-address-display"),
    
    // Form elements
    addressInput: document.querySelector("#address-value") as HTMLInputElement,
    contributionInput: document.querySelector("#contribution") as HTMLInputElement,
    
    // Transaction display elements
    contributionTxHash: document.querySelector("#contribution-tx-hash"),
    contributionTxLink: document.querySelector("#contribution-tx-link") as HTMLAnchorElement,
    endCampaignTxHash: document.querySelector("#end-campaign-tx-hash"),
    endCampaignTxLink: document.querySelector("#end-campaign-tx-link") as HTMLAnchorElement,
    withdrawFundsTxHash: document.querySelector("#withdraw-funds-tx-hash"),
    withdrawFundsTxLink: document.querySelector("#withdraw-funds-tx-link") as HTMLAnchorElement,
    
    // Transaction info containers
    addContributionTransactionLink: document.querySelector("#add-contribution-transaction-link"),
    endCampaignTransactionLink: document.querySelector("#end-campaign-transaction-link"),
    withdrawFundsTransactionLink: document.querySelector("#withdraw-funds-transaction-link"),

    // Campaign result elements
    campaignResultContainer: document.querySelector("#campaign-result-container"),
    resultBox: document.querySelector("#result-box"),
    campaignResult: document.querySelector("#campaign-result")
  };
}

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  setupEventListeners();
});

function setupEventListeners() {
  // Connect using private key
  const pkConnect = document.querySelector("#private-key-connect-btn");
  if (pkConnect) {
    pkConnect.addEventListener("click", () => {
      // The function will read values from input fields directly
      connectPrivateKeyWalletClick();
    });
  }

  // Disconnect wallet
  const disconnectWallet = document.querySelector("#wallet-disconnect-btn");
  if (disconnectWallet) {
    disconnectWallet.addEventListener("click", () => {
      disconnectWalletClick();
      // Reset transaction displays when disconnecting
      resetTransactionDisplays();
    });
  }

  // Set campaign address
  const addressBtn = document.querySelector("#address-btn");
  if (addressBtn) {
    addressBtn.addEventListener("click", contractAddressClick);
  }

  // Refresh state
  const updateStateBtn = document.querySelector("#update-state-btn");
  if (updateStateBtn) {
    updateStateBtn.addEventListener("click", () => {
      const refreshLoader = document.querySelector("#refresh-loader");
      if (refreshLoader) {
        refreshLoader.classList.remove("hidden");
      }
      updateContractState();
    });
  }

  // Campaign actions
  const addContributionBtn = document.querySelector("#add-contribution-btn");
  if (addContributionBtn) {
    addContributionBtn.addEventListener("click", addContributionFormAction);
  }

  const endCampaignBtn = document.querySelector("#end-campaign-btn");
  if (endCampaignBtn) {
    endCampaignBtn.addEventListener("click", endCampaignAction);
  }

  const withdrawFundsBtn = document.querySelector("#withdraw-funds-btn");
  if (withdrawFundsBtn) {
    withdrawFundsBtn.addEventListener("click", withdrawFundsAction);
  }
}

// Reset all transaction displays
function resetTransactionDisplays() {
  const transactionInfoDisplays = [
    elements.addContributionTransactionLink,
    elements.endCampaignTransactionLink,
    elements.withdrawFundsTransactionLink
  ];
  
  transactionInfoDisplays.forEach(display => {
    if (display) display.classList.add("hidden");
  });
}

function contractAddressClick() {
  if (!elements.addressInput) return;
  
  const address = elements.addressInput.value;
  
  if (!address) {
    setConnectionStatus("Please enter a campaign contract address");
    return;
  }
  
  // Validate that address is 21 bytes in hexadecimal format
  const regex = /[0-9A-Fa-f]{42}/g;
  if (address.length != 42 || address.match(regex) == null) {
    setConnectionStatus(`${address} is not a valid Partisia Blockchain address`);
    return;
  }
  
  // Update the contract state
  setContractAddress(address);
  updateInteractionVisibility();
  
  // Show address and link to the browser
  const currentAddressElement = document.querySelector("#current-address");
  if (currentAddressElement) {
    currentAddressElement.innerHTML = `Campaign Contract Address: <strong>${address}</strong>`;
  }
  
  const browserLink = document.querySelector("#browser-link");
  if (browserLink) {
    browserLink.innerHTML = `<a href="https://browser.testnet.partisiablockchain.com/contracts/${address}" class="transaction-link" target="_blank">View contract in explorer</a>`;
  }
  
  // Show loading state
  const refreshLoader = document.querySelector("#refresh-loader");
  if (refreshLoader) {
    refreshLoader.classList.remove("hidden");
  }
  
  // Update the contract state
  updateContractState();
}

function addContributionFormAction() {
  // Test if a user has connected
  if (!isConnected()) {
    setConnectionStatus("Please connect your wallet first");
    return;
  }
  
  if (!elements.contributionInput || isNaN(parseInt(elements.contributionInput.value, 10))) {
    setConnectionStatus("Please enter a valid contribution amount");
    return;
  }
  
  // All fields validated, add contribution
  const api = getCrowdfundingApi();
  if (!api) {
    setConnectionStatus("Error: API not initialized");
    return;
  }
  
  // Disable the button during processing
  const addContributionBtn = document.querySelector("#add-contribution-btn") as HTMLButtonElement;
  if (addContributionBtn) {
    addContributionBtn.disabled = true;
    addContributionBtn.textContent = "Processing...";
  }
  
  // Show transaction info container
  if (elements.addContributionTransactionLink) {
    elements.addContributionTransactionLink.classList.remove("hidden");
    elements.addContributionTransactionLink.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
  }
  
  // Add contribution via API
  api.addContribution(parseInt(elements.contributionInput.value, 10))
    .then((result) => {
      const txId = result.transactionPointer.identifier;
      
      // Update transaction hash display
      if (elements.contributionTxHash) {
        elements.contributionTxHash.textContent = `Transaction: ${txId}`;
      }
      
      // Update transaction link
      if (elements.contributionTxLink) {
        elements.contributionTxLink.href = `https://browser.testnet.partisiablockchain.com/transactions/${txId}`;
      }
      
      // Set status message
      setConnectionStatus("Contribution submitted successfully");
      
      // Clear input after successful contribution
      if (elements.contributionInput) {
        elements.contributionInput.value = "";
      }
      
      // Update state after a delay to reflect new contribution
      setTimeout(updateContractState, 5000);
    })
    .catch((error) => {
      if (elements.addContributionTransactionLink) {
        elements.addContributionTransactionLink.innerHTML = `<div class="alert alert-error">Error: ${error.message || String(error)}</div>`;
      }
      setConnectionStatus(`Error making contribution: ${error.message || String(error)}`);
    })
    .finally(() => {
      // Re-enable the button
      if (addContributionBtn) {
        addContributionBtn.disabled = false;
        addContributionBtn.textContent = "Contribute";
      }
    });
}

function endCampaignAction() {
  // User is connected
  if (!isConnected()) {
    setConnectionStatus("Please connect your wallet first");
    return;
  }
  
  // Get the contract address
  const address = getContractAddress();
  if (!address) {
    setConnectionStatus("No contract address provided");
    return;
  }
  
  // Get API
  const api = getCrowdfundingApi();
  if (!api) {
    setConnectionStatus("Error: API not initialized");
    return;
  }
  
  // Disable the button during processing
  const endCampaignBtn = document.querySelector("#end-campaign-btn") as HTMLButtonElement;
  if (endCampaignBtn) {
    endCampaignBtn.disabled = true;
    endCampaignBtn.textContent = "Processing...";
  }
  
  // Show transaction info container
  if (elements.endCampaignTransactionLink) {
    elements.endCampaignTransactionLink.classList.remove("hidden");
    elements.endCampaignTransactionLink.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
  }
  
  // IMPORTANT: Pass the address to endCampaign
  api.endCampaign(address)
    .then((result) => {
      const txId = result.transactionPointer.identifier;
      
      // Update transaction hash display
      if (elements.endCampaignTxHash) {
        elements.endCampaignTxHash.textContent = `Transaction: ${txId}`;
      }
      
      // Update transaction link
      if (elements.endCampaignTxLink) {
        elements.endCampaignTxLink.href = `https://browser.testnet.partisiablockchain.com/transactions/${txId}`;
      }
      
      // Set status message
      setConnectionStatus("Campaign end initiated successfully. Computing results...");
      
      // Update state after a delay to see computation status
      setTimeout(updateContractState, 5000);
    })
    .catch((error) => {
      if (elements.endCampaignTransactionLink) {
        elements.endCampaignTransactionLink.innerHTML = `<div class="alert alert-error">Error: ${error.message || String(error)}</div>`;
      }
      setConnectionStatus(`Error ending campaign: ${error.message || String(error)}`);
    })
    .finally(() => {
      // Re-enable the button
      if (endCampaignBtn) {
        endCampaignBtn.disabled = false;
        endCampaignBtn.textContent = "End Campaign";
      }
    });
}

function withdrawFundsAction() {
  // User is connected
  if (!isConnected()) {
    setConnectionStatus("Please connect your wallet first");
    return;
  }
  
  // Get the contract address
  const address = getContractAddress();
  if (!address) {
    setConnectionStatus("No contract address provided");
    return;
  }
  
  // Get API
  const api = getCrowdfundingApi();
  if (!api) {
    setConnectionStatus("Error: API not initialized");
    return;
  }
  
  // Disable the button during processing
  const withdrawFundsBtn = document.querySelector("#withdraw-funds-btn") as HTMLButtonElement;
  if (withdrawFundsBtn) {
    withdrawFundsBtn.disabled = true;
    withdrawFundsBtn.textContent = "Processing...";
  }
  
  // Show transaction info container
  if (elements.withdrawFundsTransactionLink) {
    elements.withdrawFundsTransactionLink.classList.remove("hidden");
    elements.withdrawFundsTransactionLink.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
  }
  
  // IMPORTANT: Pass the address to withdrawFunds
  api.withdrawFunds(address)
    .then((result) => {
      const txId = result.transactionPointer.identifier;
      
      // Update transaction hash display
      if (elements.withdrawFundsTxHash) {
        elements.withdrawFundsTxHash.textContent = `Transaction: ${txId}`;
      }
      
      // Update transaction link
      if (elements.withdrawFundsTxLink) {
        elements.withdrawFundsTxLink.href = `https://browser.testnet.partisiablockchain.com/transactions/${txId}`;
      }
      
      // Set status message
      setConnectionStatus("Funds withdrawn successfully");
      
      // Update state to reflect the withdrawal
      updateContractState();
    })
    .catch((error) => {
      if (elements.withdrawFundsTransactionLink) {
        elements.withdrawFundsTransactionLink.innerHTML = `<div class="alert alert-error">Error: ${error.message || String(error)}</div>`;
      }
      setConnectionStatus(`Error withdrawing funds: ${error.message || String(error)}`);
    })
    .finally(() => {
      // Re-enable the button
      if (withdrawFundsBtn) {
        withdrawFundsBtn.disabled = false;
        withdrawFundsBtn.textContent = "Withdraw Funds";
      }
    });
}

// Update UI elements based on wallet connection state
export function updateWalletUI(address?: string) {
  const walletConnectSection = document.querySelector("#private-key-connect");
  const walletDisconnectSection = document.querySelector("#wallet-disconnect");
  
  if (address) {
    // Connected state
    if (walletConnectSection) walletConnectSection.classList.add("hidden");
    if (walletDisconnectSection) walletDisconnectSection.classList.remove("hidden");
    if (elements.walletAddressDisplay) {
      elements.walletAddressDisplay.textContent = address;
    }
  } else {
    // Disconnected state
    if (walletConnectSection) walletConnectSection.classList.remove("hidden");
    if (walletDisconnectSection) walletDisconnectSection.classList.add("hidden");
  }
}

// Show campaign results 
export function updateCampaignResult(isSuccessful: boolean, totalRaised: number, fundingTarget: number) {
  if (!elements.campaignResultContainer || !elements.resultBox || !elements.campaignResult) return;
  
  elements.campaignResultContainer.classList.remove("hidden");
  
  if (isSuccessful) {
    elements.resultBox.className = "result-box success";
    elements.campaignResult.textContent = "Successful";
  } else {
    elements.resultBox.className = "result-box failure";
    elements.campaignResult.textContent = "Failed";
  }
}

// Helper function to set connection status
function setConnectionStatus(status: string) {
  const statusElement = document.querySelector("#connection-status p");
  if (statusElement) {
    statusElement.textContent = status;
  }
}