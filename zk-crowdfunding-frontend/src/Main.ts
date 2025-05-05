import { getCrowdfundingApi, isConnected, setContractAddress, getContractAddress, CLIENT } from "./AppState";
import {
  connectPrivateKeyWalletClick,
  disconnectWalletClick,
  updateInteractionVisibility,
} from "./WalletIntegration";
import './App.css';
import { deserializeState, CampaignStatus } from "./contract/CrowdfundingGenerated";

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
      // The function will read values from input fields directly
      connectPrivateKeyWalletClick();
    });
  } else {
    console.warn("Private key connect button not found");
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

// Reset all transaction displays
function resetTransactionDisplays() {
  console.log("Resetting all transaction displays");
  
  const transactionInfoDisplays = [
    elements.addContributionTransactionLink,
    elements.endCampaignTransactionLink,
    elements.withdrawFundsTransactionLink
  ];
  
  transactionInfoDisplays.forEach(display => {
    if (display) {
      display.classList.add("hidden");
    }
  });
}

function contractAddressClick() {
  console.log("Contract address button clicked");
  
  if (!elements.addressInput) {
    console.error("Address input not found");
    return;
  }
  
  const address = elements.addressInput.value;
  
  if (!address) {
    setConnectionStatus("Please enter a campaign contract address");
    return;
  }
  
  // Validate that address is 21 bytes in hexadecimal format
  const regex = /^[0-9A-Fa-f]{42}$/;
  if (address.length != 42 || !regex.test(address)) {
    setConnectionStatus(`${address} is not a valid Partisia Blockchain address`);
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
    setConnectionStatus(`Error: ${error.message || String(error)}`);
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

// In Main.ts
async function addContributionFormAction() {
  console.log("Add contribution button clicked");
  
  // Test if a user has connected
  if (!isConnected()) {
    setConnectionStatus("Please connect your wallet first");
    return;
  }
  
  const contributionInput = document.querySelector("#contribution") as HTMLInputElement;
  if (!contributionInput || isNaN(parseInt(contributionInput.value, 10))) {
    setConnectionStatus("Please enter a valid contribution amount");
    return;
  }
  
  // Get API and address
  const api = getCrowdfundingApi();
  const address = getContractAddress();
  
  if (!api || !address) {
    setConnectionStatus("API or address not initialized");
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
    // Get the contract data to find token address
    const contractData = await CLIENT.getContractData(address);
    if (!contractData?.serializedContract?.openState?.openState?.data) {
      throw new Error("Could not retrieve contract data");
    }
    
    // Parse the state to get token address
    const stateBuffer = Buffer.from(
      contractData.serializedContract.openState.openState.data,
      "base64"
    );
    
    const state = deserializeState(stateBuffer);
    const tokenAddress = state.token_address?.asString();
    
    if (!tokenAddress) {
      throw new Error("Token address not found in contract state");
    }
    
    // Parse amount
    const amount = parseInt(contributionInput.value, 10);
    
    // Step 1: Check token allowance and approve if needed
    setConnectionStatus("Checking token allowance...");
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>Checking token allowance...</p>
        </div>
      `;
    }
    
    const allowance = await api.getTokenAllowance(
      tokenAddress,
      api.client.getAddress(),
      address
    );
    
    if (allowance < BigInt(amount)) {
      setConnectionStatus("Approving tokens (Step 1/3)...");
      if (transactionLinkContainer) {
        transactionLinkContainer.innerHTML = `
          <div class="alert alert-info">
            <p>Approving tokens (Step 1/3)...</p>
          </div>
        `;
      }
      
      const approvalTx = await api.approveTokens(
        tokenAddress,
        address,
        BigInt(amount)
      );
      
      setConnectionStatus("Waiting for approval confirmation...");
      if (transactionLinkContainer) {
        transactionLinkContainer.innerHTML = `
          <div class="alert alert-info">
            <p>Approval transaction submitted (Step 1/3)</p>
            <p class="transaction-hash">Transaction: ${approvalTx.transactionPointer.identifier}</p>
            <a href="https://browser.testnet.partisiablockchain.com/transactions/${approvalTx.transactionPointer.identifier}" 
               class="transaction-link" target="_blank">View in Explorer</a>
            <p>Waiting for confirmation...</p>
          </div>
        `;
      }
      
      await waitForTransaction(approvalTx.transactionPointer.identifier);
    }
    
    // Step 2: Add ZK contribution
    setConnectionStatus("Adding confidential contribution (Step 2/3)...");
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>Adding confidential contribution (Step 2/3)...</p>
        </div>
      `;
    }
    
    const zkTx = await api.addContribution(amount);
    
    setConnectionStatus("Waiting for contribution confirmation...");
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>Confidential contribution submitted (Step 2/3)</p>
          <p class="transaction-hash">Transaction: ${zkTx.transactionPointer.identifier}</p>
          <a href="https://browser.testnet.partisiablockchain.com/transactions/${zkTx.transactionPointer.identifier}" 
             class="transaction-link" target="_blank">View in Explorer</a>
          <p>Waiting for confirmation...</p>
        </div>
      `;
    }
    
    await waitForTransaction(zkTx.transactionPointer.identifier);
    
    // Step 3: Transfer tokens
    setConnectionStatus("Transferring tokens (Step 3/3)...");
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>Transferring tokens (Step 3/3)...</p>
        </div>
      `;
    }
    
    const tokenTx = await api.contributeTokens(address, amount);
    
    setConnectionStatus("Waiting for token transfer confirmation...");
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-info">
          <p>Token transfer submitted (Step 3/3)</p>
          <p class="transaction-hash">Transaction: ${tokenTx.transactionPointer.identifier}</p>
          <a href="https://browser.testnet.partisiablockchain.com/transactions/${tokenTx.transactionPointer.identifier}" 
             class="transaction-link" target="_blank">View in Explorer</a>
          <p>Waiting for confirmation...</p>
        </div>
      `;
    }
    
    await waitForTransaction(tokenTx.transactionPointer.identifier);
    
    // Save contribution receipt
    try {
      const receipt = {
        txId: tokenTx.transactionPointer.identifier,
        campaignAddress: address,
        timestamp: Date.now()
      };
      
      localStorage.setItem(
        `contribution_receipt_${address}`,
        JSON.stringify(receipt)
      );
    } catch (error) {
      console.error("Error saving receipt:", error);
    }
    
    // Success!
    setConnectionStatus("Contribution successful!");
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-success">
          <p>Contribution successful!</p>
          <p class="transaction-hash">Final Transaction: ${tokenTx.transactionPointer.identifier}</p>
          <a href="https://browser.testnet.partisiablockchain.com/transactions/${tokenTx.transactionPointer.identifier}" 
             class="transaction-link" target="_blank">View in Explorer</a>
        </div>
      `;
    }
    
    // Clear the input
    contributionInput.value = "";
    
    // Update the contract state after a delay
    setTimeout(() => {
      updateContractState();
    }, 5000);
    
  } catch (error) {
    console.error("Error in contribution process:", error);
    
    setConnectionStatus(`Error: ${error.message || String(error)}`);
    if (transactionLinkContainer) {
      transactionLinkContainer.innerHTML = `
        <div class="alert alert-error">
          <p>Error: ${error.message || String(error)}</p>
        </div>
      `;
    }
  } finally {
    // Re-enable the button
    if (addContributionBtn) {
      addContributionBtn.disabled = false;
      addContributionBtn.textContent = "Contribute";
    }
  }
}

// Helper function to wait for transaction confirmation
async function waitForTransaction(txId: string, maxAttempts = 30): Promise<boolean> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      // Get transaction status
      const response = await CLIENT.getExecutedTransaction(null, txId);
      
      if (response?.finalized) {
        return response.executionSucceeded || false;
      }
    } catch (error) {
      console.log(`Waiting for transaction ${txId}...`);
    }
    
    // Wait 2 seconds before trying again
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }
  
  throw new Error('Transaction confirmation timeout');
}

function endCampaignAction() {
  console.log("End campaign button clicked");
  
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
  
  // Create a timeout to ensure spinner doesn't run forever
  const timeoutId = setTimeout(() => {
    console.log("End campaign transaction timed out after 60 seconds");
    if (elements.endCampaignTransactionLink) {
      elements.endCampaignTransactionLink.innerHTML = '<div class="alert alert-error">Transaction timed out. It may still be processing.</div>';
    }
    if (endCampaignBtn) {
      endCampaignBtn.disabled = false;
      endCampaignBtn.textContent = "End Campaign";
    }
  }, 60000); // 60 second timeout
  
  console.log(`Ending campaign for address: ${address}`);
  
  // IMPORTANT: Pass the address to endCampaign
  try {
    api.endCampaign(address)
      .then((result) => {
        // Clear the timeout as we got a response
        clearTimeout(timeoutId);
        
        console.log("End campaign transaction successful:", result);
        const txId = result.transactionPointer.identifier;
        
        // Update transaction info display
        if (elements.endCampaignTransactionLink) {
          elements.endCampaignTransactionLink.innerHTML = '';
          
          const txInfoDiv = document.createElement('div');
          txInfoDiv.className = 'transaction-info';
          
          const txHashPara = document.createElement('p');
          txHashPara.textContent = `Transaction: ${txId}`;
          txInfoDiv.appendChild(txHashPara);
          
          const txLink = document.createElement('a');
          txLink.href = `https://browser.testnet.partisiablockchain.com/transactions/${txId}`;
          txLink.textContent = 'View in Explorer';
          txLink.className = 'transaction-link';
          txLink.target = '_blank';
          txInfoDiv.appendChild(txLink);
          
          elements.endCampaignTransactionLink.appendChild(txInfoDiv);
        }
        
        // Set status message
        setConnectionStatus("Campaign end initiated successfully. Computing results...");
        
        // Update state after a delay to see computation status
        console.log("Setting timeout to update contract state");
        setTimeout(() => {
          console.log("Executing delayed state update after ending campaign");
          updateContractState();
        }, 15000); // Increase to 15 seconds
      })
      .catch((error) => {
        // Clear the timeout as we got a response
        clearTimeout(timeoutId);
        
        console.error("Error ending campaign:", error);
        
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
  } catch (error) {
    // Clear the timeout
    clearTimeout(timeoutId);
    
    // Catch any errors that occur during API setup or call preparation
    console.error("Pre-transaction error:", error);
    
    if (elements.endCampaignTransactionLink) {
      elements.endCampaignTransactionLink.innerHTML = `<div class="alert alert-error">Setup Error: ${error.message || String(error)}</div>`;
    }
    setConnectionStatus(`Error preparing transaction: ${error.message || String(error)}`);
    
    // Re-enable the button
    if (endCampaignBtn) {
      endCampaignBtn.disabled = false;
      endCampaignBtn.textContent = "End Campaign";
    }
  }
}

function withdrawFundsAction() {
  console.log("Withdraw funds button clicked");
  
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
  
  // Create a timeout to ensure spinner doesn't run forever
  const timeoutId = setTimeout(() => {
    console.log("Withdraw funds transaction timed out after 60 seconds");
    if (elements.withdrawFundsTransactionLink) {
      elements.withdrawFundsTransactionLink.innerHTML = '<div class="alert alert-error">Transaction timed out. It may still be processing.</div>';
    }
    if (withdrawFundsBtn) {
      withdrawFundsBtn.disabled = false;
      withdrawFundsBtn.textContent = "Withdraw Funds";
    }
  }, 60000); // 60 second timeout
  
  console.log(`Withdrawing funds for address: ${address}`);
  
  // IMPORTANT: Pass the address to withdrawFunds
  try {
    api.withdrawFunds(address)
      .then((result) => {
        // Clear the timeout as we got a response
        clearTimeout(timeoutId);
        
        console.log("Withdraw funds transaction successful:", result);
        const txId = result.transactionPointer.identifier;
        
        // Update transaction info display
        if (elements.withdrawFundsTransactionLink) {
          elements.withdrawFundsTransactionLink.innerHTML = '';
          
          const txInfoDiv = document.createElement('div');
          txInfoDiv.className = 'transaction-info';
          
          const txHashPara = document.createElement('p');
          txHashPara.textContent = `Transaction: ${txId}`;
          txInfoDiv.appendChild(txHashPara);
          
          const txLink = document.createElement('a');
          txLink.href = `https://browser.testnet.partisiablockchain.com/transactions/${txId}`;
          txLink.textContent = 'View in Explorer';
          txLink.className = 'transaction-link';
          txLink.target = '_blank';
          txInfoDiv.appendChild(txLink);
          
          elements.withdrawFundsTransactionLink.appendChild(txInfoDiv);
        }
        
        // Set status message
        setConnectionStatus("Funds withdrawn successfully");
        
        // Update state to reflect the withdrawal
        console.log("Setting timeout to update contract state");
        setTimeout(() => {
          console.log("Executing delayed state update after withdrawing funds");
          updateContractState();
        }, 5000);
      })
      .catch((error) => {
        // Clear the timeout as we got a response
        clearTimeout(timeoutId);
        
        console.error("Error withdrawing funds:", error);
        
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
  } catch (error) {
    // Clear the timeout
    clearTimeout(timeoutId);
    
    // Catch any errors that occur during API setup or call preparation
    console.error("Pre-transaction error:", error);
    
    if (elements.withdrawFundsTransactionLink) {
      elements.withdrawFundsTransactionLink.innerHTML = `<div class="alert alert-error">Setup Error: ${error.message || String(error)}</div>`;
    }
    setConnectionStatus(`Error preparing transaction: ${error.message || String(error)}`);
    
    // Re-enable the button
    if (withdrawFundsBtn) {
      withdrawFundsBtn.disabled = false;
      withdrawFundsBtn.textContent = "Withdraw Funds";
    }
  }
}

function verifyContributionAction() {
  console.log("Verify contribution button clicked");
  
  if (!isConnected() || !getContractAddress() || !getCrowdfundingApi()) {
    return;
  }
  
  const address = getContractAddress();
  const api = getCrowdfundingApi();
  
  // Disable button and show loading state
  const verifyContributionBtn = document.querySelector("#verify-contribution-btn") as HTMLButtonElement;
  if (verifyContributionBtn) {
    verifyContributionBtn.disabled = true;
    verifyContributionBtn.textContent = "Verifying...";
  }
  
  // Get verification status element
  let verificationStatusEl = document.querySelector("#verification-status");
  if (!verificationStatusEl) {
    // Create element if needed...
  }
  
  console.log(`Verifying contribution for address: ${address}`);
  
  // First, send the transaction
  api.verifyContribution(address)
    .then((sentTx) => {
      console.log("Verification transaction sent:", sentTx);
      
      // Show pending status
      if (verificationStatusEl) {
        verificationStatusEl.innerHTML = `
          <div class="bg-blue-50 p-4 rounded-md border border-blue-200 mt-4">
            <p class="text-blue-700">Verification in progress...</p>
            <p class="text-sm text-blue-600 mt-2">Transaction ID: ${sentTx.transactionPointer.identifier}</p>
            <p class="text-sm text-blue-600">This may take 15-30 seconds to complete.</p>
          </div>
        `;
      }
      
      // Wait for transaction to be confirmed (poll for status)
      const checkTransactionStatus = () => {
        CLIENT.getExecutedTransaction(sentTx.transactionPointer.destinationShardId, sentTx.transactionPointer.identifier)
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
              setConnectionStatus("Your contribution has been verified successfully");
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
              setConnectionStatus("No contribution found for your wallet address");
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

// Update UI elements based on wallet connection state
export function updateWalletUI(address?: string) {
  console.log("Updating wallet UI:", address ? "Connected" : "Disconnected");
  
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

// Update UI elements with contract state
function updateUIWithContractState(state, variables) {
  // Count the number of contributions
  const contributionCount = countContributions(variables);
  
  // Update owner
  const ownerValue = document.querySelector("#owner-value");
  if (ownerValue) {
    ownerValue.innerHTML = `Project Owner: ${state.owner.asString()}`;
  }
  
  // Update title
  const titleValue = document.querySelector("#title-value");
  if (titleValue) {
    titleValue.innerHTML = `<h4>${state.title}</h4>`;
  }
  
 // Update description
 const descriptionValue = document.querySelector("#description-value");
 if (descriptionValue) {
   descriptionValue.innerHTML = `<p>${state.description}</p>`;
 }
 
 // Update status
 const statusValue = document.querySelector("#status-value");
 if (statusValue) {
   const statusText = CampaignStatus[state.status];
   statusValue.innerHTML = `Status: <span class="badge badge-${statusText.toLowerCase()}">${statusText}</span>`;
 }
 
 // Update funding target
 const fundingTargetValue = document.querySelector("#funding-target-value");
 if (fundingTargetValue) {
   fundingTargetValue.innerHTML = `Funding Target: ${state.fundingTarget}`;
 }
 
 // Update deadline
 const deadlineValue = document.querySelector("#deadline-value");
 if (deadlineValue) {
   const deadlineDate = new Date(state.deadline);
   if (state.deadline === 0) {
     deadlineValue.innerHTML = `Deadline: No deadline set`;
   } else {
     deadlineValue.innerHTML = `Deadline: ${deadlineDate.toLocaleString()}`;
   }
 }
 
 // Update contributors
 const numContributors = document.querySelector("#num-contributors");
 if (numContributors) {
   numContributors.innerHTML = `Number of Contributors: ${state.numContributors ?? contributionCount}`;
 }
 
 // Update total raised
const totalRaised = document.querySelector("#total-raised");
if (totalRaised) {
  if (state.isSuccessful) {
    totalRaised.innerHTML = `Total Raised: ${state.totalRaised}`;
  } else {
    totalRaised.innerHTML = `Total Raised: <span class="text-yellow-600">Not revealed (threshold not met)</span>`;
  }
}
 
 // Update campaign result
 const campaignResult = document.querySelector("#campaign-result");
 if (campaignResult) {
   if (state.status === CampaignStatus.Completed) {
     const resultClass = state.isSuccessful ? "result-success" : "result-failure";
     campaignResult.innerHTML = `Campaign Result: <span class="result-indicator ${resultClass}">${state.isSuccessful ? "Successful" : "Failed"}</span>`;
     
     // Show the result container if needed
     const campaignResultContainer = document.querySelector("#campaign-result-container");
     if (campaignResultContainer) {
       campaignResultContainer.classList.remove("hidden");
     }
     
     // Update result box styling
     const resultBox = document.querySelector("#result-box");
     if (resultBox) {
       resultBox.className = state.isSuccessful ? "result-box success" : "result-box failure";
     }
   } else {
     campaignResult.innerHTML = "Campaign Result: Not yet determined";
   }
 }
}

// Update action visibility based on contract state
function updateActionVisibility(state) {
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

  // Show appropriate sections based on state
  if (state.status === CampaignStatus.Active) {
    // Anyone can contribute when campaign is active
    if (addContributionSection) {
      addContributionSection.classList.remove("hidden");
    }
    // Anyone can end campaign (owner or anyone after deadline)
    if (endCampaignSection) {
      endCampaignSection.classList.remove("hidden");
    }
  } else if (state.status === CampaignStatus.Completed) {
    // Show verification for completed campaigns
    if (verificationSection) {
      verificationSection.classList.remove("hidden");
    }
    
    // Only show withdraw if campaign was successful and user is owner
    if (state.isSuccessful && withdrawFundsSection) {
      withdrawFundsSection.classList.remove("hidden");
    }
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

// Helper function to set connection status
function setConnectionStatus(status: string) {
 console.log("Status update:", status);
 const statusElement = document.querySelector("#connection-status p");
 if (statusElement) {
   statusElement.textContent = status;
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