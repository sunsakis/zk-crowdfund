import { getCrowdfundingApi, isConnected, setContractAddress, getContractAddress, setFactoryAddress, getFactoryAddress } from "./AppState";
import {
  connectPrivateKeyWalletClick,
  disconnectWalletClick,
  updateContractState,
  updateInteractionVisibility,
} from "./WalletIntegration";
import { addContributionFormAction } from "./ContributionHandler";

// Event handlers
document.addEventListener('DOMContentLoaded', () => {
  // Set default factory address from environment
  const defaultFactoryAddress = process.env.REACT_APP_FACTORY_ADDRESS || "0288d02df00d84c5f582eff9eb5c0ac34869c2be3c";
  if (defaultFactoryAddress) {
    const factoryAddressInput = document.querySelector("#factory-address-value") as HTMLInputElement;
    if (factoryAddressInput) {
      factoryAddressInput.value = defaultFactoryAddress;
    }
    setFactoryAddress(defaultFactoryAddress);
  }
  
  setupEventListeners();
  
  // Debug message to confirm script execution
  console.log("ZK Crowdfunding Main.ts loaded successfully");
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
    console.log("Private key connect button listener attached");
  } else {
    console.warn("Private key connect button not found");
  }

  // Disconnect wallet
  const disconnectWallet = document.querySelector("#wallet-disconnect-btn");
  if (disconnectWallet) {
    disconnectWallet.addEventListener("click", disconnectWalletClick);
    console.log("Disconnect wallet button listener attached");
  }

  // Set factory address
  const factoryAddressBtn = document.querySelector("#factory-address-btn");
  if (factoryAddressBtn) {
    factoryAddressBtn.addEventListener("click", factoryAddressClick);
  }

  // Register campaign
  const registerCampaignBtn = document.querySelector("#register-campaign-btn");
  if (registerCampaignBtn) {
    registerCampaignBtn.addEventListener("click", registerCampaignAction);
  }

  // Set campaign address
  const addressBtn = document.querySelector("#address-btn");
  if (addressBtn) {
    addressBtn.addEventListener("click", contractAddressClick);
    console.log("Address button listener attached");
  } else {
    console.warn("Address button not found");
  }

  // Refresh state
  const updateStateBtn = document.querySelector("#update-state-btn");
  if (updateStateBtn) {
    updateStateBtn.addEventListener("click", updateContractState);
    console.log("Update state button listener attached");
  }

  // Campaign actions
  const startCampaignBtn = document.querySelector("#start-campaign-btn");
  if (startCampaignBtn) {
    startCampaignBtn.addEventListener("click", startCampaignAction);
  }

  // Add contribution - THIS IS THE KEY PART
  const addContributionBtn = document.querySelector("#add-contribution-btn");
  if (addContributionBtn) {
    addContributionBtn.addEventListener("click", (event) => {
      event.preventDefault(); // Prevent form submission
      console.log("Add contribution button clicked");
      addContributionFormAction();
    });
    console.log("Add contribution button listener attached");
  } else {
    console.warn("Add contribution button not found");
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

function factoryAddressClick() {
  const factoryAddressInput = document.querySelector("#factory-address-value") as HTMLInputElement;
  const address = factoryAddressInput?.value;
  
  if (!address || address.length !== 42) {
    showMessage("Invalid address format", "error");
    return;
  }
  
  setFactoryAddress(address);
  showMessage("Factory address set", "success");
}

function registerCampaignAction() {
  if (!isConnected()) {
    showMessage("Please connect wallet first", "error");
    return;
  }
  
  const registerAddressInput = document.querySelector("#register-address") as HTMLInputElement;
  const campaignAddress = registerAddressInput?.value;
  
  if (!campaignAddress || campaignAddress.length !== 42) {
    showMessage("Invalid campaign address", "error");
    return;
  }
  
  const api = getCrowdfundingApi();
  if (api) {
    showMessage("Registering campaign...", "info");
    
    api.registerCampaign(campaignAddress)
      .then((result) => {
        showMessage(`Campaign registered! TX: ${result.transactionPointer.identifier}`, "success");
      })
      .catch((error) => {
        showMessage(`Registration failed: ${error.message || error}`, "error");
      });
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
  showMessage("Campaign address set", "success");
}

function startCampaignAction() {
  if (!isConnected()) {
    showMessage("Connect wallet first", "error");
    return;
  }
  
  const api = getCrowdfundingApi();
  const address = getContractAddress();
  
  if (api && address) {
    showMessage("Starting campaign...", "info");
    
    api.startCampaign(address)
      .then((result) => {
        showMessage(`Campaign started! TX: ${result.transactionPointer.identifier}`, "success");
        setTimeout(updateContractState, 5000);
      })
      .catch((error) => {
        showMessage(`Failed: ${error.message || error}`, "error");
      });
  }
}

function endCampaignAction() {
  if (!isConnected()) {
    showMessage("Connect wallet first", "error");
    return;
  }
  
  const api = getCrowdfundingApi();
  const address = getContractAddress();
  
  if (api && address) {
    showMessage("Ending campaign...", "info");
    
    api.endCampaign(address)
      .then((result) => {
        showMessage(`Campaign ended! TX: ${result.transactionPointer.identifier}`, "success");
        setTimeout(updateContractState, 5000);
      })
      .catch((error) => {
        showMessage(`Failed: ${error.message || error}`, "error");
      });
  }
}

function withdrawFundsAction() {
  if (!isConnected()) {
    showMessage("Connect wallet first", "error");
    return;
  }
  
  const api = getCrowdfundingApi();
  const address = getContractAddress();
  
  if (api && address) {
    showMessage("Withdrawing funds...", "info");
    
    api.withdrawFunds(address)
      .then((result) => {
        showMessage(`Funds withdrawn! TX: ${result.transactionPointer.identifier}`, "success");
        setTimeout(updateContractState, 5000);
      })
      .catch((error) => {
        showMessage(`Failed: ${error.message || error}`, "error");
      });
  }
}

function showMessage(message: string, type: "success" | "error" | "info") {
  console.log(`Message (${type}): ${message}`);
  
  const messagesContainer = document.querySelector("#messages-container");
  if (messagesContainer) {
    const messageEl = document.createElement("div");
    messageEl.className = `message-section ${type}`;
    messageEl.textContent = message;
    
    messagesContainer.appendChild(messageEl);
    
    // Remove message after 5 seconds
    setTimeout(() => messageEl.remove(), 5000);
  } else {
    console.warn("Messages container not found");
  }
}