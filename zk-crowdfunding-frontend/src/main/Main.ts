import { getCrowdfundingApi, isConnected, setContractAddress, getContractAddress, setFactoryAddress, getFactoryAddress } from "./AppState";
import {
  connectPrivateKeyWalletClick,
  disconnectWalletClick,
  updateContractState,
  updateInteractionVisibility,
} from "./WalletIntegration";

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
  }

  // Refresh state
  const updateStateBtn = document.querySelector("#update-state-btn");
  if (updateStateBtn) {
    updateStateBtn.addEventListener("click", updateContractState);
  }

  // Campaign actions
  const startCampaignBtn = document.querySelector("#start-campaign-btn");
  if (startCampaignBtn) {
    startCampaignBtn.addEventListener("click", startCampaignAction);
  }

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
        showMessage(`Registration failed: ${error.message}`, "error");
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
        showMessage(`Failed: ${error.message}`, "error");
      });
  }
}

function addContributionFormAction() {
  if (!isConnected()) {
    showMessage("Connect wallet first", "error");
    return;
  }
  
  const contribution = document.querySelector("#contribution") as HTMLInputElement;
  const amount = parseInt(contribution?.value, 10);
  
  if (isNaN(amount) || amount <= 0) {
    showMessage("Invalid amount", "error");
    return;
  }
  
  const api = getCrowdfundingApi();
  if (api) {
    showMessage("Submitting contribution...", "info");
    
    api.addContribution(amount)
      .then((result) => {
        showMessage(`Contribution submitted! TX: ${result.transactionPointer.identifier}`, "success");
        setTimeout(updateContractState, 5000);
      })
      .catch((error) => {
        showMessage(`Failed: ${error.message}`, "error");
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
        showMessage(`Failed: ${error.message}`, "error");
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
        showMessage(`Failed: ${error.message}`, "error");
      });
  }
}

function showMessage(message: string, type: "success" | "error" | "info") {
  const messageEl = document.createElement("div");
  messageEl.className = `message-${type}`;
  messageEl.textContent = message;
  
  const container = document.querySelector("#messages");
  if (container) {
    container.appendChild(messageEl);
    setTimeout(() => messageEl.remove(), 5000);
  }
}