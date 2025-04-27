import { getCrowdfundingApi, isConnected, setContractAddress, getContractAddress, setFactoryAddress, getFactoryAddress } from "./AppState";
import {
  connectMetaMaskWalletClick,
  connectMpcWalletClick,
  connectPrivateKeyWalletClick,
  disconnectWalletClick,
  updateContractState,
  updateInteractionVisibility,
} from "./WalletIntegration";
import config from "./config";

// Track deployment steps
let currentDeploymentStep = 1;
let deploymentCommandGenerated = false;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize with default contract addresses if available
  const savedCampaignAddress = localStorage.getItem('contractAddress') || config.defaultCampaignAddress;
  const savedFactoryAddress = localStorage.getItem('factoryAddress') || config.factoryAddress;
  
  // Set factory/registry address first
  if (savedFactoryAddress) {
    const factoryAddressInput = document.querySelector("#factory-address-value") as HTMLInputElement;
    if (factoryAddressInput) {
      factoryAddressInput.value = savedFactoryAddress;
    }
    setFactoryAddress(savedFactoryAddress);
  }
  
  // Then set campaign address if available
  if (savedCampaignAddress) {
    const addressInput = document.querySelector("#address-value") as HTMLInputElement;
    if (addressInput) {
      addressInput.value = savedCampaignAddress;
    }
    
    // Set contract address and load state
    setContractAddress(savedCampaignAddress);
    updateContractState();
    
    // Update address display
    const currentAddress = document.querySelector("#current-address");
    if (currentAddress) {
      currentAddress.innerHTML = `Campaign Contract Address: ${savedCampaignAddress}`;
    }
    
    // Update browser link
    const browserLink = document.querySelector("#browser-link");
    if (browserLink) {
      browserLink.innerHTML = `<a href="https://browser.testnet.partisiablockchain.com/contracts/${savedCampaignAddress}" target="_blank">View in Blockchain Browser</a>`;
    }
  }
  
  // Setup event listeners
  setupEventListeners();
  
  // Load all campaigns if factory address is set
  if (savedFactoryAddress) {
    loadAllCampaigns();
  }
});

function setupEventListeners() {
  // Setup event listener to connect to the MPC wallet browser extension
  const connectWallet = document.querySelector("#wallet-connect-btn");
  if (connectWallet) {
    connectWallet.addEventListener("click", connectMpcWalletClick);
  }

  // Setup event listener to connect to the MetaMask snap
  const metaMaskConnect = document.querySelector("#metamask-connect-btn");
  if (metaMaskConnect) {
    metaMaskConnect.addEventListener("click", connectMetaMaskWalletClick);
  }

  // Setup event listener to connect using private key
  const pkConnect = document.querySelector("#private-key-connect-btn");
  if (pkConnect) {
    pkConnect.addEventListener("click", () => {
      const privateKeyInput = document.querySelector("#private-key-value") as HTMLInputElement;
      if (privateKeyInput) {
        connectPrivateKeyWalletClick(privateKeyInput.value);
      }
    });
  }

  // Setup event listener to drop the connection again
  const disconnectWallet = document.querySelector("#wallet-disconnect-btn");
  if (disconnectWallet) {
    disconnectWallet.addEventListener("click", disconnectWalletClick);
  }

  // Factory/Registry contract address handler
  const factoryAddressBtn = document.querySelector("#factory-address-btn");
  if (factoryAddressBtn) {
    factoryAddressBtn.addEventListener("click", factoryAddressClick);
  }

  // Generate deployment command button
  const generateDeployBtn = document.querySelector("#generate-deploy-command-btn");
  if (generateDeployBtn) {
    generateDeployBtn.addEventListener("click", generateDeployCommand);
  }

  // "I've deployed" button
  const deployedBtn = document.querySelector("#deployed-btn");
  if (deployedBtn) {
    deployedBtn.addEventListener("click", confirmDeployment);
  }

  // Register campaign button
  const registerCampaignBtn = document.querySelector("#register-campaign-btn");
  if (registerCampaignBtn) {
    registerCampaignBtn.addEventListener("click", registerCampaignAction);
  }

  // Refresh campaigns button
  const refreshCampaignsBtn = document.querySelector("#refresh-campaigns-btn");
  if (refreshCampaignsBtn) {
    refreshCampaignsBtn.addEventListener("click", loadAllCampaigns);
  }

  // Existing event listeners for campaign interactions
  const addContributionBtn = document.querySelector("#add-contribution-btn");
  if (addContributionBtn) {
    addContributionBtn.addEventListener("click", addContributionFormAction);
  }

  // Setup event listener for starting the campaign
  const startCampaignBtn = document.querySelector("#start-campaign-btn");
  if (startCampaignBtn) {
    startCampaignBtn.addEventListener("click", startCampaignAction);
  }

  // Setup event listener for ending the campaign
  const endCampaignBtn = document.querySelector("#end-campaign-btn");
  if (endCampaignBtn) {
    endCampaignBtn.addEventListener("click", endCampaignAction);
  }

  // Setup event listener for withdrawing funds
  const withdrawFundsBtn = document.querySelector("#withdraw-funds-btn");
  if (withdrawFundsBtn) {
    withdrawFundsBtn.addEventListener("click", withdrawFundsAction);
  }

  const addressBtn = document.querySelector("#address-btn");
  if (addressBtn) {
    addressBtn.addEventListener("click", contractAddressClick);
  }

  const updateStateBtn = document.querySelector("#update-state-btn");
  if (updateStateBtn) {
    updateStateBtn.addEventListener("click", updateContractState);
  }
}

/** Function for setting the factory/registry contract address */
function factoryAddressClick() {
  const factoryAddressInput = document.querySelector("#factory-address-value") as HTMLInputElement;
  if (!factoryAddressInput) {
    console.error("Factory address input field not found");
    return;
  }
  
  const address = factoryAddressInput.value;
  const regex = /[0-9A-Fa-f]{42}/g;
  if (!address) {
    showErrorMessage("Need to provide a registry contract address");
    return;
  } else if (address.length != 42 || address.match(regex) == null) {
    showErrorMessage(`${address} is not a valid PBC address. Address must be 42 characters (21 bytes) in hexadecimal format.`);
    return;
  }
  
  // Save factory address
  setFactoryAddress(address);
  localStorage.setItem('factoryAddress', address);
  
  showSuccessMessage("Registry contract address set successfully!");
  
  // Load all campaigns
  loadAllCampaigns();
}

/** Generate the deployment command based on form inputs */
function generateDeployCommand() {
  // Get form values
  const title = (document.querySelector("#campaign-title") as HTMLInputElement)?.value;
  const description = (document.querySelector("#campaign-description") as HTMLTextAreaElement)?.value;
  const target = (document.querySelector("#campaign-target") as HTMLInputElement)?.value;
  const deadline = (document.querySelector("#campaign-deadline") as HTMLInputElement)?.value;
  
  // Validate inputs
  if (!title || !description || !target || !deadline) {
    showErrorMessage("Please fill in all required fields");
    return;
  }
  
  const targetAmount = parseInt(target);
  if (isNaN(targetAmount) || targetAmount <= 0) {
    showErrorMessage("Please enter a valid target amount");
    return;
  }
  
  const deadlineTimestamp = new Date(deadline).getTime();
  if (deadlineTimestamp <= Date.now()) {
    showErrorMessage("Deadline must be in the future");
    return;
  }
  
  // Generate the deployment command
  const command = `cargo partisia-contract transaction deploy --gas 10000000 --privatekey ../Account-A.pk ../target/wasm32-unknown-unknown/release/zk_crowdfunding.pbc "${title}" "${description}" ${targetAmount} ${deadlineTimestamp}`;
  
  // Display the command
  const commandDiv = document.querySelector("#deployment-command");
  if (commandDiv) {
    commandDiv.textContent = command;
  }
  
  // Move to step 2
  currentDeploymentStep = 2;
  updateDeploymentSteps();
  deploymentCommandGenerated = true;
  
  showSuccessMessage("Deployment command generated! Copy and run it in your terminal.");
}

/** Confirm deployment and move to registration step */
function confirmDeployment() {
  // Move to step 3
  currentDeploymentStep = 3;
  updateDeploymentSteps();
  
  showInfoMessage("Great! Now enter the deployed contract address to register it with the factory.");
}

/** Register the deployed campaign with the factory/registry */
function registerCampaignAction() {
  if (!isConnected()) {
    showErrorMessage("Please connect your wallet first");
    return;
  }
  
  const registerAddressInput = document.querySelector("#register-address") as HTMLInputElement;
  const campaignAddress = registerAddressInput?.value;
  
  if (!campaignAddress) {
    showErrorMessage("Please enter the deployed campaign contract address");
    return;
  }
  
  // Validate address format
  const regex = /[0-9A-Fa-f]{42}/g;
  if (campaignAddress.length != 42 || campaignAddress.match(regex) == null) {
    showErrorMessage("Invalid contract address format");
    return;
  }
  
  const api = getCrowdfundingApi();
  if (api !== undefined) {
    showInfoMessage("Registering campaign with the factory...");
    
    // Call the registry/factory contract to register the campaign
    api.registerCampaign(campaignAddress)
      .then((transactionHash) => {
        showSuccessMessage(`Campaign registered successfully! Transaction ID: ${transactionHash.transactionPointer.identifier}`);
        
        // Reset the form and steps
        resetDeploymentForm();
        
        // Reload campaigns list
        loadAllCampaigns();
      })
      .catch((msg) => {
        showErrorMessage(`Failed to register campaign: ${msg}`);
      });
  }
}

/** Load all campaigns from the factory/registry */
function loadAllCampaigns() {
  const api = getCrowdfundingApi();
  if (!api || !getFactoryAddress()) {
    return;
  }
  
  showInfoMessage("Loading all campaigns...");
  
  api.getAllCampaigns()
    .then((campaigns) => {
      const allCampaignsList = document.querySelector("#all-campaigns-list");
      if (allCampaignsList) {
        if (campaigns.length > 0) {
          allCampaignsList.innerHTML = campaigns.map(campaign => `
            <div class="campaign-item" onclick="window.selectCampaign('${campaign.address}')">
              <h4>${campaign.title}</h4>
              <p>${campaign.description}</p>
              <p><strong>Owner:</strong> ${campaign.owner}</p>
              <p><strong>Target:</strong> ${campaign.target}</p>
              <p><strong>Deadline:</strong> ${new Date(campaign.deadline).toLocaleString()}</p>
              <p><strong>Address:</strong> ${campaign.address}</p>
            </div>
          `).join('');
        } else {
          allCampaignsList.innerHTML = "<p>No campaigns found</p>";
        }
      }
    })
    .catch((msg) => {
      showErrorMessage(`Failed to load campaigns: ${msg}`);
    });
}

/** Update the visibility of deployment steps based on current step */
function updateDeploymentSteps() {
  // Hide all steps
  document.querySelectorAll('.step-list li').forEach(step => {
    step.classList.add('hidden');
  });
  
  // Show steps up to current step
  for (let i = 1; i <= currentDeploymentStep; i++) {
    const step = document.querySelector(`#step-${i}`);
    if (step) {
      step.classList.remove('hidden');
      if (i < currentDeploymentStep) {
        step.classList.add('completed');
      }
    }
  }
}

/** Reset the deployment form and steps */
function resetDeploymentForm() {
  currentDeploymentStep = 1;
  deploymentCommandGenerated = false;
  
  // Clear form inputs
  (document.querySelector("#campaign-title") as HTMLInputElement).value = '';
  (document.querySelector("#campaign-description") as HTMLTextAreaElement).value = '';
  (document.querySelector("#campaign-target") as HTMLInputElement).value = '';
  (document.querySelector("#campaign-deadline") as HTMLInputElement).value = '';
  (document.querySelector("#register-address") as HTMLInputElement).value = '';
  
  // Reset steps visibility
  updateDeploymentSteps();
}

// Global function to select a campaign
window.selectCampaign = (address: string) => {
  const addressInput = document.querySelector("#address-value") as HTMLInputElement;
  const addressBtn = document.querySelector("#address-btn") as HTMLButtonElement;
  
  if (addressInput && addressBtn) {
    addressInput.value = address;
    addressBtn.click();
  }
};

/** Function for the contract address form */
function contractAddressClick() {
  const addressInput = document.querySelector("#address-value") as HTMLInputElement;
  if (!addressInput) {
    console.error("Address input field not found");
    return;
  }
  
  const address = addressInput.value;
  const regex = /[0-9A-Fa-f]{42}/g;
  if (address === undefined) {
    showErrorMessage("Need to provide a contract address");
    return;
  } else if (address.length != 42 || address.match(regex) == null) {
    showErrorMessage(`${address} is not a valid PBC address. Address must be 42 characters (21 bytes) in hexadecimal format.`);
    return;
  }
  
  // Show address and a link to the browser.
  const currentAddress = document.querySelector("#current-address");
  if (currentAddress) {
    currentAddress.innerHTML = `Campaign Contract Address: ${address}`;
  }
  
  const browserLink = document.querySelector("#browser-link");
  if (browserLink) {
    browserLink.innerHTML = `<a href="https://browser.testnet.partisiablockchain.com/contracts/${address}" target="_blank">View in Blockchain Browser</a>`;
  }

  // Update the contract state.
  setContractAddress(address);
  localStorage.setItem('contractAddress', address);
  updateInteractionVisibility();
  updateContractState();
}

/** Form action for adding a contribution */
function addContributionFormAction() {
  // Test if a user has connected via the MPC wallet extension
  if (isConnected()) {
    const contribution = document.querySelector("#contribution") as HTMLInputElement;
    if (!contribution) {
      console.error("Contribution input field not found");
      return;
    }
    
    if (isNaN(parseInt(contribution.value, 10))) {
      // Validate that amount is a number
      const browserLink = document.querySelector("#add-contribution-transaction-link");
      if (browserLink) {
        browserLink.innerHTML = `<br><span style="color: red;">Contribution must be a number</span>`;
      }
      return;
    }
    
    // All fields validated, add contribution.
    const api = getCrowdfundingApi();
    if (api !== undefined) {
      // Add contribution via Crowdfunding API
      const browserLink = document.querySelector("#add-contribution-transaction-link");
      if (browserLink) {
        browserLink.innerHTML = '<br><div class="loader"></div>';
      }
      
      api.addContribution(parseInt(contribution.value, 10))
        .then((transactionHash) => {
          if (browserLink) {
            browserLink.innerHTML = `<br><a href="https://browser.testnet.partisiablockchain.com/transactions/${transactionHash.transactionPointer.identifier}" target="_blank">Transaction link in browser</a>`;
          }
          showSuccessMessage("Contribution submitted successfully! It may take a few moments to be confirmed on the blockchain.");
          setTimeout(updateContractState, 5000); // Refresh after 5 seconds
        })
        .catch((msg) => {
          if (browserLink) {
            browserLink.innerHTML = `<br><span style="color: red;">${msg}</span>`;
          }
          showErrorMessage(`Failed to submit contribution: ${msg}`);
        });
    }
  } else {
    const browserLink = document.querySelector("#add-contribution-transaction-link");
    if (browserLink) {
      browserLink.innerHTML = `<br><span style="color: red;">Cannot contribute without a connected wallet!</span>`;
    }
    showErrorMessage("Please connect your wallet first to make a contribution.");
  }
}

/** Action for the start campaign button */
function startCampaignAction() {
  // User is connected and the Crowdfunding API is defined
  const api = getCrowdfundingApi();
  const browserLink = document.querySelector("#start-campaign-transaction-link");
  if (browserLink) {
    browserLink.innerHTML = '<br><div class="loader"></div>';
  }
  
  if (isConnected() && api !== undefined) {
    // Call startCampaign via the API
    api.startCampaign()
      .then((transactionHash) => {
        if (browserLink) {
          browserLink.innerHTML = `<br><a href="https://browser.testnet.partisiablockchain.com/transactions/${transactionHash.transactionPointer.identifier}" target="_blank">Transaction link in browser</a>`;
        }
        showSuccessMessage("Campaign started successfully! Contributors can now submit funds.");
        setTimeout(updateContractState, 5000); // Refresh after 5 seconds
      })
      .catch((msg) => {
        if (browserLink) {
          browserLink.innerHTML = `<br><span style="color: red;">${msg}</span>`;
        }
        showErrorMessage(`Failed to start campaign: ${msg}`);
      });
  } else {
    if (browserLink) {
      browserLink.innerHTML = `<br><span style="color: red;">Cannot start campaign without a connected wallet!</span>`;
    }
    showErrorMessage("Please connect your wallet first to start the campaign.");
  }
}

/** Action for the end campaign button */
function endCampaignAction() {
  // User is connected and the Crowdfunding API is defined
  const api = getCrowdfundingApi();
  const browserLink = document.querySelector("#end-campaign-transaction-link");
  if (browserLink) {
    browserLink.innerHTML = '<br><div class="loader"></div>';
  }
  
  if (isConnected() && api !== undefined) {
    // Call endCampaign via the API
    api.endCampaign()
      .then((transactionHash) => {
        if (browserLink) {
          browserLink.innerHTML = `<br><a href="https://browser.testnet.partisiablockchain.com/transactions/${transactionHash.transactionPointer.identifier}" target="_blank">Transaction link in browser</a>`;
        }
        
        showInfoMessage("Campaign ending! The computation to tally contributions has started. This may take a few minutes...");
        
        // Setup regular polling to check for computation completion
        const checkComputation = () => {
          updateContractState();
          const refreshTimer = setTimeout(checkComputation, 10000); // Check every 10 seconds
          
          // Check status display to see if computing is done
          const statusElement = document.querySelector("#status-value");
          if (statusElement && !statusElement.textContent?.includes("Computing")) {
            clearTimeout(refreshTimer);
            showSuccessMessage("Computation completed! The total raised amount has been revealed.");
          }
        };
        
        setTimeout(checkComputation, 5000); // Start checking after 5 seconds
      })
      .catch((msg) => {
        if (browserLink) {
          browserLink.innerHTML = `<br><span style="color: red;">${msg}</span>`;
        }
        showErrorMessage(`Failed to end campaign: ${msg}`);
      });
  } else {
    if (browserLink) {
      browserLink.innerHTML = `<br><span style="color: red;">Cannot end campaign without a connected wallet!</span>`;
    }
    showErrorMessage("Please connect your wallet first to end the campaign.");
  }
}

/** Action for the withdraw funds button */
function withdrawFundsAction() {
  // User is connected and the Crowdfunding API is defined
  const api = getCrowdfundingApi();
  const browserLink = document.querySelector("#withdraw-funds-transaction-link");
  if (browserLink) {
    browserLink.innerHTML = '<br><div class="loader"></div>';
  }
  
  if (isConnected() && api !== undefined) {
    // Call withdrawFunds via the API
    api.withdrawFunds()
      .then((transactionHash) => {
        if (browserLink) {
          browserLink.innerHTML = `<br><a href="https://browser.testnet.partisiablockchain.com/transactions/${transactionHash.transactionPointer.identifier}" target="_blank">Transaction link in browser</a>`;
        }
        showSuccessMessage("Funds withdrawn successfully!");
        setTimeout(updateContractState, 5000); // Refresh after 5 seconds
      })
      .catch((msg) => {
        if (browserLink) {
          browserLink.innerHTML = `<br><span style="color: red;">${msg}</span>`;
        }
        showErrorMessage(`Failed to withdraw funds: ${msg}`);
      });
  } else {
    if (browserLink) {
      browserLink.innerHTML = `<br><span style="color: red;">Cannot withdraw funds without a connected wallet!</span>`;
    }
    showErrorMessage("Please connect your wallet first to withdraw funds.");
  }
}

/**
 * Show error message in UI
 */
function showErrorMessage(message) {
  console.error(message);
  
  // Create message element
  const errorElement = document.createElement("div");
  errorElement.className = "message-section error";
  errorElement.style.color = "red";
  errorElement.style.backgroundColor = "rgba(255, 0, 0, 0.1)";
  errorElement.style.padding = "10px";
  errorElement.style.marginTop = "10px";
  errorElement.style.border = "1px solid red";
  errorElement.style.borderRadius = "5px";
  
  const errorText = document.createElement("p");
  errorText.textContent = message;
  errorElement.appendChild(errorText);
  
  // Add to DOM
  addMessageToDOM(errorElement);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    errorElement.remove();
  }, 10000);
}

/**
 * Show success message in UI
 */
function showSuccessMessage(message) {
  // Create message element
  const successElement = document.createElement("div");
  successElement.className = "message-section success";
  successElement.style.color = "green";
  successElement.style.backgroundColor = "rgba(0, 255, 0, 0.1)";
  successElement.style.padding = "10px";
  successElement.style.marginTop = "10px";
  successElement.style.border = "1px solid green";
  successElement.style.borderRadius = "5px";
  
  const successText = document.createElement("p");
  successText.textContent = message;
  successElement.appendChild(successText);
  
  // Add to DOM
  addMessageToDOM(successElement);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    successElement.remove();
  }, 10000);
}

/**
 * Show info message in UI
 */
function showInfoMessage(message) {
  // Create message element
  const infoElement = document.createElement("div");
  infoElement.className = "message-section info";
  infoElement.style.color = "blue";
  infoElement.style.backgroundColor = "rgba(0, 0, 255, 0.1)";
  infoElement.style.padding = "10px";
  infoElement.style.marginTop = "10px";
  infoElement.style.border = "1px solid blue";
  infoElement.style.borderRadius = "5px";
  
  const infoText = document.createElement("p");
  infoText.textContent = message;
  infoElement.appendChild(infoText);
  
  // Add to DOM
  addMessageToDOM(infoElement);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    infoElement.remove();
  }, 10000);
}

/**
 * Add message element to DOM
 */
function addMessageToDOM(messageElement) {
  const messagesContainer = document.querySelector("#messages-container");
  
  if (messagesContainer) {
    // If container exists, add to it
    messagesContainer.appendChild(messageElement);
  } else {
    // If container doesn't exist, create it and add
    const container = document.createElement("div");
    container.id = "messages-container";
    container.style.marginTop = "20px";
    
    container.appendChild(messageElement);
    
    // Add container after contract-state section
    const contractState = document.querySelector("#contract-state");
    if (contractState) {
      contractState.parentNode.insertBefore(container, contractState.nextSibling);
    } else {
      // If contract state section doesn't exist yet, add to the main content
      const mainContent = document.querySelector(".pure-u-1-1");
      if (mainContent) {
        mainContent.appendChild(container);
      }
    }
  }
}