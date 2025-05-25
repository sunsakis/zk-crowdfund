import { getCrowdfundingApi, isConnected, setContractAddress, getContractAddress, CLIENT } from "./AppState";
import {
  connectPrivateKeyWalletClick,
  connectMpcWalletClick,
  connectMetaMaskWalletClick,
  disconnectWalletClick,
  updateInteractionVisibility,
} from "./WalletIntegration";
import './App.css';
import { deserializeState, CampaignStatus, stateToDisplayFormat } from "./contract/CrowdfundingGenerated";

// ============================================================================
// Update the DOMElements interface in Main.ts
// ============================================================================

/**
 * Convert raw token units to display amount
 * Raw units: 1 -> Display: 0.000001
 */
function tokenUnitsToDisplayAmount(tokenUnits: number): number {
  return tokenUnits / 1_000_000;
}

/**
 * Convert display amount to raw token units  
 * Display: 0.000001 -> Raw units: 1
 */
function displayAmountToTokenUnits(displayAmount: number): number {
  return Math.round(displayAmount * 1_000_000);
}

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
  refundTxHash: HTMLElement | null; 
  refundTxLink: HTMLAnchorElement | null; 
  
  // Transaction info containers
  addContributionTransactionLink: HTMLElement | null;
  endCampaignTransactionLink: HTMLElement | null;
  withdrawFundsTransactionLink: HTMLElement | null;

  // Campaign result elements
  campaignResultContainer: HTMLElement | null;
  resultBox: HTMLElement | null;
  campaignResult: HTMLElement | null;
  
  // Refund elements - Added for refund functionality
  refundProofStatus: HTMLElement | null;
  generateRefundProofBtn: HTMLButtonElement | null;
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
    refundTxHash: document.querySelector("#refund-tx-hash"),
    refundTxLink: document.querySelector("#refund-tx-link") as HTMLAnchorElement,
    
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

/**
 * Safely extract contract state with proper type checking
 * @param contractData Raw contract data from API response
 * @returns Buffer containing state data or throws with detailed error
 */
function safelyExtractContractState(contractData: any): { 
  stateBuffer: Buffer, 
  tokenAddress: string 
} {
  if (!contractData) {
    throw new Error("Contract data is null or undefined");
  }
  
  if (typeof contractData !== 'object') {
    throw new Error("Contract data is not an object");
  }
  
  if (!contractData.serializedContract) {
    throw new Error("Invalid contract data: missing serializedContract");
  }
  
  const serializedContract = contractData.serializedContract;
  
  if (!serializedContract.openState || 
      typeof serializedContract.openState !== 'object' ||
      !serializedContract.openState.openState ||
      typeof serializedContract.openState.openState !== 'object' ||
      typeof serializedContract.openState.openState.data !== 'string') {
    throw new Error("Invalid contract state format");
  }
  
  // Now we can safely access the data property
  const rawStateData = serializedContract.openState.openState.data;
  const stateBuffer = Buffer.from(rawStateData, "base64");
  
  // Deserialize the contract state
  const state = deserializeState(stateBuffer);
  
  // Get token address (handling both property names for compatibility)
  const tokenAddress = (state.token_address || state.tokenAddress)?.asString();
  
  if (!tokenAddress) {
    throw new Error("Contract does not have a token address configured");
  }
  
  return { stateBuffer, tokenAddress };
}

/**
 * Schedule periodic checks of a transaction's status
 * @param txId Transaction ID to check
 * @param api The CrowdfundingApi instance
 * @param onSuccess Callback for success
 * @param onFailure Callback for failure
 * @param onPending Callback for pending status
 * @param attempts Current attempt count
 * @param maxAttempts Maximum number of attempts
 */
function scheduleTransactionStatusCheck(
  txId: string,
  api?: any, // Use your CrowdfundingApi type here
  onSuccess?: (txId: string) => void,
  onFailure?: (txId: string, error?: string) => void,
  onPending?: (txId: string, attempt: number) => void,
  attempts: number = 0,
  maxAttempts: number = 10
) {
  if (!txId || attempts >= maxAttempts) {
    console.log(`Transaction status check ended for ${txId}: Max attempts reached`);
    return;
  }

  setTimeout(async () => {
    try {
      // First try to get the API from the global state if not provided
      const checkApi = api || getCrowdfundingApi();
      
      if (!checkApi) {
        console.warn("API not available for transaction check");
        if (onPending) onPending(txId, attempts);
        
        // Try again with increased attempt count
        scheduleTransactionStatusCheck(
          txId, api, onSuccess, onFailure, onPending, attempts + 1, maxAttempts
        );
        return;
      }

      const result = await checkApi.checkTransactionStatus(txId);
      
      if (result.status === 'success') {
        // Transaction successful
        console.log(`Transaction ${txId} completed successfully`);
        if (onSuccess) onSuccess(txId);
        
        // Update contract state to reflect changes
        updateContractState();
      } else if (result.status === 'failed') {
        // Transaction failed
        console.error(`Transaction ${txId} failed: ${result.errorMessage || 'Unknown error'}`);
        if (onFailure) onFailure(txId, result.errorMessage);
      } else {
        // Transaction still pending, check again after delay
        console.log(`Transaction ${txId} still pending (attempt ${attempts + 1}/${maxAttempts})`);
        if (onPending) onPending(txId, attempts);
        
        // Try again with increased attempt count
        scheduleTransactionStatusCheck(
          txId, api, onSuccess, onFailure, onPending, attempts + 1, maxAttempts
        );
      }
    } catch (error) {
      console.error(`Error checking transaction status for ${txId}:`, error);
      
      // If we hit max retries, give up and notify failure
      if (attempts >= maxAttempts - 1) {
        console.warn(`Max retry attempts reached for transaction ${txId}`);
        if (onFailure) onFailure(txId, "Max retry attempts reached");
      } else {
        // Continue checking if there was an error
        scheduleTransactionStatusCheck(
          txId, api, onSuccess, onFailure, onPending, attempts + 1, maxAttempts
        );
      }
    }
  }, 5000); // Check every 5 seconds
}

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded, initializing elements");
  initializeElements();
  setupEventListeners();
});

function setupEventListeners() {
  console.log("Setting up event listeners");
  
  // Connect using private key
  const pkConnect = document.querySelector("#private-key-connect-btn");
  if (pkConnect) {
    pkConnect.addEventListener("click", () => {
      connectPrivateKeyWalletClick();
    });
  } else {
    console.warn("Private key connect button not found");
  }

  // Connect using MPC wallet
  const mpcConnect = document.querySelector("#mpc-wallet-connect-btn");
  if (mpcConnect) {
    mpcConnect.addEventListener("click", () => {
      connectMpcWalletClick();
    });
  } else {
    console.warn("MPC wallet connect button not found");
  }

  // Connect using MetaMask
  const metamaskConnect = document.querySelector("#metamask-connect-btn");
  if (metamaskConnect) {
    metamaskConnect.addEventListener("click", () => {
      connectMetaMaskWalletClick();
    });
  } else {
    console.warn("MetaMask connect button not found");
  }

  // Disconnect wallet
  const disconnectWallet = document.querySelector("#wallet-disconnect-btn");
  if (disconnectWallet) {
    disconnectWallet.addEventListener("click", () => {
      disconnectWalletClick();
      // Reset transaction displays when disconnecting
      resetTransactionDisplays();
    });
  } else {
    console.warn("Disconnect wallet button not found");
  }

  // Set campaign address
  const addressBtn = document.querySelector("#address-btn");
  if (addressBtn) {
    addressBtn.addEventListener("click", contractAddressClick);
  } else {
    console.warn("Address button not found");
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
  } else {
    console.warn("Update state button not found");
  }

  // Campaign actions
  const addContributionBtn = document.querySelector("#add-contribution-btn");
  if (addContributionBtn) {
    addContributionBtn.addEventListener("click", addContributionFormAction);
  } else {
    console.warn("Add contribution button not found");
  }

  const endCampaignBtn = document.querySelector("#end-campaign-btn");
  if (endCampaignBtn) {
    endCampaignBtn.addEventListener("click", endCampaignAction);
  } else {
    console.warn("End campaign button not found");
  }

  const withdrawFundsBtn = document.querySelector("#withdraw-funds-btn");
  if (withdrawFundsBtn) {
    withdrawFundsBtn.addEventListener("click", withdrawFundsAction);
  } else {
    console.warn("Withdraw funds button not found");
  }
}

/**
 * Reset transaction displays for refunds
 */
function resetRefundDisplays() {
  // Remove the refund proof status display that was used in the two-step process
  const refundProofStatus = document.querySelector("#refund-proof-status");
  if (refundProofStatus) {
    refundProofStatus.classList.add("hidden");
    refundProofStatus.innerHTML = '';
  }
  
  // Clear and hide the transaction info container
  const transactionLinkContainer = document.querySelector("#claim-refund-transaction-link");
  if (transactionLinkContainer) {
    transactionLinkContainer.classList.add("hidden");
    transactionLinkContainer.innerHTML = '';
  }
}

/**
 * Update the main reset transaction displays function to include refund reset
 */
function resetTransactionDisplays() {
  console.log("Resetting all transaction displays");
  
  const transactionInfoDisplays = [
    elements.addContributionTransactionLink,
    elements.endCampaignTransactionLink,
    elements.withdrawFundsTransactionLink,
    document.querySelector("#claim-refund-transaction-link")
  ];
  
  transactionInfoDisplays.forEach(display => {
    if (display) {
      display.classList.add("hidden");
      // Clear content
      display.innerHTML = '';
    }
  });
  
  // Also reset any remaining elements from the two-step process
  resetRefundDisplays();
}

function contractAddressClick() {
  console.log("Contract address button clicked");
  
  if (!elements.addressInput) {
    console.error("Address input not found");
    return;
  }
  
  const address = elements.addressInput.value;
  
  if (!address) {
    showApplicationMessage("Please enter a campaign contract address");
    return;
  }
  
  // Validate that address is 21 bytes in hexadecimal format
  const regex = /^[0-9A-Fa-f]{42}$/;
  if (address.length != 42 || !regex.test(address)) {
    showApplicationMessage(`${address} is not a valid Partisia Blockchain address`);
    return;
  }
  
  console.log(`Setting contract address: ${address}`);
  
  try {
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
    
    // Update the contract state
    updateContractState();
  } catch (error) {
    console.error("Error setting contract address:", error);
    showApplicationMessage(`Error: ${error.message || String(error)}`);
  }
}

export const updateContractState = () => {
  console.log("Updating contract state");
  
  const address = getContractAddress();
  if (address === undefined) {
    console.error("No address provided");
    return;
  }

  // Get refreshLoader and show it
  const refreshLoader = document.querySelector("#refresh-loader");
  if (refreshLoader) {
    console.log("Showing refresh loader spinner");
    refreshLoader.classList.remove("hidden");
  } else {
    console.warn("Refresh loader not found");
  }

  // Clear any previous error messages
  const errorContainers = document.querySelectorAll(".error-message");
  errorContainers.forEach(container => container.remove());

  // Create a timeout to ensure spinner doesn't run forever
  const timeoutId = setTimeout(() => {
    console.log("Contract state update timed out after 30 seconds");
    if (refreshLoader) {
      refreshLoader.classList.add("hidden");
    }
    showErrorMessage("Updating contract state timed out. Please try refreshing again.");
  }, 30000); // 30 second timeout

  CLIENT.getContractData(address)
    .then((contract) => {
      // Clear the timeout as we got a response
      clearTimeout(timeoutId);
      
      if (contract != null && contract.serializedContract?.openState?.openState?.data) {
        try {
          console.log("Contract data received successfully");
          
          // Reads the state of the contract
          const stateBuffer = Buffer.from(
            contract.serializedContract.openState.openState.data,
            "base64"
          );
          
          // Deserialize state
          const state = deserializeState(stateBuffer);
          
          // Update the UI with contract state
          updateUIWithContractState(state, contract.serializedContract.variables);
          
          // Update action visibility based on state
          updateActionVisibility(state);

          const contractState = document.querySelector("#contract-state");
          if (contractState) {
            contractState.classList.remove("hidden");
          }
        } catch (err) {
          console.error("Error processing contract state:", err);
          showErrorMessage(`Error processing contract state: ${err.message}`);
        }
      } else {
        console.error("Contract data invalid or missing");
        showErrorMessage("Could not find data for contract. Make sure the contract is deployed correctly.");
      }
    })
    .catch(err => {
      // Clear the timeout as we got a response
      clearTimeout(timeoutId);
      
      console.error("Error fetching contract data:", err);
      showErrorMessage(`Error fetching contract data: ${err.message}`);
    })
    .finally(() => {
      // Always hide the loader when done, whether success or error
      console.log("Hiding refresh loader in finally block");
      if (refreshLoader) {
        refreshLoader.classList.add("hidden");
      }
    });
};

async function endCampaignAction() {
  console.log("End campaign button clicked");
  
  // === DEBUGGING SECTION - ADD THIS ===
  console.log("=== API DEBUG ===");
  
  const api = getCrowdfundingApi();
  console.log("API instance:", api);
  console.log("API type:", typeof api);
  console.log("API constructor name:", api?.constructor?.name);
  
  if (api) {
    console.log("API methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(api)));
    console.log("Has endCampaign method:", typeof api.endCampaign);
    console.log("All API properties:", Object.keys(api));
  } else {
    console.log("❌ API is null or undefined!");
  }
  
  // Check the import
  console.log("getCrowdfundingApi function:", getCrowdfundingApi);
  console.log("isConnected:", isConnected());
  console.log("getContractAddress:", getContractAddress());
  
  console.log("=== END DEBUG ===");
  // === END DEBUGGING SECTION ===
  
  // Check if wallet is connected
  if (!isConnected()) {
    showApplicationMessage("Please connect your wallet first");
    return;
  }
  
  // Get the campaign address
  const address = getContractAddress();
  if (!address) {
    showApplicationMessage("No campaign address found");
    return;
  }
  
  // Get the Crowdfunding API
  if (!api) {
    showApplicationMessage("API not initialized. Please try reconnecting your wallet");
    return;
  }
  
  // Disable button and show loading state
  const endCampaignBtn = document.querySelector("#end-campaign-btn") as HTMLButtonElement;
  if (endCampaignBtn) {
    endCampaignBtn.disabled = true;
    endCampaignBtn.textContent = "Processing...";
  }
  
  // Show transaction info container
  const transactionLinkContainer = document.querySelector("#end-campaign-transaction-link");
  if (transactionLinkContainer) {
    transactionLinkContainer.classList.remove("hidden");
    transactionLinkContainer.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
  }
  
  try {
    // Show processing status
    showApplicationMessage("Ending campaign and starting ZK computation...");
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>Submitting end campaign request...</p>
          <div class="spinner mt-2"></div>
        </div>
      `;
    }
    
    // End the campaign
    const result = await api.endCampaign(address);
    
    // Get transaction ID for tracking
    const txId = result.transaction?.transactionPointer?.identifier || 
                result.metadata?.txId || 
                "unknown";
    
    const shardId = result.transaction?.transactionPointer?.destinationShardId || undefined;
    
    console.log("End campaign transaction sent:", { txId, shardId });
    
    // Update UI with transaction info - but don't claim success yet
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>End campaign request submitted!</p>
          <p class="transaction-hash">Transaction ID: ${txId}</p>
          <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
             class="transaction-link" target="_blank">View in Explorer</a>
          <p class="mt-2">Verifying transaction execution...</p>
          <div class="spinner"></div>
        </div>
      `;
    }
    
    // Schedule status checking to track the actual execution result
    scheduleTransactionStatusCheck(
      txId,
      api,
      (txId) => {
        // Success callback - transaction actually succeeded
        if (transactionLinkContainer) {
          transactionLinkContainer.innerHTML = `
            <div class="alert alert-success">
              <p>✅ Campaign ended successfully! ZK computation started.</p>
              <p class="transaction-hash">Transaction ID: ${txId}</p>
              <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
                 class="transaction-link" target="_blank">View in Explorer</a>
              <div class="mt-2">
                <p class="text-sm">The zero-knowledge computation is now running to calculate the total raised amount.</p>
                <p class="text-sm">This process may take 2-5 minutes to complete.</p>
              </div>
              <button id="refresh-state-btn-end" class="btn btn-secondary mt-2">Refresh Contract State</button>
            </div>
          `;
          
          // Add event listener to the refresh button
          const refreshBtn = document.querySelector("#refresh-state-btn-end");
          if (refreshBtn) {
            refreshBtn.addEventListener("click", updateContractState);
          }
        }
        
        // Update contract state
        updateContractState();
        
        // Set periodic updates to check for computation completion
        const checkComputationProgress = setInterval(() => {
          updateContractState();
          // Stop checking after 10 minutes
          setTimeout(() => clearInterval(checkComputationProgress), 600000);
        }, 30000); // Check every 30 seconds
      },
      (txId, error) => {
        // Failure callback - transaction actually failed
        if (transactionLinkContainer) {
          transactionLinkContainer.innerHTML = `
            <div class="alert alert-error">
              <p>❌ Failed to end campaign: ${error || 'Transaction execution failed'}</p>
              <p class="transaction-hash">Transaction ID: ${txId}</p>
              <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
                 class="transaction-link" target="_blank">View in Explorer</a>
              <div class="mt-2">
                <p class="text-sm">Common reasons for failure:</p>
                <ul class="text-sm ml-4">
                  <li>• Only the campaign owner can end the campaign</li>
                  <li>• Campaign may already be ended</li>
                  <li>• Campaign may not be in Active status</li>
                </ul>
              </div>
              <button id="retry-end-campaign" class="btn btn-primary mt-2">Retry</button>
            </div>
          `;
          
          // Add retry button
          const retryBtn = document.querySelector("#retry-end-campaign");
          if (retryBtn) {
            retryBtn.addEventListener("click", () => {
              // Reset UI
              if (transactionLinkContainer) {
                transactionLinkContainer.innerHTML = '';
                transactionLinkContainer.classList.add("hidden");
              }
              
              // Re-enable the button for manual retry
              if (endCampaignBtn) {
                endCampaignBtn.disabled = false;
                endCampaignBtn.textContent = "End Campaign";
              }
            });
          }
        }
        
        // Show error message
        showApplicationMessage(`Campaign end failed: ${error || 'Unknown error'}`);
      },
      (txId, attempt) => {
        // Pending callback - show progress after a few attempts
        if (attempt >= 3) {
          if (transactionLinkContainer) {
            transactionLinkContainer.innerHTML = `
              <div class="alert alert-info">
                <p>🔄 Verifying campaign end transaction...</p>
                <p class="transaction-hash">Transaction ID: ${txId}</p>
                <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
                   class="transaction-link" target="_blank">View in Explorer</a>
                <p class="text-sm mt-2">Checking if the transaction executed successfully...</p>
                <div class="spinner mt-2"></div>
                <button id="refresh-state-during-verification" class="btn btn-secondary mt-2">Check Status</button>
              </div>
            `;
            
            // Add manual refresh button during verification
            const refreshBtn = document.querySelector("#refresh-state-during-verification");
            if (refreshBtn) {
              refreshBtn.addEventListener("click", () => {
                // Force a status check
                api.checkTransactionStatus(txId, shardId).then(status => {
                  console.log("Manual status check result:", status);
                });
                updateContractState();
              });
            }
          }
        }
      }
    );
    
    // Set fallback timers to update the state 
    setTimeout(() => {
      console.log("Fallback state update after 2 minutes");
      updateContractState();
    }, 120000); // 2 minutes
    
    setTimeout(() => {
      console.log("Fallback state update after 5 minutes");
      updateContractState();
    }, 300000); // 5 minutes
    
  } catch (error) {
    console.error("Error ending campaign:", error);
    
    showApplicationMessage(`Error: ${error.message || String(error)}`);
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-error">
          <p>Error ending campaign: ${error.message || String(error)}</p>
          <div class="mt-2">
            <p class="text-sm">This error occurred before the transaction was submitted.</p>
            <p class="text-sm">Please check:</p>
            <ul class="text-sm ml-4">
              <li>• Wallet connection is active</li>
              <li>• You are the campaign owner</li>
              <li>• Network connectivity</li>
            </ul>
          </div>
          <button id="retry-end-campaign" class="btn btn-primary mt-2">Retry</button>
        </div>
      `;
      
      // Add retry button
      const retryBtn = document.querySelector("#retry-end-campaign");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
          // Reset UI
          if (transactionLinkContainer) {
            transactionLinkContainer.innerHTML = '';
          }
          
          // Re-enable the button for manual retry
          if (endCampaignBtn) {
            endCampaignBtn.disabled = false;
            endCampaignBtn.textContent = "End Campaign";
          }
        });
      }
    }
  } finally {
    // Re-enable the button
    if (endCampaignBtn) {
      endCampaignBtn.disabled = false;
      endCampaignBtn.textContent = "End Campaign";
    }
  }
}

// Enhanced action handlers with production-grade error checking
// Add these enhanced functions to your Main.ts file

/**
 * Enhanced contribution form action with contract-level error detection
 */
async function addContributionFormAction() {
  console.log("=== ENHANCED ADD CONTRIBUTION ACTION ===");
  
  if (!isConnected()) {
    showApplicationMessage("Please connect your wallet first");
    return;
  }
  
  const contributionInput = document.querySelector("#contribution") as HTMLInputElement;
  if (!contributionInput) {
    showApplicationMessage("Error: Contribution input field not found");
    return;
  }

  const contributionValue = parseFloat(contributionInput.value);
  if (isNaN(contributionValue) || contributionValue <= 0) {
    showApplicationMessage("Please enter a valid contribution amount greater than 0");
    return;
  }
  
  // Enhanced validation limits
  if (contributionValue < 0.000001 || contributionValue > 2147.483647) {
    showApplicationMessage("Please enter a contribution amount between 0.000001 and 2147.483647");
    return;
  }
  
  const api = getCrowdfundingApi();
  const address = getContractAddress();
  
  if (!api || !address) {
    showApplicationMessage("API or address not initialized");
    return;
  }
  
  // Disable button and show loading state
  const addContributionBtn = document.querySelector("#add-contribution-btn") as HTMLButtonElement;
  if (addContributionBtn) {
    addContributionBtn.disabled = true;
    addContributionBtn.textContent = "Processing...";
  }
  
  // Show transaction info container
  const transactionLinkContainer = document.querySelector("#add-contribution-transaction-link");
  if (transactionLinkContainer) {
    transactionLinkContainer.classList.remove("hidden");
    transactionLinkContainer.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
  }
  
  try {
    // Get contract data with enhanced error handling
    const contractData = await CLIENT.getContractData(address);
    const { tokenAddress } = safelyExtractContractState(contractData);
    
    // Show initial processing status
    showApplicationMessage("Processing contribution...");
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>🔄 Processing contribution of ${contributionValue} tokens...</p>
          <div class="spinner mt-2"></div>
        </div>
      `;
    }
    
    // Convert to token units for display
    const tokenUnits = displayAmountToTokenUnits(contributionValue);
    console.log(`Converting contribution: Display=${contributionValue} -> TokenUnits=${tokenUnits}`);
    
    // Use enhanced contribution method with contract error detection
    const result = await api.addContributionWithApproval(contributionValue, address, tokenAddress);
    
    // Extract transaction details safely
    const contributionResult = result.contributionResult;
    const zkTxId = contributionResult.metadata?.zkTransaction?.id || "unknown";
    const tokenTxId = contributionResult.metadata?.tokenTransaction?.id || "unknown";
    const primaryTxId = zkTxId !== "unknown" ? zkTxId : tokenTxId;
    
    console.log("Contribution transactions:", { zkTxId, tokenTxId, primaryTxId });
    
    // Update UI with transaction info and status
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>📝 Contribution submitted successfully!</p>
          <p><strong>Amount:</strong> ${contributionValue} (${tokenUnits} token units)</p>
          <p class="transaction-hash">Primary Transaction: ${primaryTxId}</p>
          <a href="https://browser.testnet.partisiablockchain.com/transactions/${primaryTxId}" 
             class="transaction-link" target="_blank">View in Explorer</a>
          <p class="mt-2">⏳ Verifying contract execution...</p>
          <div class="spinner"></div>
        </div>
      `;
    }
    
    // Clear the input
    contributionInput.value = "";
    
    // Enhanced status checking with contract error detection
    scheduleEnhancedTransactionStatusCheck(
      primaryTxId,
      api,
      contributionResult,
      "contribution",
      (success, contractError, blockchainError) => {
        if (success && contributionResult.metadata?.overallSuccess) {
          // Both ZK and token transactions succeeded
          if (transactionLinkContainer) {
            transactionLinkContainer.innerHTML = `
              <div class="alert alert-success">
                <p>✅ Contribution successful!</p>
                <p><strong>Amount:</strong> ${contributionValue} (${tokenUnits} token units)</p>
                <div class="mt-2 bg-light p-2 rounded">
                  <p class="text-sm"><strong>ZK Input:</strong> 
                    <a href="https://browser.testnet.partisiablockchain.com/transactions/${zkTxId}" 
                       class="transaction-link" target="_blank">${zkTxId}</a> ✅</p>
                  <p class="text-sm"><strong>Token Transfer:</strong> 
                    <a href="https://browser.testnet.partisiablockchain.com/transactions/${tokenTxId}" 
                       class="transaction-link" target="_blank">${tokenTxId}</a> ✅</p>
                </div>
                <button id="refresh-state-btn-contrib" class="btn btn-secondary mt-2">Refresh Contract State</button>
              </div>
            `;
            
            const refreshBtn = document.querySelector("#refresh-state-btn-contrib");
            if (refreshBtn) {
              refreshBtn.addEventListener("click", updateContractState);
            }
          }
          updateContractState();
        } else {
          // Handle specific failure scenarios with detailed error reporting
          const errorReason = contractError || blockchainError || "Unknown error";
          const isContractError = !!contractError;
          
          if (transactionLinkContainer) {
            transactionLinkContainer.innerHTML = `
              <div class="alert alert-error">
                <p>❌ Contribution failed: ${errorReason}</p>
                <p><strong>Amount:</strong> ${contributionValue} (${tokenUnits} token units)</p>
                <div class="mt-2 bg-light p-2 rounded">
                  <p class="text-sm"><strong>Error Type:</strong> ${isContractError ? 'Contract Assertion Failure' : 'Blockchain Error'}</p>
                  ${isContractError ? `
                    <div class="mt-2 p-2 bg-yellow-50 border-yellow-200 rounded">
                      <p class="text-sm"><strong>Contract Error Details:</strong></p>
                      <p class="text-sm text-yellow-800">${contractError}</p>
                      <p class="text-sm mt-1"><strong>Common Causes:</strong></p>
                      <ul class="text-sm text-yellow-700 ml-4">
                        <li>• Campaign may not be in Active status</li>
                        <li>• ZK commitment may not have been created first</li>
                        <li>• Token transfer may have failed due to insufficient balance or allowance</li>
                        <li>• Campaign may have been ended by the owner</li>
                      </ul>
                    </div>
                  ` : ''}
                  <div class="mt-2">
                    <p class="text-sm">Transaction Details:</p>
                    <p class="text-sm">• ZK Input: <a href="https://browser.testnet.partisiablockchain.com/transactions/${zkTxId}" 
                       class="transaction-link" target="_blank">${zkTxId}</a></p>
                    <p class="text-sm">• Token Transfer: <a href="https://browser.testnet.partisiablockchain.com/transactions/${tokenTxId}" 
                       class="transaction-link" target="_blank">${tokenTxId}</a></p>
                  </div>
                </div>
                <div class="mt-3">
                  <button id="retry-contribution" class="btn btn-primary">Retry Contribution</button>
                  <button id="refresh-state-check" class="btn btn-secondary ml-2">Check Campaign Status</button>
                </div>
              </div>
            `;
            
            // Add retry and refresh buttons
            const retryBtn = document.querySelector("#retry-contribution");
            const refreshBtn = document.querySelector("#refresh-state-check");
            
            if (retryBtn) {
              retryBtn.addEventListener("click", () => {
                if (transactionLinkContainer) {
                  transactionLinkContainer.innerHTML = '';
                  transactionLinkContainer.classList.add("hidden");
                }
              });
            }
            
            if (refreshBtn) {
              refreshBtn.addEventListener("click", updateContractState);
            }
          }
        }
      }
    );
    
  } catch (error) {
    console.error("Error in contribution process:", error);
    
    // Enhanced error message with specific error type detection
    let errorMessage = error.message || String(error);
    let isContractError = false;
    
    if (error.code === 'CONTRACT_EXECUTION_FAILED' || error.contractError) {
      isContractError = true;
      errorMessage = error.contractError || error.message;
    }
    
    showApplicationMessage(`Contribution failed: ${errorMessage}`);
    
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-error">
          <p>❌ Contribution failed: ${errorMessage}</p>
          ${isContractError ? `
            <div class="mt-2 p-2 bg-red-50 border-red-200 rounded">
              <p class="text-sm"><strong>This is a contract-level error.</strong></p>
              <p class="text-sm text-red-700">The transaction was submitted but the smart contract rejected it.</p>
            </div>
          ` : `
            <div class="mt-2 p-2 bg-yellow-50 border-yellow-200 rounded">
              <p class="text-sm"><strong>This error occurred before submission.</strong></p>
              <p class="text-sm text-yellow-700">Please check your wallet connection and try again.</p>
            </div>
          `}
          <button id="retry-contribution" class="btn btn-primary mt-2">Retry</button>
        </div>
      `;
      
      const retryBtn = document.querySelector("#retry-contribution");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
          if (transactionLinkContainer) {
            transactionLinkContainer.innerHTML = '';
            transactionLinkContainer.classList.add("hidden");
          }
        });
      }
    }
  } finally {
    // Re-enable the button
    if (addContributionBtn) {
      addContributionBtn.disabled = false;
      addContributionBtn.textContent = "Contribute";
    }
  }
}

/**
 * Enhanced withdraw funds action with contract assertion checking
 */
async function withdrawFundsAction() {
  console.log("=== ENHANCED WITHDRAW FUNDS ACTION ===");
  
  if (!isConnected()) {
    showApplicationMessage("Please connect your wallet first");
    return;
  }
  
  const address = getContractAddress();
  if (!address) {
    showApplicationMessage("No campaign address found");
    return;
  }
  
  const api = getCrowdfundingApi();
  if (!api) {
    showApplicationMessage("API not initialized. Please try reconnecting your wallet");
    return;
  }
  
  // Disable button and show loading state
  const withdrawFundsBtn = document.querySelector("#withdraw-funds-btn") as HTMLButtonElement;
  if (withdrawFundsBtn) {
    withdrawFundsBtn.disabled = true;
    withdrawFundsBtn.textContent = "Processing...";
  }
  
  // Show transaction info container
  const transactionLinkContainer = document.querySelector("#withdraw-funds-transaction-link");
  if (transactionLinkContainer) {
    transactionLinkContainer.classList.remove("hidden");
    transactionLinkContainer.innerHTML = '<div class="loading-indicator"><div class="spinner"></div></div>';
  }
  
  try {
    // Pre-validate campaign state
    showApplicationMessage("Validating campaign state...");
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>🔍 Validating campaign eligibility for withdrawal...</p>
          <div class="spinner mt-2"></div>
        </div>
      `;
    }
    
    // Get current campaign state for validation
    let campaignData;
    try {
      campaignData = await api.getCampaignData(address);
      console.log("Campaign validation data:", campaignData);
    } catch (error) {
      console.warn("Could not pre-validate campaign data:", error);
    }
    
    // Show processing status
    showApplicationMessage("Processing withdrawal request...");
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>💰 Submitting withdrawal request...</p>
          <div class="spinner mt-2"></div>
        </div>
      `;
    }
    
    // Submit withdrawal transaction
    const result = await api.withdrawFunds(address);
    
    const txId = result.transaction?.transactionPointer?.identifier || "unknown";
    const shardId = result.transaction?.transactionPointer?.destinationShardId;
    
    console.log("Withdraw funds transaction sent:", { txId, shardId });
    
    // Update UI with transaction info
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>📝 Withdrawal request submitted!</p>
          <p class="transaction-hash">Transaction ID: ${txId}</p>
          <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
             class="transaction-link" target="_blank">View in Explorer</a>
          <p class="mt-2">⏳ Verifying contract execution...</p>
          <div class="spinner"></div>
        </div>
      `;
    }
    
    // Enhanced status checking with contract error detection
    scheduleEnhancedTransactionStatusCheck(
      txId,
      api,
      result,
      "withdrawal",
      (success, contractError, blockchainError) => {
        if (success) {
          // Withdrawal successful
          if (transactionLinkContainer) {
            transactionLinkContainer.innerHTML = `
              <div class="alert alert-success">
                <p>✅ Funds withdrawn successfully!</p>
                <p class="transaction-hash">Transaction ID: ${txId}</p>
                <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
                   class="transaction-link" target="_blank">View in Explorer</a>
                <div class="mt-2 bg-green-50 p-2 rounded">
                  <p class="text-sm text-green-700">💰 The campaign funds have been transferred to your wallet.</p>
                  <p class="text-sm text-green-700">You can now check your token balance.</p>
                </div>
                <button id="refresh-state-btn-withdraw" class="btn btn-secondary mt-2">Refresh Contract State</button>
              </div>
            `;
            
            const refreshBtn = document.querySelector("#refresh-state-btn-withdraw");
            if (refreshBtn) {
              refreshBtn.addEventListener("click", updateContractState);
            }
          }
          updateContractState();
        } else {
          // Handle withdrawal failure with detailed error analysis
          const errorReason = contractError || blockchainError || "Unknown error";
          const isContractError = !!contractError;
          
          if (transactionLinkContainer) {
            transactionLinkContainer.innerHTML = `
              <div class="alert alert-error">
                <p>❌ Withdrawal failed: ${errorReason}</p>
                <p class="transaction-hash">Transaction ID: ${txId}</p>
                <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
                   class="transaction-link" target="_blank">View in Explorer</a>
                <div class="mt-2 bg-light p-2 rounded">
                  <p class="text-sm"><strong>Error Type:</strong> ${isContractError ? 'Contract Assertion Failure' : 'Blockchain Error'}</p>
                  ${isContractError ? `
                    <div class="mt-2 p-2 bg-red-50 border-red-200 rounded">
                      <p class="text-sm"><strong>Contract Error Details:</strong></p>
                      <p class="text-sm text-red-800">${contractError}</p>
                      <p class="text-sm mt-1"><strong>Common Causes:</strong></p>
                      <ul class="text-sm text-red-700 ml-4">
                        <li>• Only the campaign owner can withdraw funds</li>
                        <li>• Campaign must be completed before withdrawal</li>
                        <li>• Campaign must have reached its funding target</li>
                        <li>• Funds may have already been withdrawn</li>
                        <li>• ZK computation may not have completed yet</li>
                      </ul>
                    </div>
                  ` : `
                    <div class="mt-2 p-2 bg-yellow-50 border-yellow-200 rounded">
                      <p class="text-sm text-yellow-700">This appears to be a blockchain-level error.</p>
                      <p class="text-sm text-yellow-700">Please check your wallet connection and gas fees.</p>
                    </div>
                  `}
                </div>
                <div class="mt-3">
                  <button id="retry-withdraw" class="btn btn-primary">Retry Withdrawal</button>
                  <button id="check-campaign-status" class="btn btn-secondary ml-2">Check Campaign Status</button>
                </div>
              </div>
            `;
            
            // Add retry and check status buttons
            const retryBtn = document.querySelector("#retry-withdraw");
            const checkBtn = document.querySelector("#check-campaign-status");
            
            if (retryBtn) {
              retryBtn.addEventListener("click", () => {
                if (transactionLinkContainer) {
                  transactionLinkContainer.innerHTML = '';
                  transactionLinkContainer.classList.add("hidden");
                }
              });
            }
            
            if (checkBtn) {
              checkBtn.addEventListener("click", updateContractState);
            }
          }
        }
      }
    );
    
  } catch (error) {
    console.error("Error withdrawing funds:", error);
    
    // Enhanced error handling with contract error detection
    let errorMessage = error.message || String(error);
    let isContractError = false;
    let specificGuidance = "";
    
    if (error.code) {
      switch (error.code) {
        case 'CAMPAIGN_NOT_COMPLETED':
          isContractError = true;
          specificGuidance = "The campaign must be completed before funds can be withdrawn. If the campaign is still active, you may need to end it first.";
          break;
        case 'CAMPAIGN_UNSUCCESSFUL':
          isContractError = true;
          specificGuidance = "Funds can only be withdrawn if the campaign reached its funding target. Since the target was not met, funds cannot be withdrawn.";
          break;
        case 'WALLET_NOT_CONNECTED':
          specificGuidance = "Please reconnect your wallet and try again.";
          break;
        default:
          if (error.contractError) {
            isContractError = true;
            errorMessage = error.contractError;
          }
      }
    }
    
    showApplicationMessage(`Withdrawal failed: ${errorMessage}`);
    
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-error">
          <p>❌ Withdrawal failed: ${errorMessage}</p>
          ${isContractError ? `
            <div class="mt-2 p-2 bg-red-50 border-red-200 rounded">
              <p class="text-sm"><strong>Contract Validation Failed</strong></p>
              <p class="text-sm text-red-700">${specificGuidance || 'The smart contract rejected this withdrawal request.'}</p>
            </div>
          ` : `
            <div class="mt-2 p-2 bg-yellow-50 border-yellow-200 rounded">
              <p class="text-sm"><strong>Pre-submission Error</strong></p>
              <p class="text-sm text-yellow-700">${specificGuidance || 'This error occurred before the transaction was submitted.'}</p>
            </div>
          `}
          <div class="mt-3">
            <button id="retry-withdraw" class="btn btn-primary">Retry</button>
            <button id="check-state" class="btn btn-secondary ml-2">Check Campaign State</button>
          </div>
        </div>
      `;
      
      // Add retry and check buttons
      const retryBtn = document.querySelector("#retry-withdraw");
      const checkBtn = document.querySelector("#check-state");
      
      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
          if (transactionLinkContainer) {
            transactionLinkContainer.innerHTML = '';
            transactionLinkContainer.classList.add("hidden");
          }
        });
      }
      
      if (checkBtn) {
        checkBtn.addEventListener("click", updateContractState);
      }
    }
  } finally {
    // Re-enable the button
    if (withdrawFundsBtn) {
      withdrawFundsBtn.disabled = false;
      withdrawFundsBtn.textContent = "Withdraw Funds";
    }
  }
}

/**
 * Enhanced transaction status checking with contract error detection
 */
function scheduleEnhancedTransactionStatusCheck(
  txId: string,
  api: any,
  transactionResult: any,
  transactionType: string,
  onComplete: (success: boolean, contractError?: string, blockchainError?: string) => void,
  attempts: number = 0,
  maxAttempts: number = 20
) {
  if (!txId || attempts >= maxAttempts) {
    console.log(`Enhanced status check ended for ${txId}: Max attempts reached`);
    onComplete(false, undefined, "Transaction verification timeout");
    return;
  }

  setTimeout(async () => {
    try {
      if (!api) {
        console.warn("API not available for enhanced transaction check");
        scheduleEnhancedTransactionStatusCheck(
          txId, api, transactionResult, transactionType, onComplete, attempts + 1, maxAttempts
        );
        return;
      }

      // Use enhanced status checking
      const result = await api.checkTransactionStatus(txId);
      
      if (result.status === 'success') {
        console.log(`✅ Enhanced check: ${transactionType} transaction ${txId} completed successfully`);
        onComplete(true);
        updateContractState();
      } else if (result.status === 'failed') {
        console.error(`❌ Enhanced check: ${transactionType} transaction ${txId} failed`);
        console.error("Contract error:", result.contractError);
        console.error("Blockchain error:", result.errorMessage);
        
        onComplete(false, result.contractError, result.errorMessage);
      } else {
        // Still pending
        if (attempts % 5 === 0) {
          console.log(`⏳ Enhanced check: ${transactionType} transaction ${txId} still pending (attempt ${attempts + 1}/${maxAttempts})`);
        }
        
        scheduleEnhancedTransactionStatusCheck(
          txId, api, transactionResult, transactionType, onComplete, attempts + 1, maxAttempts
        );
      }
    } catch (error) {
      console.error(`Error in enhanced status check for ${txId}:`, error);
      
      if (attempts >= maxAttempts - 1) {
        console.warn(`Max retry attempts reached for enhanced check of ${txId}`);
        onComplete(false, undefined, "Status check failed after maximum retries");
      } else {
        scheduleEnhancedTransactionStatusCheck(
          txId, api, transactionResult, transactionType, onComplete, attempts + 1, maxAttempts
        );
      }
    }
  }, 3000); // Check every 3 seconds
}

// Update UI elements based on wallet connection state
export function updateWalletUI(address?: string) {
  console.log("Updating wallet UI:", address ? "Connected" : "Disconnected");
  
  const walletConnectSection = document.querySelector("#wallet-connect-options");
  const walletDisconnectSection = document.querySelector("#wallet-disconnect");
  
  if (address) {
    // Connected state
    if (walletConnectSection) walletConnectSection.classList.add("hidden");
    if (walletDisconnectSection) walletDisconnectSection.classList.remove("hidden");
    if (elements.walletAddressDisplay) {
      elements.walletAddressDisplay.textContent = address;
    }
    // Update connection status to show connected wallet
    setWalletConnectionStatus(`Connected: ${address}`);
  } else {
    // Disconnected state
    if (walletConnectSection) walletConnectSection.classList.remove("hidden");
    if (walletDisconnectSection) walletDisconnectSection.classList.add("hidden");
    setWalletConnectionStatus("Currently not logged in.");
  }
}

// Function for counting contributions (ZK variables with type 0)
function countContributions(variables) {
  if (!Array.isArray(variables)) {
    return 0;
  }
  
  return Array.from(variables).filter(
    (v) => {
      try {
        if (v.value && v.value.information && v.value.information.data) {
          return Buffer.from(v.value.information.data, "base64").readUInt8() === 0;
        }
        return false;
      } catch (error) {
        console.error("Error filtering variables:", error);
        return false;
      }
    }
  ).length;
}

/**
 * Enhanced function to update UI with contract state - improved display formatting
 * @param {Object} state - The deserialized contract state
 * @param {Array} variables - The contract variables array
 */
function updateUIWithContractState(state, variables) {
  try {
    // Count the number of contributions
    const contributionCount = countContributions(variables);
    
    // Update owner
    const ownerValue = document.querySelector("#owner-value");
    if (ownerValue && state.owner) {
      try {
        ownerValue.innerHTML = `${state.owner.asString()}`;
      } catch (error) {
        console.error("Error displaying owner address:", error);
        ownerValue.innerHTML = `Project Owner: Unknown`;
      }
    }
    
    // Update title
    const titleValue = document.querySelector("#title-value");
    if (titleValue) {
      titleValue.innerHTML = `<h4>${state.title || "Untitled Project"}</h4>`;
    }
    
    // Update description
    const descriptionValue = document.querySelector("#description-value");
    if (descriptionValue) {
      descriptionValue.innerHTML = `<p>${state.description || "No description available"}</p>`;
    }
    
    // Update status
    const statusValue = document.querySelector("#status-value");
    if (statusValue && typeof state.status !== 'undefined') {
      const statusText = CampaignStatus[state.status] || "Unknown";
      statusValue.innerHTML = `<span class="badge badge-${statusText.toLowerCase()}">${statusText}</span>`;
    }
    
    // Update funding target - convert from raw token units to display amount
    const fundingTargetValue = document.querySelector("#funding-target-value");
    if (fundingTargetValue) {
      const displayTarget = tokenUnitsToDisplayAmount(state.fundingTarget || 0);
      fundingTargetValue.innerHTML = `${displayTarget.toLocaleString(undefined, {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6
      })}`;
    }
    
    // Update contributors
    const numContributors = document.querySelector("#num-contributors");
    if (numContributors) {
      numContributors.innerHTML = `${state.numContributors ?? contributionCount}`;
    }
    
    // Update total raised - with improved formatting
    const totalRaised = document.querySelector("#total-raised");
    if (totalRaised) {
      if (state.status === CampaignStatus.Completed && state.isSuccessful && state.totalRaised !== undefined) {
        // For completed successful campaigns, show the formatted amount
        const displayAmount = tokenUnitsToDisplayAmount(state.totalRaised);
        totalRaised.innerHTML = `${displayAmount.toLocaleString(undefined, {
          minimumFractionDigits: 6,
          maximumFractionDigits: 6
        })}`;
      } else if (state.status === CampaignStatus.Completed) {
        // For completed unsuccessful campaigns
        totalRaised.innerHTML = `<span class="text-yellow-600">Not revealed (threshold not met)</span>`;
      } else {
        // For campaigns in progress
        totalRaised.innerHTML = `<span class="text-blue-600">Redacted</span>`;
      }
    }
    
    // Update campaign result
    const campaignResult = document.querySelector("#campaign-result");
    if (campaignResult) {
      if (state.status === CampaignStatus.Completed) {
        const resultClass = state.isSuccessful ? "result-success" : "result-failure";
        campaignResult.innerHTML = `<span class="result-indicator ${resultClass}">${state.isSuccessful ? "Successful" : "Failed"}</span>`;
        
        // Show the campaign result container when completed
        const campaignResultContainer = document.querySelector("#campaign-result-container");
        if (campaignResultContainer) {
          campaignResultContainer.classList.remove("hidden");
          
          // Update result box styling
          const resultBox = document.querySelector("#result-box");
          if (resultBox) {
            resultBox.className = state.isSuccessful ? "result-box success" : "result-box failure";
          }
        }
      } else {
        campaignResult.innerHTML = "Not yet determined";
      }
    }
    
    // Log the state for debugging with conversions
    console.log("Contract state display info:", {
      fundingTargetRaw: state.fundingTarget,
      fundingTargetDisplay: tokenUnitsToDisplayAmount(state.fundingTarget || 0),
      totalRaisedRaw: state.totalRaised,
      totalRaisedDisplay: state.totalRaised ? tokenUnitsToDisplayAmount(state.totalRaised) : undefined,
      status: state.status,
      isSuccessful: state.isSuccessful
    });
  } catch (error) {
    console.error("Error updating UI with contract state:", error);
    showErrorMessage(`Error updating UI: ${error.message}`);
  }
}

/**
 * Update action visibility based on contract state
 */
function updateActionVisibility(state) {
  try {
    const addContributionSection = document.querySelector("#add-contribution-section");
    const endCampaignSection = document.querySelector("#end-campaign-section");
    const withdrawFundsSection = document.querySelector("#withdraw-funds-section");
    const verificationSection = document.querySelector("#verification-section");

    // Reset all to hidden
    if (addContributionSection) addContributionSection.classList.add("hidden");
    if (endCampaignSection) endCampaignSection.classList.add("hidden");
    if (withdrawFundsSection) withdrawFundsSection.classList.add("hidden");
    if (verificationSection) verificationSection.classList.add("hidden");

    // Only show actions if user is connected
    if (!isConnected()) {
      return;
    }

    console.log("Updating action visibility for state:", state);

    // Show appropriate sections based on state
    if (state.status === CampaignStatus.Active) {
      // Anyone can contribute when campaign is active
      if (addContributionSection) {
        addContributionSection.classList.remove("hidden");
      }
      // owner can end campaign
      if (endCampaignSection) {
        endCampaignSection.classList.remove("hidden");
      }
    } else if (state.status === CampaignStatus.Completed) {
      // Show verification for completed campaigns
      if (verificationSection) {
        verificationSection.classList.remove("hidden");
      }
      
      if (state.isSuccessful || !state.isSuccessful) {
        if (withdrawFundsSection) {
          withdrawFundsSection.classList.remove("hidden");
        }
      } 
    }
  } catch (error) {
    console.error("Error updating action visibility:", error);
  }
}

// Show campaign results 
export function updateCampaignResult(isSuccessful: boolean, totalRaised: number, fundingTarget: number) {
 const campaignResultContainer = document.querySelector("#campaign-result-container");
 const resultBox = document.querySelector("#result-box");
 const campaignResult = document.querySelector("#campaign-result");
 
 if (!campaignResultContainer || !resultBox || !campaignResult) return;
 
 campaignResultContainer.classList.remove("hidden");
 
 if (isSuccessful) {
   resultBox.className = "result-box success";
   campaignResult.textContent = "Successful";
 } else {
   resultBox.className = "result-box failure";
   campaignResult.textContent = "Failed";
 }
}

// FIXED: Separate wallet connection status from general application messages
function setWalletConnectionStatus(status: string) {
  console.log("Wallet connection status update:", status);
  const statusElement = document.querySelector("#connection-status p");
  if (statusElement) {
    statusElement.textContent = status;
  }
}

// NEW: Separate function for general application messages
function showApplicationMessage(message: string) {
  console.log("Application message:", message);
  // Show in a temporary notification area or console only
  // Don't overwrite the wallet connection status
  
  // You could create a separate message area for these if needed
  const messageArea = document.querySelector("#application-messages");
  if (messageArea) {
    messageArea.textContent = message;
    messageArea.classList.remove("hidden");
    messageArea.className = "alert alert-info";
    // Auto-clear after 5 seconds
    setTimeout(() => {
      messageArea.textContent = "";
      messageArea.classList.add("hidden");
    }, 5000);
  }
}

// Helper function to show error messages
function showErrorMessage(message) {
 console.error(message);
 
 const errorElement = document.createElement("div");
 errorElement.className = "error-message";
 errorElement.style.color = "red";
 errorElement.style.padding = "10px";
 errorElement.style.marginTop = "10px";
 errorElement.style.border = "1px solid red";
 errorElement.style.borderRadius = "5px";
 errorElement.textContent = message;
 
 const contractState = document.querySelector("#contract-state");
 if (contractState) {
   contractState.appendChild(errorElement);
 } else {
   // If contract state section doesn't exist yet, add to the main content
   const mainContent = document.querySelector(".pure-u-1-1");
   if (mainContent) {
     mainContent.appendChild(errorElement);
   }
 }
}