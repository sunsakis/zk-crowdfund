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
  const regex = /[0-9A-Fa-f]{42}/g;
  if (address.length != 42 || address.match(regex) == null) {
    setConnectionStatus(`${address} is not a valid Partisia Blockchain address`);
    return;
  }
  
  console.log(`Setting contract address: ${address}`);
  
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

function addContributionFormAction() {
  console.log("Add contribution button clicked");
  
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
  
  const amount = parseInt(elements.contributionInput.value, 10);
  console.log(`Adding contribution of ${amount}`);
  
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
  
  // Create a timeout to ensure spinner doesn't run forever
  const timeoutId = setTimeout(() => {
    console.log("Contribution transaction timed out after 60 seconds");
    if (elements.addContributionTransactionLink) {
      elements.addContributionTransactionLink.innerHTML = '<div class="alert alert-error">Transaction timed out. It may still be processing.</div>';
    }
    if (addContributionBtn) {
      addContributionBtn.disabled = false;
      addContributionBtn.textContent = "Contribute";
    }
  }, 60000); // 60 second timeout
  
  // Add contribution via API
  api.addContribution(amount)
    .then((result) => {
      // Clear the timeout as we got a response
      clearTimeout(timeoutId);
      
      console.log("Contribution transaction submitted successfully:", result);
      const txId = result.transactionPointer.identifier;
      
      // Update transaction hash display
      if (elements.contributionTxHash) {
        elements.contributionTxHash.textContent = `Transaction: ${txId}`;
      }
      
      // Update transaction link
      if (elements.contributionTxLink) {
        elements.contributionTxLink.href = `https://browser.testnet.partisiablockchain.com/transactions/${txId}`;
      }
      
      if (elements.addContributionTransactionLink) {
        elements.addContributionTransactionLink.innerHTML = '';
        
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
        
        elements.addContributionTransactionLink.appendChild(txInfoDiv);
      }
      
      // Set status message
      setConnectionStatus("Contribution submitted successfully");
      
      // Clear input after successful contribution
      if (elements.contributionInput) {
        elements.contributionInput.value = "";
      }
      
      // Update state after a delay to reflect new contribution
      console.log("Setting timeout to update contract state");
      setTimeout(() => {
        console.log("Executing delayed state update after contribution");
        updateContractState();
      }, 15000);
    })
    .catch((error) => {
      // Clear the timeout as we got a response
      clearTimeout(timeoutId);
      
      console.error("Error making contribution:", error);
      
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
   totalRaised.innerHTML = `Total Raised: ${state.totalRaised ?? "Not yet revealed"}`;
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

 // Reset all to hidden
 if (addContributionSection) addContributionSection.classList.add("hidden");
 if (endCampaignSection) endCampaignSection.classList.add("hidden");
 if (withdrawFundsSection) withdrawFundsSection.classList.add("hidden");

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
 } else if (state.status === CampaignStatus.Completed && state.isSuccessful) {
   // Only project owner can withdraw funds
   if (withdrawFundsSection) {
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