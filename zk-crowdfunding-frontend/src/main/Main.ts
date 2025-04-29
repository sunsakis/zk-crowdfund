// zk-crowdfunding-frontend/src/main/Main.ts
import { getCrowdfundingApi, isConnected, setContractAddress, getContractAddress } from "./AppState";
import {
  connectPrivateKeyWalletClick,
  disconnectWalletClick,
  updateContractState,
  updateInteractionVisibility,
} from "./WalletIntegration";

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
});

function setupEventListeners() {
  // Connect using private key
  const pkConnect = document.querySelector("#private-key-connect-btn");
  if (pkConnect) {
    pkConnect.addEventListener("click", () => {
      const privateKeyInput = document.querySelector("#private-key-value") as HTMLInputElement;
      if (privateKeyInput) {
        connectPrivateKeyWalletClick(privateKeyInput.value);
      }
    });
  }

  // Disconnect wallet
  const disconnectWallet = document.querySelector("#wallet-disconnect-btn");
  if (disconnectWallet) {
    disconnectWallet.addEventListener("click", disconnectWalletClick);
  }

  // Set campaign address
  const addressBtn = document.querySelector("#address-btn");
  if (addressBtn) {
    addressBtn.addEventListener("click", contractAddressClick);
  }

  // Refresh state
  const updateStateBtn = document.querySelector("#update-state-btn");
  if (updateStateBtn) {
    updateStateBtn.addEventListener("click", updateContractState);
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

function contractAddressClick() {
  const addressInput = document.querySelector("#address-value") as HTMLInputElement;
  const address = addressInput?.value;
  
  if (!address || address.length !== 42) {
    showMessage("Invalid address format", "error");
    return;
  }
  
  setContractAddress(address);
  updateInteractionVisibility();
  updateContractState();
  
  // Update browser link
  const browserLink = document.querySelector("#browser-link");
  if (browserLink) {
    browserLink.innerHTML = `<a href="https://browser.testnet.partisiablockchain.com/contracts/${address}" target="_blank">View in Partisia Explorer</a>`;
  }
  
  // Update current address display
  const currentAddress = document.querySelector("#current-address");
  if (currentAddress) {
    currentAddress.textContent = `Campaign Contract Address: ${address}`;
  }
  
  showMessage("Campaign address set", "success");
}

function addContributionFormAction() {
  if (!isConnected()) {
    showMessage("Please connect your wallet first", "error");
    return;
  }
  
  const contribution = document.querySelector("#contribution") as HTMLInputElement;
  if (!contribution?.value) {
    showMessage("Please enter a contribution amount", "error");
    return;
  }
  
  const amount = parseInt(contribution.value, 10);
  if (isNaN(amount) || amount <= 0) {
    showMessage("Please enter a valid positive number", "error");
    return;
  }
  
  const api = getCrowdfundingApi();
  if (!api) {
    showMessage("API not initialized", "error");
    return;
  }
  
  const transactionLink = document.querySelector("#add-contribution-transaction-link");
  if (transactionLink) {
    transactionLink.innerHTML = '<div class="loader"></div> Submitting contribution...';
  }
  
  api.addContribution(amount)
    .then((result) => {
      console.log("Contribution result:", result);
      contribution.value = ""; // Clear input on success
      
      if (transactionLink) {
        const txId = result.transactionPointer.identifier;
        transactionLink.innerHTML = `
          <div class="message-section success">
            Contribution submitted successfully!
          </div>
          <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
             target="_blank">View transaction in browser</a>
        `;
      }
      
      // Refresh state after a short delay
      setTimeout(updateContractState, 5000);
    })
    .catch((error) => {
      console.error("Contribution error:", error);
      
      if (transactionLink) {
        transactionLink.innerHTML = `
          <div class="message-section error">
            Error: ${error.message || String(error)}
          </div>
        `;
      }
    });
}

// In Main.ts where you handle the end campaign button
async function endCampaignAction() {
  if (!isConnected) {
    showMessage("Please connect your wallet first", "error");
    return;
  }
  
  const contractAddress = getContractAddress();
  if (!contractAddress) {
    showMessage("No campaign address set", "error");
    return;
  }
  
  const transactionLink = document.getElementById("end-campaign-transaction-link");
  if (transactionLink) {
    transactionLink.innerHTML = '<div class="loader"></div> Ending campaign...';
  }
  
  try {
    // Get the API
    const api = getCrowdfundingApi();
    if (!api) {
      throw new Error("API not initialized");
    }
    
    // Call the fixed endCampaign method
    const result = await api.endCampaign(contractAddress);
    
    // Show success message
    if (transactionLink) {
      transactionLink.innerHTML = `
        <div class="message-section success">
          Campaign end initiated successfully!
        </div>
        <a href="https://browser.testnet.partisiablockchain.com/transactions/${result.transactionPointer.identifier}" 
           target="_blank">View transaction in explorer</a>
      `;
    }
    
    showMessage("Campaign end initiated - computing results", "success");
    
    // Refresh state after a delay
    setTimeout(updateContractState, 5000);
  } catch (error) {
    if (transactionLink) {
      transactionLink.innerHTML = `
        <div class="message-section error">
          Error: ${error instanceof Error ? error.message : String(error)}
        </div>
      `;
    }
    
    showMessage(`Error ending campaign: ${error instanceof Error ? error.message : String(error)}`, "error");
  }
}

function withdrawFundsAction() {
  if (!isConnected()) {
    showMessage("Please connect your wallet first", "error");
    return;
  }
  
  const api = getCrowdfundingApi();
  const address = getContractAddress();
  
  if (!api || !address) {
    showMessage("No campaign selected", "error");
    return;
  }
  
  const transactionLink = document.querySelector("#withdraw-funds-transaction-link");
  if (transactionLink) {
    transactionLink.innerHTML = '<div class="loader"></div> Withdrawing funds...';
  }
  
  api.withdrawFunds(address)
    .then((result) => {
      console.log("Withdraw funds result:", result);
      
      if (transactionLink) {
        const txId = result.transactionPointer.identifier;
        transactionLink.innerHTML = `
          <div class="message-section success">
            Funds withdrawal successful!
          </div>
          <a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" 
             target="_blank">View transaction in browser</a>
        `;
      }
      
      // Refresh state
      updateContractState();
    })
    .catch((error) => {
      console.error("Withdraw funds error:", error);
      
      if (transactionLink) {
        transactionLink.innerHTML = `
          <div class="message-section error">
            Error: ${error.message || String(error)}
          </div>
        `;
      }
    });
}

function showMessage(message, type) {
  console.log(`${type.toUpperCase()}: ${message}`);
  
  const container = document.querySelector("#messages-container");
  if (!container) return;
  
  const messageEl = document.createElement("div");
  messageEl.className = `message-section ${type}`;
  messageEl.textContent = message;
  
  container.appendChild(messageEl);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    messageEl.remove();
  }, 5000);
}

// Helper function to show the connection status
function setConnectionStatus(status) {
  const statusText = document.querySelector("#connection-status p");
  if (statusText) {
    statusText.textContent = status;
  }
}

// Helper function to toggle visibility
function toggleVisibility(selector) {
  const element = document.querySelector(selector);
  if (element) {
    element.classList.toggle("hidden");
  }
}