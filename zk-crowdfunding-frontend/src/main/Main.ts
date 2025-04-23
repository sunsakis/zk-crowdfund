/*
 * Copyright (C) 2022 - 2023 Partisia Blockchain Foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

import { getCrowdfundingApi, isConnected, setContractAddress, getContractAddress } from "./AppState";
import {
  connectMetaMaskWalletClick,
  connectMpcWalletClick,
  connectPrivateKeyWalletClick,
  disconnectWalletClick,
  updateContractState,
  updateInteractionVisibility,
} from "./WalletIntegration";
import config from "./config";

document.addEventListener('DOMContentLoaded', () => {
  // Initialize with default contract address if available
  const savedAddress = localStorage.getItem('contractAddress') || config.contractAddress;
  if (savedAddress) {
    const addressInput = document.querySelector("#address-value") as HTMLInputElement;
    if (addressInput) {
      addressInput.value = savedAddress;
    }
    
    // Set contract address and load state
    setContractAddress(savedAddress);
    updateContractState();
    
    // Update address display
    const currentAddress = document.querySelector("#current-address");
    if (currentAddress) {
      currentAddress.innerHTML = `Crowdfunding Contract Address: ${savedAddress}`;
    }
    
    // Update browser link
    const browserLink = document.querySelector("#browser-link");
    if (browserLink) {
      browserLink.innerHTML = `<a href="https://browser.testnet.partisiablockchain.com/contracts/${savedAddress}" target="_blank">View in Blockchain Browser</a>`;
    }
  }
  
  // Setup event listeners
  setupEventListeners();
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

  // Setup event listener for adding a contribution as a secret input
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

/** Function for the contract address form.
 * This is called when the user clicks on the connect to contract button.
 * It validates the address, and then gets the state for the contract.
 */
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
    // Validate that address is 21 bytes in hexidecimal format
    showErrorMessage(`${address} is not a valid PBC address. Address must be 42 characters (21 bytes) in hexadecimal format.`);
    return;
  }
  
  // Show address and a link to the browser.
  const currentAddress = document.querySelector("#current-address");
  if (currentAddress) {
    currentAddress.innerHTML = `Crowdfunding Contract Address: ${address}`;
  }
  
  const browserLink = document.querySelector("#browser-link");
  if (browserLink) {
    browserLink.innerHTML = `<a href="https://browser.testnet.partisiablockchain.com/contracts/${address}" target="_blank">View in Blockchain Browser</a>`;
  }

  // Update the contract state.
  setContractAddress(address);
  updateInteractionVisibility();
  updateContractState();
}

/**
 * Form action for adding a contribution
 */
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
  errorElement.style.color = "white";
  errorElement.style.backgroundColor = "rgba(220, 53, 69, 0.1)";
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
  successElement.style.color = "white";
  successElement.style.backgroundColor = "rgba(40, 167, 69, 0.1)";
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
  infoElement.style.color = "white";
  infoElement.style.backgroundColor = "rgba(0, 123, 255, 0.1)";
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