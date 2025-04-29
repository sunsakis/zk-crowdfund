// Fixed Main.ts for ZK Crowdfunding Platform - with proper wallet connection

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
  // Connect using private key button - IMPORTANT: Don't directly call the function, just set it as the event handler
  const pkConnect = document.querySelector("#private-key-connect-btn");
  if (pkConnect) {
    // This preserves all the context handling in the original WalletIntegration.ts
    pkConnect.addEventListener("click", () => {
      // This just calls the existing function without passing parameters
      // The function will read the value from the input field itself
      connectPrivateKeyWalletClick();
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
  
  if (!address) {
    setConnectionStatus("No address provided");
    return;
  }
  
  // Validate that address is 21 bytes in hexadecimal format
  const regex = /[0-9A-Fa-f]{42}/g;
  if (address.length != 42 || address.match(regex) == null) {
    setConnectionStatus(`${address} is not a valid PBC address`);
    return;
  }
  
  // Update the contract state
  setContractAddress(address);
  updateInteractionVisibility();
  
  // Show address and link to the browser
  const currentAddressElement = document.querySelector("#current-address");
  if (currentAddressElement) {
    currentAddressElement.innerHTML = `Campaign Contract Address: ${address}`;
  }
  
  const browserLink = document.querySelector("#browser-link");
  if (browserLink) {
    browserLink.innerHTML = `<a href="https://browser.testnet.partisiablockchain.com/contracts/${address}" target="_blank">Browser link</a>`;
  }
  
  // Update the contract state
  updateContractState();
}

function addContributionFormAction() {
  // Test if a user has connected
  if (!isConnected()) {
    setConnectionStatus("Cannot contribute without a connected wallet!");
    return;
  }
  
  const contribution = document.querySelector("#contribution") as HTMLInputElement;
  if (!contribution || isNaN(parseInt(contribution.value, 10))) {
    setConnectionStatus("Contribution must be a number");
    return;
  }
  
  // All fields validated, add contribution
  const api = getCrowdfundingApi();
  if (!api) {
    setConnectionStatus("API not initialized");
    return;
  }
  
  // Add contribution via API
  const transactionLink = document.querySelector("#add-contribution-transaction-link");
  if (transactionLink) {
    transactionLink.innerHTML = '<br><div class="loader"></div>';
  }
  
  api.addContribution(parseInt(contribution.value, 10))
    .then((result) => {
      if (transactionLink) {
        transactionLink.innerHTML = `<br><a href="https://browser.testnet.partisiablockchain.com/transactions/${result.transactionPointer.identifier}" target="_blank">Transaction link in browser</a>`;
      }
      
      // Clear input after successful contribution
      contribution.value = "";
      
      // Update state after a delay to reflect new contribution
      setTimeout(updateContractState, 5000);
    })
    .catch((error) => {
      if (transactionLink) {
        transactionLink.innerHTML = `<br>Error: ${error.message || String(error)}`;
      }
    });
}

function endCampaignAction() {
  // User is connected
  if (!isConnected()) {
    setConnectionStatus("Cannot end campaign without a connected wallet!");
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
    setConnectionStatus("API not initialized");
    return;
  }
  
  const transactionLink = document.querySelector("#end-campaign-transaction-link");
  if (transactionLink) {
    transactionLink.innerHTML = '<br><div class="loader"></div>';
  }
  
  // CRITICAL: Pass the address to endCampaign
  api.endCampaign(address)
    .then((result) => {
      if (transactionLink) {
        const txId = result.transactionPointer.identifier;
        transactionLink.innerHTML = `<br><a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" target="_blank">Transaction link in browser</a>`;
      }
      
      // Set status message
      setConnectionStatus("Campaign end initiated successfully. Computing results...");
      
      // Update state after a delay to see computation status
      setTimeout(updateContractState, 5000);
    })
    .catch((error) => {
      if (transactionLink) {
        transactionLink.innerHTML = `<br>Error: ${error.message || String(error)}`;
      }
      setConnectionStatus(`Error ending campaign: ${error.message || String(error)}`);
    });
}

function withdrawFundsAction() {
  // User is connected
  if (!isConnected()) {
    setConnectionStatus("Cannot withdraw funds without a connected wallet!");
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
    setConnectionStatus("API not initialized");
    return;
  }
  
  const transactionLink = document.querySelector("#withdraw-funds-transaction-link");
  if (transactionLink) {
    transactionLink.innerHTML = '<br><div class="loader"></div>';
  }
  
  // IMPORTANT: Pass the address to withdrawFunds
  api.withdrawFunds(address)
    .then((result) => {
      if (transactionLink) {
        const txId = result.transactionPointer.identifier;
        transactionLink.innerHTML = `<br><a href="https://browser.testnet.partisiablockchain.com/transactions/${txId}" target="_blank">Transaction link in browser</a>`;
      }
      
      // Set status message
      setConnectionStatus("Funds withdrawn successfully");
      
      // Update state to reflect the withdrawal
      updateContractState();
    })
    .catch((error) => {
      if (transactionLink) {
        transactionLink.innerHTML = `<br>Error: ${error.message || String(error)}`;
      }
      setConnectionStatus(`Error withdrawing funds: ${error.message || String(error)}`);
    });
}

// Helper function to show connection status
function setConnectionStatus(status: string) {
  const statusText = document.querySelector("#connection-status p");
  if (statusText) {
    statusText.textContent = status;
  }
  
  console.log(`Status: ${status}`);
}