#!/bin/bash

# Exit on error
set -e

# Colorful outputs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}ZK-Crowdfunding Deployment Tool${NC}"
echo "===============================\n"

# Check for dependencies
echo -e "${YELLOW}Checking dependencies...${NC}"
if ! command -v cargo &> /dev/null; then
  echo -e "${RED}Cargo not found! Please install Rust and Cargo first.${NC}"
  exit 1
fi

if ! cargo partisia-contract --version &> /dev/null; then
  echo -e "${RED}cargo-partisia-contract not found! Please install it first:${NC}"
  echo "cargo install cargo-partisia-contract"
  exit 1
fi

# Build the project if needed
echo -e "\n${YELLOW}Building the ZK-Crowdfunding contract...${NC}"
cd "$(dirname "$0")/.."
cargo partisia-contract build --release

# Check if build was successful
if [ $? -ne 0 ]; then
  echo -e "${RED}Build failed! Please fix the errors and try again.${NC}"
  exit 1
fi

echo -e "${GREEN}Build successful!${NC}\n"

# Get deployment parameters
echo -e "${YELLOW}Deployment Configuration${NC}"
echo "========================="

# Default values
DEFAULT_TITLE="Privacy-Preserving Research Project"
DEFAULT_DESCRIPTION="Funding research on advanced privacy techniques in blockchain applications"
DEFAULT_TARGET=1000
DEFAULT_DEADLINE=$(( $(date +%s) + 7*24*60*60 ))

# Get parameters from command line or prompt for them
if [ "$#" -ge 1 ]; then
  PRIVATE_KEY=$1
else
  read -p "Enter path to private key file (e.g., Account-A.pk): " PRIVATE_KEY
fi

if [ "$#" -ge 2 ]; then
  PROJECT_TITLE=$2
else
  read -p "Enter project title (default: '$DEFAULT_TITLE'): " PROJECT_TITLE
  PROJECT_TITLE=${PROJECT_TITLE:-$DEFAULT_TITLE}
fi

if [ "$#" -ge 3 ]; then
  PROJECT_DESCRIPTION=$3
else
  read -p "Enter project description (default: '$DEFAULT_DESCRIPTION'): " PROJECT_DESCRIPTION
  PROJECT_DESCRIPTION=${PROJECT_DESCRIPTION:-$DEFAULT_DESCRIPTION}
fi

if [ "$#" -ge 4 ]; then
  FUNDING_TARGET=$4
else
  read -p "Enter funding target amount (default: $DEFAULT_TARGET): " FUNDING_TARGET
  FUNDING_TARGET=${FUNDING_TARGET:-$DEFAULT_TARGET}
fi

if [ "$#" -ge 5 ]; then
  DEADLINE=$5
else
  echo "Current time: $(date)"
  echo "Default deadline: $(date -d @$DEFAULT_DEADLINE) (7 days from now)"
  read -p "Enter deadline as Unix timestamp (default: $DEFAULT_DEADLINE): " DEADLINE
  DEADLINE=${DEADLINE:-$DEFAULT_DEADLINE}
fi

# Validate inputs
if [ ! -f "$PRIVATE_KEY" ]; then
  echo -e "${RED}Private key file '$PRIVATE_KEY' not found!${NC}"
  exit 1
fi

# Confirm deployment
echo -e "\n${YELLOW}Deployment Configuration Summary:${NC}"
echo "Project Title: $PROJECT_TITLE"
echo "Project Description: $PROJECT_DESCRIPTION"
echo "Funding Target: $FUNDING_TARGET"
echo "Deadline: $(date -d @$DEADLINE)"
echo "Using private key: $PRIVATE_KEY"

read -p "Proceed with deployment? (y/n): " CONFIRM
if [[ $CONFIRM != "y" && $CONFIRM != "Y" ]]; then
  echo -e "${RED}Deployment cancelled.${NC}"
  exit 0
fi

# Deploy the contract
echo -e "\n${YELLOW}Deploying contract to Partisia Blockchain...${NC}"
DEPLOYMENT_RESULT=$(cargo partisia-contract transaction deploy --gas 10000000 --privatekey "$PRIVATE_KEY" target/wasm32-unknown-unknown/release/zk_crowdfunding.pbc "$PROJECT_TITLE" "$PROJECT_DESCRIPTION" $FUNDING_TARGET $DEADLINE)
echo "$DEPLOYMENT_RESULT"

# Extract contract address from deployment result
CONTRACT_ADDRESS=$(echo "$DEPLOYMENT_RESULT" | grep -o 'Contract address: [^ ]*' | awk '{print $3}')

if [ -n "$CONTRACT_ADDRESS" ]; then
  echo -e "\n${GREEN}Deployment successful!${NC}"
  echo "Contract address: $CONTRACT_ADDRESS"
  
  # Create or update .env file
  echo "CONTRACT_ADDRESS=$CONTRACT_ADDRESS" > .env
  echo "REACT_APP_RPC_NODE_URL=https://node1.testnet.partisiablockchain.com" >> .env
  echo "REACT_APP_BROWSER_URL=https://browser.testnet.partisiablockchain.com" >> .env
  
  echo "Contract address has been saved to .env file"
  
  # Start the campaign automatically
  echo -e "\n${YELLOW}Starting the campaign...${NC}"
  START_RESULT=$(cargo partisia-contract transaction action --gas 20000 --privatekey "$PRIVATE_KEY" $CONTRACT_ADDRESS start_campaign)
  echo "$START_RESULT"
  
  echo -e "\n${GREEN}Campaign has been started! Your crowdfunding project is now active.${NC}"
  
  # Generate a config file for the frontend
  echo -e "\n${YELLOW}Creating frontend configuration...${NC}"
  mkdir -p zk-crowdfunding-frontend/src
  cat > zk-crowdfunding-frontend/src/config.json << EOL
{
  "contractAddress": "$CONTRACT_ADDRESS",
  "blockchain": {
    "rpcNodeUrl": "https://node1.testnet.partisiablockchain.com",
    "browserUrl": "https://browser.testnet.partisiablockchain.com"
  }
}
EOL
  
  echo -e "${GREEN}Done!${NC} You can start the frontend with:"
  echo "cd zk-crowdfunding-frontend && npm install && npm start"
  
  # Optional: start the frontend automatically
  read -p "Would you like to start the frontend now? (y/n): " START_FRONTEND
  if [[ $START_FRONTEND == "y" || $START_FRONTEND == "Y" ]]; then
    cd zk-crowdfunding-frontend
    npm install
    npm start
  fi
else
  echo -e "${RED}Deployment failed or couldn't extract contract address.${NC}"
  exit 1
fi