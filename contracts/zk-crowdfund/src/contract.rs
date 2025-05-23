#![doc = include_str!("../README.md")]

#[macro_use]
extern crate pbc_contract_codegen;
extern crate pbc_contract_common;
extern crate pbc_lib;

mod zk_compute;

use pbc_contract_common::address::Address;
use pbc_contract_common::context::{CallbackContext, ContractContext};
use pbc_contract_common::events::EventGroup;
use pbc_contract_common::address::ShortnameCallback;
use pbc_contract_common::zk::{CalculationStatus, SecretVarId, ZkInputDef, ZkState, ZkStateChange};
use pbc_contract_common::address::Shortname;
use pbc_contract_common::shortname::{ShortnameZkComputation, ShortnameZkComputeComplete};
use pbc_zk::Sbu32; // Changed from Sbu128 to Sbu32 for consistency
use read_write_rpc_derive::ReadWriteRPC;
use read_write_state_derive::ReadWriteState;
use create_type_spec_derive::CreateTypeSpec;

/// Secret variable metadata types
#[derive(ReadWriteState, ReadWriteRPC, Debug, Clone, CreateTypeSpec)]
#[repr(u8)]
enum SecretVarType {
    #[discriminant(0)]
    Contribution {
        /// Owner of the contribution (contributor address)
        owner: Address,
        /// Timestamp of contribution (for ordering)
        timestamp: i64,
    },
    #[discriminant(1)]
    SumResult {},
}

/// Status of the crowdfunding campaign
#[derive(ReadWriteState, ReadWriteRPC, Debug, Clone, PartialEq, CreateTypeSpec)]
#[repr(u8)]
enum CampaignStatus {
    #[discriminant(0)]
    Active {},
    #[discriminant(1)]
    Computing {},
    #[discriminant(2)]
    Completed {},
}

/// Get current campaign state with privacy-preserving information
#[action(shortname = 0x10, zk = true)]
fn get_campaign_info(
    _context: ContractContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
) -> CampaignPublicInfo {
    CampaignPublicInfo {
        owner: state.owner,
        title: state.title.clone(),
        description: state.description.clone(),
        token_address: state.token_address,
        funding_target: state.funding_target,
        status: state.status,
        total_raised: state.total_raised,
        num_contributors: state.num_contributors,
        is_successful: state.is_successful,
    }
}

/// Public campaign information structure
#[derive(ReadWriteState, ReadWriteRPC, Debug, Clone, CreateTypeSpec)]
struct CampaignPublicInfo {
    owner: Address,
    title: String,
    description: String,
    token_address: Address,
    funding_target: u32, // Changed to u32 - raw token units
    status: CampaignStatus,
    total_raised: Option<u32>, // Changed to u32 - raw token units  
    num_contributors: Option<u32>,
    is_successful: bool,
}

/// This contract's state
#[state]
struct ContractState {
    /// Project owner (can end campaign, withdraw funds)
    owner: Address,
    /// Project title
    title: String,
    /// Project description
    description: String,
    /// Token contract address
    token_address: Address,
    /// Funding target in raw token units (1 = 1 token unit = 0.000001 display)
    funding_target: u32,
    /// Current status of the crowdfunding campaign
    status: CampaignStatus,
    /// Total raised in raw token units (1 = 1 token unit = 0.000001 display)
    /// Only revealed if campaign is successful
    total_raised: Option<u32>,
    /// Number of contributors
    num_contributors: Option<u32>,
    /// Whether the campaign was successful (reached funding target)
    is_successful: bool,
    /// Tracks whether the funds have been withdrawn (to prevent double withdrawal)
    funds_withdrawn: bool,
}

/// Shortname constants for contract actions and callbacks
const TOKEN_TRANSFER_FROM_SHORTNAME: u8 = 0x03;
const TOKEN_TRANSFER_SHORTNAME: u8 = 0x01;
const TOKEN_BALANCE_OF_SHORTNAME: u8 = 0x10;
const BALANCE_CALLBACK_SHORTNAME: u32 = 0x32;
const CONTRIBUTION_CALLBACK_SHORTNAME: u32 = 0x31;
const SUM_COMPUTE_COMPLETE_SHORTNAME: u32 = 0x42;
const ZK_COMPUTATION_SHORTNAME: u32 = 0x61;

/// Conversion factor: 1 token unit = 1e18 wei (18 decimals)
const TOKEN_DECIMALS: u32 = 18;
const WEI_PER_TOKEN_UNIT: u128 = 1_000_000_000_000; // 1e18

/// Convert raw token units to wei for blockchain transfers
fn token_units_to_wei(token_units: u32) -> u128 {
    (token_units as u128) * WEI_PER_TOKEN_UNIT
}

/// Convert wei to raw token units (for internal storage)
fn wei_to_token_units(wei: u128) -> u32 {
    (wei / WEI_PER_TOKEN_UNIT) as u32
}

/// Initializes contract - starts directly in Active state
#[init(zk = true)]
fn initialize(
    ctx: ContractContext,
    _zk_state: ZkState<SecretVarType>,
    title: String,
    description: String,
    token_address: Address,
    funding_target: u32, // Raw token units
) -> ContractState {
    // Validate inputs
    assert!(!title.is_empty(), "Title cannot be empty");
    assert!(!description.is_empty(), "Description cannot be empty");
    assert!(funding_target > 0, "Funding target must be greater than 0");

    ContractState {
        owner: ctx.sender,
        title,
        description,
        token_address,
        funding_target, // Store as raw token units
        status: CampaignStatus::Active {},
        total_raised: None,
        num_contributors: None,
        is_successful: false,
        funds_withdrawn: false,
    }
}

/// Add a contribution as a secret input
/// The contribution amount will be provided as the secret value in raw token units
#[zk_on_secret_input(shortname = 0x40)]
fn add_contribution(
    context: ContractContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
) -> (
    ContractState,
    Vec<EventGroup>,
    ZkInputDef<SecretVarType, Sbu32>, // Changed to Sbu32
) {
    // Check campaign status
    assert_eq!(
        state.status, CampaignStatus::Active {},
        "Contributions can only be made when campaign is active"
    );
    
    // Create metadata for the contribution variable
    let metadata = SecretVarType::Contribution { 
        owner: context.sender,
        timestamp: context.block_production_time,
    };
    
    // Define the input with metadata
    let input_def = ZkInputDef::with_metadata(None, metadata);
    
    (state, vec![], input_def)
}

/// Process token transfer for contribution
/// This must be called after add_contribution with the same amount
#[action(shortname = 0x07, zk = true)]
fn contribute_tokens(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
    amount: u32, // Raw token units
) -> (ContractState, Vec<EventGroup>) {
    // Check campaign status
    assert_eq!(
        state.status, CampaignStatus::Active {},
        "Contributions can only be made when campaign is active"
    );
    
    // Verify that amount is greater than 0
    assert!(amount > 0, "Contribution amount must be greater than 0");
    
    // Verify the user has created a ZK contribution variable
    let has_contribution = zk_state.secret_variables.iter()
        .any(|(_, var)| match &var.metadata {
            SecretVarType::Contribution { owner, .. } => *owner == context.sender,
            _ => false,
        });
    
    assert!(has_contribution, "Must create contribution commitment first");
    
    // Convert raw token units to wei for the actual transfer
    let wei_amount = token_units_to_wei(amount);
    
    // Create token transfer event group
    let mut event_group = EventGroup::builder();
    
    // Create token transfer call with the wei amount
    event_group.call(state.token_address, Shortname::from_u32(TOKEN_TRANSFER_FROM_SHORTNAME as u32))
        .argument(context.sender)
        .argument(context.contract_address)
        .argument(wei_amount) // Use wei amount for actual transfer
        .done();
    
    // Add callback to verify the token transfer succeeded
    event_group.with_callback(ShortnameCallback::from_u32(CONTRIBUTION_CALLBACK_SHORTNAME))
        .argument(amount) // Pass raw token units to callback
        .done();
    
    (state, vec![event_group.build()])
}

/// Callback for token contributions to verify successful transfer
#[callback(shortname = 0x31, zk = true)]
fn contribute_callback(
    _ctx: ContractContext,
    callback_ctx: CallbackContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
    _amount: u32, // Raw token units
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    // If token transfer failed, panic to revert the transaction
    if !callback_ctx.success {
        panic!("Token transfer failed");
    }

    // The tokens are now in the contract, but we don't track the amount publicly
    (state, vec![], vec![])
}

/// End campaign and compute results
#[action(shortname = 0x01, zk = true)]
fn end_campaign(
    context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    // Check permissions - only owner can end campaign
    assert_eq!(
        context.sender, state.owner,
        "Only owner can end the campaign"
    );
    
    // Check state
    assert_eq!(
        state.status, CampaignStatus::Active {},
        "Campaign can only be ended from Active state"
    );
    
    assert_eq!(
        zk_state.calculation_state,
        CalculationStatus::Waiting,
        "Computation must start from Waiting state, but was {:?}",
        zk_state.calculation_state,
    );

    // Count contributions
    let contributions = zk_state.secret_variables.iter()
        .filter(|(_, var)| matches!(var.metadata, SecretVarType::Contribution { .. }))
        .count();
    
    let num_contributors = contributions as u32;
    
    // Update state
    state.status = CampaignStatus::Computing {};
    state.num_contributors = Some(num_contributors);
    
    // If no contributors, directly transition to completed
    if num_contributors == 0 {
        state.status = CampaignStatus::Completed {};
        state.is_successful = false;
        state.total_raised = Some(0);
        return (state, vec![], vec![]);
    }
    
    // Create function shortname for our zk_compute function
    let function_shortname = ShortnameZkComputation::from_u32(ZK_COMPUTATION_SHORTNAME);
    
    // Create callback shortname for the completion function
    let on_complete_hook = Some(ShortnameZkComputeComplete::from_u32(SUM_COMPUTE_COMPLETE_SHORTNAME));
    
    // Create metadata for the output variable 
    let output_metadata = vec![SecretVarType::SumResult {}];
    
    // Start the computation
    let zk_change = ZkStateChange::start_computation(
        function_shortname,
        output_metadata,
        on_complete_hook,
    );
    
    (state, vec![], vec![zk_change])
}

/// Automatically called when the computation is completed
#[zk_on_compute_complete(shortname = 0x42)]
fn sum_compute_complete(
    _context: ContractContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
    output_variables: Vec<SecretVarId>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    // Open/declassify the output variables to reveal the sum
    (
        state,
        vec![],
        vec![ZkStateChange::OpenVariables {
            variables: output_variables,
        }],
    )
}

/// Handle the opened variable result and transition to Completed state
#[zk_on_variables_opened]
fn open_sum_variable(
    _context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
    opened_variables: Vec<SecretVarId>,
) -> ContractState {
    // Ensure we're in Computing state
    assert_eq!(
        state.status, 
        CampaignStatus::Computing {},
        "Variables can only be opened during Computing state"
    );
    
    // If we have opened variables, the computation is complete
    if !opened_variables.is_empty() {
        // Get the sum result from the opened variable
        let sum_variable = zk_state.get_variable(opened_variables[0]).unwrap();
        
        // Extract the actual sum value from the opened variable data
        if let Some(sum_data) = &sum_variable.data {
            // The sum is stored as u32 in the opened data (4 bytes, little-endian)
            if sum_data.len() >= 4 {
                let sum_bytes: [u8; 4] = sum_data[0..4].try_into().unwrap_or([0u8; 4]);
                let sum_value = u32::from_le_bytes(sum_bytes);
                
                // Transition to Completed state
                state.status = CampaignStatus::Completed {};
                
                // Check if funding target was reached (both in raw token units)
                if sum_value >= state.funding_target {
                    state.is_successful = true;
                    state.total_raised = Some(sum_value);
                } else {
                    state.is_successful = false;
                    // Don't reveal the total if unsuccessful (privacy preservation)
                    state.total_raised = None;
                }
            } else {
                // Handle case where data is shorter than expected
                state.status = CampaignStatus::Completed {};
                state.is_successful = false;
                state.total_raised = None;
            }
        } else {
            // Handle case where there's no data
            state.status = CampaignStatus::Completed {};
            state.is_successful = false;
            state.total_raised = None;
        }
    }
    
    state
}

/// Get the contract's token balance through a callback
#[action(shortname = 0x08, zk = true)]
fn get_balance_for_withdrawal(
    context: ContractContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>) {
    // Verify permissions
    assert_eq!(
        context.sender, state.owner,
        "Only the owner can check balance for withdrawal"
    );
    
    // Verify campaign state
    assert_eq!(
        state.status, CampaignStatus::Completed {},
        "Campaign must be completed before checking balance"
    );
    
    // Create balance check event
    let mut event_group = EventGroup::builder();
    
    // Call balanceOf on the token contract
    event_group.call(state.token_address, Shortname::from_u32(TOKEN_BALANCE_OF_SHORTNAME as u32))
        .argument(context.contract_address)
        .done();
    
    // Add callback to process the balance
    event_group.with_callback(ShortnameCallback::from_u32(BALANCE_CALLBACK_SHORTNAME))
        .done();
    
    (state, vec![event_group.build()])
}

/// Callback to handle balance check and initiate withdrawal
#[callback(shortname = 0x32, zk = true)]
fn balance_callback(
    context: ContractContext,
    callback_ctx: CallbackContext,
    mut state: ContractState,
    _zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    assert!(callback_ctx.success, "Balance check failed");
    
    // Extract the balance from the callback results (in wei)
    let wei_balance: u128 = if !callback_ctx.results.is_empty() {
        let return_data = &callback_ctx.results[0].return_data;
        
        if return_data.len() >= 16 {
            // Read as little-endian u128 (16 bytes)
            let balance_bytes: [u8; 16] = return_data[0..16].try_into().unwrap_or([0u8; 16]);
            u128::from_le_bytes(balance_bytes)
        } else if return_data.len() >= 8 {
            // If it's returned as u64, convert to u128
            let balance_bytes: [u8; 8] = return_data[0..8].try_into().unwrap_or([0u8; 8]);
            u64::from_le_bytes(balance_bytes) as u128
        } else if return_data.len() >= 4 {
            // If it's returned as u32, convert to u128
            let balance_bytes: [u8; 4] = return_data[0..4].try_into().unwrap_or([0u8; 4]);
            u32::from_le_bytes(balance_bytes) as u128
        } else {
            0
        }
    } else {
        0
    };
    
    // Prevent double withdrawal
    assert!(!state.funds_withdrawn, "Funds have already been withdrawn");
    
    // Ensure there are funds to withdraw
    assert!(wei_balance > 0, "No funds to withdraw");
    
    // Create token transfer event to owner
    let mut events = Vec::new();
    
    // For successful campaigns, only withdraw the revealed amount
    let withdraw_amount_wei = if state.is_successful {
        // Convert revealed total from token units to wei and withdraw that amount
        let revealed_token_units = state.total_raised.unwrap_or(0);
        let target_wei = token_units_to_wei(revealed_token_units);
        
        // Withdraw the minimum of actual balance and target amount
        std::cmp::min(wei_balance, target_wei)
    } else {
        // For unsuccessful campaigns, the owner shouldn't withdraw
        // This should be handled by individual refunds
        panic!("Use claim_refund for unsuccessful campaigns");
    };
    
    let transfer_shortname = Shortname::from_u32(TOKEN_TRANSFER_SHORTNAME as u32);
    
    let mut event_group = EventGroup::builder();
    event_group.call(state.token_address, transfer_shortname)
        .argument(state.owner)
        .argument(withdraw_amount_wei) // Transfer in wei
        .done();
    
    events.push(event_group.build());
    
    // Mark funds as withdrawn
    state.funds_withdrawn = true;
    
    (state, events, vec![])
}

/// Allow the project owner to withdraw funds after a successful campaign
/// This is a two-step process: first check balance, then withdraw
#[action(shortname = 0x04, zk = true)]
fn withdraw_funds(
    context: ContractContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>) {
    // Verify permissions
    assert_eq!(
        context.sender, state.owner,
        "Only the owner can withdraw funds"
    );
    
    // Verify campaign state
    assert_eq!(
        state.status, CampaignStatus::Completed {},
        "Campaign must be completed before withdrawing"
    );
    
    // Prevent double withdrawal
    assert!(!state.funds_withdrawn, "Funds have already been withdrawn");
    
    // Instead of withdrawing directly, we need to check the balance first
    // Redirect to get_balance_for_withdrawal
    get_balance_for_withdrawal(context, state, _zk_state)
}

/// Verify if a user made a contribution (privacy-preserving verification)
#[action(shortname = 0x06, zk = true)]
fn verify_my_contribution(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>) {
    // Check that campaign is completed
    assert_eq!(
        state.status, CampaignStatus::Completed {},
        "Verification only available after campaign completion"
    );
    
    // Check if the sender has any contribution variables
    let has_contribution = zk_state.secret_variables.iter()
        .any(|(_, var)| match &var.metadata {
            SecretVarType::Contribution { owner, .. } => *owner == context.sender,
            _ => false,
        });
    
    // If no contribution found, this will cause the transaction to fail
    // which indicates to the caller that no contribution was made
    assert!(has_contribution, "No contribution found for this address");
    
    // If we reach here, the verification succeeded
    (state, vec![])
}