import './Main';

// This file serves as the entry point
console.log("ZK Crowdfunding Frontend - Starting Main.ts...");

// Add your HTML content directly to the DOM
document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <!-- Paste your entire HTML content from src/index.html here -->
      <div class="pure-g">
        <div class="pure-u-1-1">
          <h1>ZK Crowdfunding Platform</h1>
          <!-- rest of your HTML -->
        </div>
      </div>
    `;
  }
});