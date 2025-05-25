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

  // Verify contribution
  const verifyContributionBtn = document.querySelector("#verify-contribution-btn");
  if (verifyContributionBtn) {
    verifyContributionBtn.addEventListener("click", verifyContributionAction);
  } else {
    console.warn("Verify contribution button not found");
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

async function addContributionFormAction() {
  console.log("Add contribution button clicked");
  
  // Test if a user has connected
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
  
  // Updated validation limits for the new scaling
  if (contributionValue < 0.000001 || contributionValue > 2147.483647) {
    showApplicationMessage("Please enter a contribution amount between 0.000001 and 2147.483647");
    return;
  }
  
  // Get API and address
  const api = getCrowdfundingApi();
  const address = getContractAddress();
  
  if (!api || !address) {
    showApplicationMessage("API or address not initialized");
    return;
  }
  
  // Disable the button during processing
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
    // Get contract data with proper error handling
    const contractData = await CLIENT.getContractData(address);
    
    // Safely extract token address from contract state
    const { tokenAddress } = safelyExtractContractState(contractData);
    
    // Show processing status
    showApplicationMessage("Processing contribution...");
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>Processing contribution of ${contributionValue} tokens...</p>
          <div class="spinner mt-2"></div>
        </div>
      `;
    }
    
    // Convert to token units for display
    const tokenUnits = displayAmountToTokenUnits(contributionValue);
    console.log(`Converting contribution: Display=${contributionValue} -> TokenUnits=${tokenUnits}`);
    
    // Use the combined method that handles both approval and contribution
    const result = await api.addContributionWithApproval(contributionValue, address, tokenAddress);
    
    // Extract transaction IDs safely
    let zkTxId = "unknown";
    let tokenTxId = "unknown";
    
    // Handle approval feedback if applicable
    if (result.approvalResult) {
      const approvalTxId = result.approvalResult.transaction?.transactionPointer?.identifier || "unknown";
      console.log("Approval transaction:", approvalTxId);
    }
    
    // Handle the contribution transaction details safely
    const contributionResult = result.contributionResult;
    if (contributionResult.metadata) {
      // Extract transaction IDs with proper type checks
      if (contributionResult.metadata.zkTransaction) {
        if (typeof contributionResult.metadata.zkTransaction === 'string') {
          zkTxId = contributionResult.metadata.zkTransaction;
        } else if (contributionResult.metadata.zkTransaction.id) {
          zkTxId = contributionResult.metadata.zkTransaction.id;
        }
      }
      
      if (contributionResult.metadata.tokenTransaction) {
        if (typeof contributionResult.metadata.tokenTransaction === 'string') {
          tokenTxId = contributionResult.metadata.tokenTransaction;
        } else if (contributionResult.metadata.tokenTransaction.id) {
          tokenTxId = contributionResult.metadata.tokenTransaction.id;
        }
      }
    }
    
    // Use ZK transaction ID for status checking, with proper fallbacks
    const primaryTxId = zkTxId !== "unknown" ? zkTxId : 
                        (tokenTxId !== "unknown" ? tokenTxId : 
                        (contributionResult.transaction?.transactionPointer?.identifier || "unknown"));
    
    console.log("Contribution transactions:", { zkTxId, tokenTxId, primaryTxId });
    
    // Update UI with transaction info
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>Contribution submitted successfully!</p>
          <p><strong>Amount:</strong> ${contributionValue} (${tokenUnits} token units)</p>
          <p class="transaction-hash">Transaction ID: ${primaryTxId}</p>
          <a href="https://browser.testnet.partisiablockchain.com/transactions/${primaryTxId}" 
             class="transaction-link" target="_blank">View in Explorer</a>
          <p class="mt-2">Transaction is processing...</p>
          <div class="spinner"></div>
        </div>
      `;
      
      // Add a refresh button
      const refreshButton = document.createElement('button');
      refreshButton.className = 'btn btn-secondary mt-2';
      refreshButton.textContent = 'Refresh Contract State';
      refreshButton.addEventListener('click', updateContractState);
      
      transactionLinkContainer.appendChild(refreshButton);
    }
    
    // Clear the input
    contributionInput.value = "";
    
    // Schedule status checking
    scheduleTransactionStatusCheck(
      primaryTxId,
      api,
      (txId) => {
        // Success callback
        if (transactionLinkContainer) {
          transactionLinkContainer.innerHTML = `
            <div class="alert alert-success">
              <p>Contribution successful!</p>
              <p><strong>Amount:</strong> ${contributionValue} (${tokenUnits} token units)</p>
              <p class="transaction-hash">Transaction ID: ${txId}</p>
              <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
                 class="transaction-link" target="_blank">View in Explorer</a>
              <button id="refresh-state-btn" class="btn btn-secondary mt-2">Refresh Contract State</button>
            </div>
          `;
          
          // Add event listener to the refresh button
          const refreshBtn = document.querySelector("#refresh-state-btn");
          if (refreshBtn) {
            refreshBtn.addEventListener("click", updateContractState);
          }
        }
        
        // Update contract state
        updateContractState();
      },
      (txId, error) => {
        // Failure callback
        if (transactionLinkContainer) {
          transactionLinkContainer.innerHTML = `
            <div class="alert alert-error">
              <p>Contribution failed: ${error || 'Unknown error'}</p>
              <p class="transaction-hash">Transaction ID: ${txId}</p>
              <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
                 class="transaction-link" target="_blank">View in Explorer</a>
              <button id="retry-contribution" class="btn btn-primary mt-2">Retry</button>
            </div>
          `;
          
          // Add retry button
          const retryBtn = document.querySelector("#retry-contribution");
          if (retryBtn) {
            retryBtn.addEventListener("click", () => {
              // Reset UI
              if (transactionLinkContainer) {
                transactionLinkContainer.innerHTML = '';
                transactionLinkContainer.classList.add("hidden");
              }
            });
          }
        }
      },
      (txId, attempt) => {
        // Pending callback - show progress after a few attempts
        if (attempt === 5) {
          if (transactionLinkContainer) {
            transactionLinkContainer.innerHTML = `
              <div class="alert alert-info">
                <p>Transaction is still processing...</p>
                <p class="transaction-hash">Transaction ID: ${txId}</p>
                <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
                   class="transaction-link" target="_blank">View in Explorer</a>
                <div class="spinner mt-2"></div>
              </div>
            `;
          }
        }
      }
    );
    
    // Set a fallback timer to update the state
    setTimeout(() => {
      updateContractState();
    }, 30000);
    
  } catch (error) {
    console.error("Error in contribution process:", error);
    
    showApplicationMessage(`Error: ${error.message || String(error)}`);
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-error">
          <p>Error: ${error.message || String(error)}</p>
          <p>Please try again or check the console for more details.</p>
          <button id="retry-contribution" class="btn btn-primary mt-2">Retry</button>
        </div>
      `;
      
      // Add retry button
      const retryBtn = document.querySelector("#retry-contribution");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
          // Reset UI
          if (transactionLinkContainer) {
            transactionLinkContainer.innerHTML = '';
          }
          
          // Re-enable the button for manual retry
          if (addContributionBtn) {
            addContributionBtn.disabled = false;
            addContributionBtn.textContent = "Contribute";
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

function verifyContributionAction() {
  console.log("Verify contribution button clicked");
  
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
  const verifyContributionBtn = document.querySelector("#verify-contribution-btn") as HTMLButtonElement;
  if (verifyContributionBtn) {
    verifyContributionBtn.disabled = true;
    verifyContributionBtn.textContent = "Verifying...";
  }
  
  // Get verification status element
  let verificationStatusEl = document.querySelector("#verification-status");
  if (!verificationStatusEl) {
    // Create element if it doesn't exist
    verificationStatusEl = document.createElement("div");
    verificationStatusEl.id = "verification-status";
    const parentElement = document.querySelector("#verification-section");
    if (parentElement) {
      parentElement.appendChild(verificationStatusEl);
    }
  }
  
  console.log(`Verifying contribution for address: ${address}`);
  
  // First, send the transaction
  api.verifyContribution(address)
    .then((sentTx) => {
      console.log("Verification transaction sent:", sentTx);
      
      // Extract transaction ID - check for the correct property based on TransactionResult interface
      const txId = sentTx.transaction?.transactionPointer?.identifier || 
                  sentTx.metadata?.txId || 
                  "unknown";
      
      // Show pending status
      if (verificationStatusEl) {
        verificationStatusEl.innerHTML = `
          <div class="bg-blue-50 p-4 rounded-md border border-blue-200 mt-4">
            <p class="text-blue-700">Verification in progress...</p>
            <p class="text-sm text-blue-600 mt-2">Transaction ID: ${txId}</p>
            <p class="text-sm text-blue-600">This may take 15-30 seconds to complete.</p>
          </div>
        `;
      }
      
      // Wait for transaction to be confirmed (poll for status)
      const checkTransactionStatus = () => {
        // Check if CLIENT and shardId are available, otherwise use fallback
        const shardId = sentTx.transaction?.transactionPointer?.destinationShardId || "Shard0";
        
        // Only try if CLIENT is defined
        if (CLIENT) {
          CLIENT.getExecutedTransaction(shardId, txId)
            .then((executedTx) => {
              if (!executedTx) {
                // Transaction not yet processed, try again after a delay
                setTimeout(checkTransactionStatus, 5000);
                return;
              }
              
              console.log("Transaction execution details:", executedTx);
              
              // Now we can check executionSucceeded
              if (executedTx.executionSucceeded) {
                // Verification was successful
                if (verificationStatusEl) {
                  verificationStatusEl.innerHTML = `
                    <div class="bg-green-50 p-4 rounded-md border border-green-200 mt-4">
                      <div class="flex items-center">
                        <svg class="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                        </svg>
                        <span class="text-green-700 font-medium">Your contribution has been verified successfully!</span>
                      </div>
                      <p class="text-sm text-green-600 mt-2">
                        Your contribution was included in the final tally of this campaign.
                      </p>
                    </div>
                  `;
                }
                showApplicationMessage("Your contribution has been verified successfully");
              } else {
                // Transaction failed, meaning no contribution found
                if (verificationStatusEl) {
                  verificationStatusEl.innerHTML = `
                    <div class="bg-yellow-50 p-4 rounded-md border border-yellow-200 mt-4">
                      <p class="text-yellow-700 font-medium">No contribution found for this wallet address.</p>
                      <p class="text-sm text-yellow-600 mt-2">
                        The verification could not confirm a contribution from your current wallet.
                        If you believe this is incorrect, please ensure you're using the same wallet
                        that you used to make your contribution.
                      </p>
                    </div>
                  `;
                }
                showApplicationMessage("No contribution found for your wallet address");
              }
            })
            .catch((error) => {
              console.error("Error checking transaction status:", error);
              
              if (verificationStatusEl) {
                verificationStatusEl.innerHTML = `
                  <div class="bg-red-50 p-4 rounded-md border border-red-200 mt-4">
                    <p class="text-red-700">Error checking verification status.</p>
                    <p class="text-sm text-red-600 mt-2">${error.message || String(error)}</p>
                  </div>
                `;
              }
            })
            .finally(() => {
              // Re-enable button
              if (verifyContributionBtn) {
                verifyContributionBtn.disabled = false;
                verifyContributionBtn.textContent = "Verify My Contribution";
              }
            });
        } else {
          // CLIENT not available, show error
          if (verificationStatusEl) {
            verificationStatusEl.innerHTML = `
              <div class="bg-red-50 p-4 rounded-md border border-red-200 mt-4">
                <p class="text-red-700">Error: Blockchain client not available.</p>
                <p class="text-sm text-red-600 mt-2">Please refresh the page and try again.</p>
              </div>
            `;
          }
          
          // Re-enable button
          if (verifyContributionBtn) {
            verifyContributionBtn.disabled = false;
            verifyContributionBtn.textContent = "Verify My Contribution";
          }
        }
      };
      
      // Start checking transaction status
      checkTransactionStatus();
    })
    .catch((error) => {
      console.error("Error sending verification transaction:", error);
      
      if (verificationStatusEl) {
        verificationStatusEl.innerHTML = `
          <div class="bg-red-50 p-4 rounded-md border border-red-200 mt-4">
            <p class="text-red-700">Error sending verification transaction.</p>
            <p class="text-sm text-red-600 mt-2">${error.message || String(error)}</p>
          </div>
        `;
      }
      
      // Re-enable button
      if (verifyContributionBtn) {
        verifyContributionBtn.disabled = false;
        verifyContributionBtn.textContent = "Verify My Contribution";
      }
    });
}

/**
 * Handle End Campaign button click.
 * This initiates the ZK computation process to calculate total contributions.
 */
async function endCampaignAction() {
  console.log("End campaign button clicked");
  
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
  const api = getCrowdfundingApi();
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
          <p>Ending campaign and starting zero-knowledge computation...</p>
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
    
    console.log("End campaign transaction sent:", txId);
    
    // Update UI with transaction info
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>Campaign end request submitted successfully!</p>
          <p class="transaction-hash">Transaction ID: ${txId}</p>
          <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
             class="transaction-link" target="_blank">View in Explorer</a>
          <p class="mt-2">Starting zero-knowledge computation...</p>
          <p class="mt-2 text-sm">This process may take several minutes to complete.</p>
          <div class="spinner"></div>
        </div>
      `;
    }
    
    // Schedule status checking to track the computation
    scheduleTransactionStatusCheck(
      txId,
      api,
      (txId) => {
        // Success callback
        if (transactionLinkContainer) {
          transactionLinkContainer.innerHTML = `
            <div class="alert alert-success">
              <p>Campaign ended successfully! ZK computation started.</p>
              <p class="transaction-hash">Transaction ID: ${txId}</p>
              <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
                 class="transaction-link" target="_blank">View in Explorer</a>
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
      },
      (txId, error) => {
        // Failure callback
        if (transactionLinkContainer) {
          transactionLinkContainer.innerHTML = `
            <div class="alert alert-error">
              <p>Failed to end campaign: ${error || 'Unknown error'}</p>
              <p class="transaction-hash">Transaction ID: ${txId}</p>
              <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
                 class="transaction-link" target="_blank">View in Explorer</a>
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
            });
          }
        }
      },
      (txId, attempt) => {
        // Pending callback - show progress after a few attempts
        if (attempt >= 3) {
          if (transactionLinkContainer) {
            transactionLinkContainer.innerHTML = `
              <div class="alert alert-info">
                <p>ZK computation in progress...</p>
                <p class="transaction-hash">Transaction ID: ${txId}</p>
                <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
                   class="transaction-link" target="_blank">View in Explorer</a>
                <p class="text-sm mt-2">The computation may take 2-5 minutes to complete.</p>
                <div class="spinner mt-2"></div>
                <button id="refresh-state-during-compute" class="btn btn-secondary mt-2">Check Status</button>
              </div>
            `;
            
            // Add refresh button during computation
            const refreshBtn = document.querySelector("#refresh-state-during-compute");
            if (refreshBtn) {
              refreshBtn.addEventListener("click", updateContractState);
            }
          }
        }
      }
    );
    
    // Set a fallback timer to update the state after a longer period
    // This helps in case the computation takes a long time
    setTimeout(() => {
      updateContractState();
    }, 120000); // 2 minutes
    
    // Set another refresh for 5 minutes
    setTimeout(() => {
      updateContractState();
    }, 300000); // 5 minutes
    
  } catch (error) {
    console.error("Error ending campaign:", error);
    
    showApplicationMessage(`Error: ${error.message || String(error)}`);
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-error">
          <p>Error ending campaign: ${error.message || String(error)}</p>
          <p>Please try again or check the console for more details.</p>
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

/**
 * Handle Withdraw Funds button click.
 * This allows the campaign owner to withdraw funds if the campaign was successful.
 */
async function withdrawFundsAction() {
  console.log("Withdraw funds button clicked");
  
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
    // Show processing status
    showApplicationMessage("Withdrawing funds...");
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>Processing withdrawal request...</p>
          <div class="spinner mt-2"></div>
        </div>
      `;
    }
    
    // Withdraw the funds
    const result = await api.withdrawFunds(address);
    
    // Get transaction ID for tracking
    const txId = result.transaction?.transactionPointer?.identifier || 
                result.metadata?.txId || 
                "unknown";
    
    console.log("Withdraw funds transaction sent:", txId);
    
    // Update UI with transaction info
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>Withdrawal request submitted successfully!</p>
          <p class="transaction-hash">Transaction ID: ${txId}</p>
          <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
             class="transaction-link" target="_blank">View in Explorer</a>
          <p class="mt-2">Processing transaction...</p>
          <div class="spinner"></div>
        </div>
      `;
    }
    
    // Schedule status checking
    scheduleTransactionStatusCheck(
      txId,
      api,
      (txId) => {
        // Success callback
        if (transactionLinkContainer) {
          transactionLinkContainer.innerHTML = `
            <div class="alert alert-success">
              <p>Funds withdrawn successfully!</p>
              <p class="transaction-hash">Transaction ID: ${txId}</p>
              <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
                 class="transaction-link" target="_blank">View in Explorer</a>
              <button id="refresh-state-btn-withdraw" class="btn btn-secondary mt-2">Refresh Contract State</button>
            </div>
          `;
          
          // Add event listener to the refresh button
          const refreshBtn = document.querySelector("#refresh-state-btn-withdraw");
          if (refreshBtn) {
            refreshBtn.addEventListener("click", updateContractState);
          }
        }
        
        // Update contract state
        updateContractState();
      },
      (txId, error) => {
        // Failure callback
        if (transactionLinkContainer) {
          transactionLinkContainer.innerHTML = `
            <div class="alert alert-error">
              <p>Failed to withdraw funds: ${error || 'Unknown error'}</p>
              <p class="transaction-hash">Transaction ID: ${txId}</p>
              <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
                 class="transaction-link" target="_blank">View in Explorer</a>
              <button id="retry-withdraw" class="btn btn-primary mt-2">Retry</button>
            </div>
          `;
          
          // Add retry button
          const retryBtn = document.querySelector("#retry-withdraw");
          if (retryBtn) {
            retryBtn.addEventListener("click", () => {
              // Reset UI
              if (transactionLinkContainer) {
                transactionLinkContainer.innerHTML = '';
                transactionLinkContainer.classList.add("hidden");
              }
            });
          }
        }
      }
    );
  } catch (error) {
    console.error("Error withdrawing funds:", error);
    
    showApplicationMessage(`Error: ${error.message || String(error)}`);
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-error">
          <p>Error withdrawing funds: ${error.message || String(error)}</p>
          <p>Please try again or check the console for more details.</p>
          <button id="retry-withdraw" class="btn btn-primary mt-2">Retry</button>
        </div>
      `;
      
      // Add retry button
      const retryBtn = document.querySelector("#retry-withdraw");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
          // Reset UI
          if (transactionLinkContainer) {
            transactionLinkContainer.innerHTML = '';
          }
          
          // Re-enable the button for manual retry
          if (withdrawFundsBtn) {
            withdrawFundsBtn.disabled = false;
            withdrawFundsBtn.textContent = "Withdraw Funds";
          }
        });
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