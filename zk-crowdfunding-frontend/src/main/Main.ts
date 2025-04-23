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

import { getCrowdfundingApi, isConnected, setContractAddress } from "./AppState";
import {
  connectMetaMaskWalletClick,
  connectMpcWalletClick,
  connectPrivateKeyWalletClick,
  disconnectWalletClick,
  updateContractState,
  updateInteractionVisibility,
} from "./WalletIntegration";

document.addEventListener('DOMContentLoaded', () => {
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
    pkConnect.addEventListener("click", connectPrivateKeyWalletClick);
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

  // Add the HTML content to the root element
  const rootElement = document.getElementById('root');
  if (rootElement) {
    fetch('/src/main/index.html')
      .then(response => response.text())
      .then(html => {
        rootElement.innerHTML = html;
        // Re-attach event listeners after HTML is loaded
        setupEventListeners();
      })
      .catch(error => {
        console.error('Failed to load HTML template:', error);
      });
  }
});

// Setup event listeners after HTML is loaded
function setupEventListeners() {
  // Re-setup all the event listeners
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
    pkConnect.addEventListener("click", connectPrivateKeyWalletClick);
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
    throw new Error("Need to provide a contract address");
  } else if (address.length != 42 || address.match(regex) == null) {
    // Validate that address is 21 bytes in hexidecimal format
    console.error(`${address} is not a valid PBC address`);
    alert(`${address} is not a valid PBC address. Address must be 42 characters (21 bytes) in hexadecimal format.`);
  } else {
    // Show address and a link to the browser.
    const currentAddress = document.querySelector("#current-address") as HTMLInputElement;
    if (currentAddress) {
      currentAddress.innerHTML = `Crowdfunding Contract Address: ${address}`;
    }
    
    const browserLink = document.querySelector("#browser-link") as HTMLInputElement;
    if (browserLink) {
      browserLink.innerHTML = `<a href="https://browser.testnet.partisiablockchain.com/contracts/${address}" target="_blank">Browser link</a>`;
    }

    // Update the contract state.
    setContractAddress(address);
    updateInteractionVisibility();
    updateContractState();
  }
}

/**
 * Form action for the add contribution form.
 * The action reads the value from the input field and validates them.
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
      const browserLink = document.querySelector("#add-contribution-transaction-link") as HTMLInputElement;
      if (browserLink) {
        browserLink.innerHTML = `<br><span style="color: red;">Contribution must be a number</span>`;
      }
    } else {
      // All fields validated, add contribution.

      // If the user has inputted a correct crowdfunding address this should be defined.
      const api = getCrowdfundingApi();
      if (api !== undefined) {
        // Add contribution via Crowdfunding API
        const browserLink = document.querySelector("#add-contribution-transaction-link") as HTMLInputElement;
        if (browserLink) {
          browserLink.innerHTML = '<br><div class="loader"></div>';
        }
        
        api
          .addContribution(parseInt(contribution.value, 10))
          .then((transactionHash) => {
            if (browserLink) {
              browserLink.innerHTML = `<br><a href="https://browser.testnet.partisiablockchain.com/transactions/${transactionHash.transactionPointer.identifier}" target="_blank">Transaction link in browser</a>`;
            }
            setTimeout(updateContractState, 5000); // Refresh after 5 seconds
          })
          .catch((msg) => {
            if (browserLink) {
              browserLink.innerHTML = `<br><span style="color: red;">${msg}</span>`;
            }
          });
      }
    }
  } else {
    const browserLink = document.querySelector("#add-contribution-transaction-link") as HTMLInputElement;
    if (browserLink) {
      browserLink.innerHTML = `<br><span style="color: red;">Cannot contribute without a connected wallet!</span>`;
    }
  }
}

/** Action for the start campaign button */
function startCampaignAction() {
  // User is connected and the Crowdfunding API is defined
  const api = getCrowdfundingApi();
  const browserLink = document.querySelector("#start-campaign-transaction-link") as HTMLInputElement;
  if (browserLink) {
    browserLink.innerHTML = '<br><div class="loader"></div>';
  }
  
  if (isConnected() && api !== undefined) {
    // Call startCampaign via the API
    api
      .startCampaign()
      .then((transactionHash) => {
        if (browserLink) {
          browserLink.innerHTML = `<br><a href="https://browser.testnet.partisiablockchain.com/transactions/${transactionHash.transactionPointer.identifier}" target="_blank">Transaction link in browser</a>`;
        }
        setTimeout(updateContractState, 5000); // Refresh after 5 seconds
      })
      .catch((msg) => {
        if (browserLink) {
          browserLink.innerHTML = `<br><span style="color: red;">${msg}</span>`;
        }
      });
  } else {
    if (browserLink) {
      browserLink.innerHTML = `<br><span style="color: red;">Cannot start campaign without a connected wallet!</span>`;
    }
  }
}

/** Action for the end campaign button */
function endCampaignAction() {
  // User is connected and the Crowdfunding API is defined
  const api = getCrowdfundingApi();
  const browserLink = document.querySelector("#end-campaign-transaction-link") as HTMLInputElement;
  if (browserLink) {
    browserLink.innerHTML = '<br><div class="loader"></div>';
  }
  
  if (isConnected() && api !== undefined) {
    // Call endCampaign via the API
    api
      .endCampaign()
      .then((transactionHash) => {
        if (browserLink) {
          browserLink.innerHTML = `<br><a href="https://browser.testnet.partisiablockchain.com/transactions/${transactionHash.transactionPointer.identifier}" target="_blank">Transaction link in browser</a>`;
        }
        
        // Setup regular polling to check for computation completion
        const checkComputation = () => {
          updateContractState();
          const refreshTimer = setTimeout(checkComputation, 10000); // Check every 10 seconds
          
          // Check status display to see if computing is done
          const statusElement = document.querySelector("#status-value");
          if (statusElement && !statusElement.textContent?.includes("Computing")) {
            clearTimeout(refreshTimer);
          }
        };
        
        setTimeout(checkComputation, 5000); // Start checking after 5 seconds
      })
      .catch((msg) => {
        if (browserLink) {
          browserLink.innerHTML = `<br><span style="color: red;">${msg}</span>`;
        }
      });
  } else {
    if (browserLink) {
      browserLink.innerHTML = `<br><span style="color: red;">Cannot end campaign without a connected wallet!</span>`;
    }
  }
}

/** Action for the withdraw funds button */
function withdrawFundsAction() {
  // User is connected and the Crowdfunding API is defined
  const api = getCrowdfundingApi();
  const browserLink = document.querySelector("#withdraw-funds-transaction-link") as HTMLInputElement;
  if (browserLink) {
    browserLink.innerHTML = '<br><div class="loader"></div>';
  }
  
  if (isConnected() && api !== undefined) {
    // Call withdrawFunds via the API
    api
      .withdrawFunds()
      .then((transactionHash) => {
        if (browserLink) {
          browserLink.innerHTML = `<br><a href="https://browser.testnet.partisiablockchain.com/transactions/${transactionHash.transactionPointer.identifier}" target="_blank">Transaction link in browser</a>`;
        }
        setTimeout(updateContractState, 5000); // Refresh after 5 seconds
      })
      .catch((msg) => {
        if (browserLink) {
          browserLink.innerHTML = `<br><span style="color: red;">${msg}</span>`;
        }
      });
  } else {
    if (browserLink) {
      browserLink.innerHTML = `<br><span style="color: red;">Cannot withdraw funds without a connected wallet!</span>`;
    }
  }
}