#!/bin/bash

# Build the project
echo "Building the ZK-Crowdfunding contract..."
cargo partisia-contract build --release

# Check if build was successful
if [ $? -ne 0 ]; then
  echo "Build failed!"
  exit 1
fi

# Get deployment parameters from command line arguments
if [ "$#" -lt 4 ]; then
  echo "Usage: $0 <private-key-file> <project-title> <project-description> <funding-target> <deadline-timestamp>"
  echo "Example: $0 Account-A.pk \"Cancer Research Funding\" \"Supporting innovative cancer research methods\" 5000 1685577600"
  exit 1
fi

PRIVATE_KEY=$1
PROJECT_TITLE=$2
PROJECT_DESCRIPTION=$3
FUNDING_TARGET=$4
DEADLINE=$5

echo "Deploying crowdfunding contract with the following parameters:"
echo "Project Title: $PROJECT_TITLE"
echo "Funding Target: $FUNDING_TARGET"
echo "Deadline: $(date -d @$DEADLINE)"

# Deploy the contract
echo "Deploying contract to Partisia Blockchain..."
DEPLOYMENT_RESULT=$(cargo partisia-contract transaction deploy --gas 10000000 --privatekey $PRIVATE_KEY target/wasm32-unknown-unknown/release/zk_crowdfunding.pbc "$PROJECT_TITLE" "$PROJECT_DESCRIPTION" $FUNDING_TARGET $DEADLINE)

# Extract contract address from deployment result
CONTRACT_ADDRESS=$(echo "$DEPLOYMENT_RESULT" | grep -o 'Contract address: [^ ]*' | awk '{print $3}')

if [ -n "$CONTRACT_ADDRESS" ]; then
  echo "Deployment successful!"
  echo "Contract address: $CONTRACT_ADDRESS"
  echo "Contract address has been saved to .env file"
  
  # Create or update .env file
  echo "CONTRACT_ADDRESS=$CONTRACT_ADDRESS" > .env
  
  # Start the campaign automatically
  echo "Starting the campaign..."
  START_RESULT=$(cargo partisia-contract transaction action --gas 20000 --privatekey $PRIVATE_KEY $CONTRACT_ADDRESS start_campaign)
  
  echo "Campaign has been started! Your crowdfunding project is now active."
  echo "Frontend URL: http://localhost:3000"
  
  # Generate a config file for the frontend
  echo "Creating frontend configuration..."
  mkdir -p zk-crowdfunding-frontend/src
  cat > zk-crowdfunding-frontend/src/config.json << EOL
{
  "contractAddress": "$CONTRACT_ADDRESS",
  "projectTitle": "$PROJECT_TITLE",
  "projectDescription": "$PROJECT_DESCRIPTION",
  "fundingTarget": $FUNDING_TARGET,
  "deadline": $DEADLINE
}
EOL
  
  echo "Done! You can start the frontend with:"
  echo "cd zk-crowdfunding-frontend && npm install && npm start"
else
  echo "Deployment failed or couldn't extract contract address."
  exit 1
fi