import { Buffer } from "buffer";
import { AbiBitOutput } from "@partisiablockchain/abi-client";
import { getCrowdfundingApi, isConnected, getContractAddress } from "./AppState";

/**
 * Handle the Add Contribution action
 * This function validates inputs, creates a ZK secret input, and submits the transaction
 */
export function addContributionFormAction() {
  console.log("Processing contribution submission...");
  
  // Get contribution input element
  const contributionInput = document.querySelector("#contribution") as HTMLInputElement;
  
  // 1. Basic validation - both empty check and number validation
  if (!contributionInput?.value) {
    showErrorMessage("Please enter a contribution amount");
    return;
  }

  const amount = parseInt(contributionInput.value, 10);
  if (isNaN(amount) || amount <= 0) {
    showErrorMessage("Please enter a valid positive number for contribution");
    return;
  }

  // 2. Check wallet connection
  if (!isConnected()) {
    showErrorMessage("Please connect your wallet first");
    return;
  }

  // 3. Check contract address
  const contractAddress = getContractAddress();
  if (!contractAddress) {
    showErrorMessage("No campaign address selected");
    return;
  }

  // 4. Get the API and show loading state
  const api = getCrowdfundingApi();
  if (!api) {
    showErrorMessage("API not initialized. Please try reconnecting your wallet.");
    return;
  }

  // Show loading indicator
  const statusElement = document.querySelector("#add-contribution-transaction-link");
  if (statusElement) {
    statusElement.innerHTML = '<div class="loader"></div> Processing contribution...';
  }

  // 5. Submit the contribution
  console.log(`Submitting contribution of ${amount} to ${contractAddress}`);
  
  api.addContribution(contractAddress, amount)
    .then(result => {
      console.log("Contribution result:", result);
      
      // Clear input field on success
      contributionInput.value = "";
      
      // Show success message with transaction link
      if (statusElement) {
        statusElement.innerHTML = `
          <div class="message-section success">
            Contribution submitted successfully!
          </div>
          <a href="https://browser.testnet.partisiablockchain.com/transactions/${result.transactionPointer.identifier}" 
             target="_blank">View transaction in browser</a>
        `;
      }
      
      // Refresh the contract state after a short delay
      setTimeout(() => {
        const refreshStateBtn = document.querySelector("#update-state-btn") as HTMLButtonElement;
        if (refreshStateBtn) {
          refreshStateBtn.click();
        }
      }, 3000);
    })
    .catch(error => {
      console.error("Contribution error:", error);
      
      // Show error message
      if (statusElement) {
        statusElement.innerHTML = `
          <div class="message-section error">
            Error submitting contribution: ${error.message || String(error)}
          </div>
        `;
      }
    });
}

/**
 * Show an error message to the user
 */
function showErrorMessage(message: string) {
  console.error(message);
  
  // Add message to transaction link element
  const statusElement = document.querySelector("#add-contribution-transaction-link");
  if (statusElement) {
    statusElement.innerHTML = `
      <div class="message-section error">
        ${message}
      </div>
    `;
  }
}