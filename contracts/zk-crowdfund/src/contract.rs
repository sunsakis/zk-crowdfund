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
use pbc_contract_common::shortname::{ShortnameZkComputation, ShortnameZkComputeComplete, ShortnameZkVariableInputted};
use pbc_zk::Sbi32;
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
    #[discriminant(2)]
    RefundProof {
        /// Owner of the refund proof
        owner: Address,
    },
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
/// For external view functions
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
/// Used for privacy-preserving external views
#[derive(ReadWriteState, ReadWriteRPC, Debug, Clone, CreateTypeSpec)]
struct CampaignPublicInfo {
    owner: Address,
    title: String,
    description: String,
    token_address: Address,
    funding_target: u128,
    status: CampaignStatus,
    total_raised: Option<u128>,
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
    /// Funding target (threshold to reveal total and release funds)
    funding_target: u128,
    /// Current status of the crowdfunding campaign
    status: CampaignStatus,
    /// Will contain the total raised amount when computation is complete (in token units)
    /// Only revealed if campaign is successful
    total_raised: Option<u128>,
    /// Number of contributors
    num_contributors: Option<u32>,
    /// Whether the campaign was successful (reached funding target)
    is_successful: bool,
}

/// Shortname constants for contract actions and callbacks
const TOKEN_TRANSFER_FROM_SHORTNAME: u8 = 0x03;
const TOKEN_TRANSFER_SHORTNAME: u8 = 0x01;
const CONTRIBUTION_CALLBACK_SHORTNAME: u32 = 0x31;
const SUM_COMPUTE_COMPLETE_SHORTNAME: u32 = 0x42;
const REFUND_COMPUTE_COMPLETE_SHORTNAME: u32 = 0x43;
const ZK_COMPUTATION_SHORTNAME: u32 = 0x61;
const REFUND_COMPUTATION_SHORTNAME: u32 = 0x62;
const REFUND_CALLBACK_SHORTNAME: u32 = 0x44;

/// Initializes contract - starts directly in Active state
#[init(zk = true)]
fn initialize(
    ctx: ContractContext,
    _zk_state: ZkState<SecretVarType>,
    title: String,
    description: String,
    token_address: Address,
    funding_target: u128,
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
        funding_target,
        status: CampaignStatus::Active {},
        total_raised: None,
        num_contributors: None,
        is_successful: false
    }
}

/// Add a contribution as a secret input
/// This records the ZK commitment of the contribution amount
#[zk_on_secret_input(shortname = 0x40)]
fn add_contribution(
    context: ContractContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
) -> (
    ContractState,
    Vec<EventGroup>,
    ZkInputDef<SecretVarType, Sbi32>,
) {
    // Check campaign status
    assert_eq!(
        state.status, CampaignStatus::Active {},
        "Contributions can only be made when campaign is active"
    );
    
    // Create metadata for the contribution variable
    // Including owner and timestamp helps with refund verification later
    let metadata = SecretVarType::Contribution { 
        owner: context.sender,
        timestamp: context.block_production_time 
    };
    
    // Create a new secret input definition
    let input_def = ZkInputDef::with_metadata(
        Some(ShortnameZkVariableInputted::from_u32(0x41)),
        metadata
    );
    
    (state, vec![], input_def)
}

/// Process token transfer for contribution
/// This handles the actual token transfer separately from the ZK amount
#[action(shortname = 0x07, zk = true)]
fn contribute_tokens(
    context: ContractContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
    amount: u128,
) -> (ContractState, Vec<EventGroup>) {
    // Check campaign status
    assert_eq!(
        state.status, CampaignStatus::Active {},
        "Contributions can only be made when campaign is active"
    );
    
    // Verify that amount is greater than 0
    assert!(amount > 0, "Contribution amount must be greater than 0");
    
    // Create token transfer event group
    let mut event_group = EventGroup::builder();
    
    // Create token transfer call with the specified amount
    event_group.call(state.token_address, Shortname::from_u32(TOKEN_TRANSFER_FROM_SHORTNAME as u32))
        .argument(context.sender)
        .argument(context.contract_address)
        .argument(amount)
        .done();
    
    // Add callback to verify the token transfer succeeded
    event_group.with_callback(ShortnameCallback::from_u32(CONTRIBUTION_CALLBACK_SHORTNAME))
        .argument(amount)
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
    _amount: u128,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    // If token transfer failed, panic to revert the transaction
    if !callback_ctx.success {
        panic!("Token transfer failed");
    }

    // No need to track tokens anymore - we rely on ZK computations
    // for totals and consistency checks

    // Return updated state
    (state, vec![], vec![])
}

/// Automatically called when a variable is confirmed on chain
#[zk_on_variable_inputted(shortname = 0x41)]
fn inputted_variable(
    _context: ContractContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
    _inputted_variable: SecretVarId,
) -> ContractState {
    // No additional logic needed here
    state
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

    // Need at least one contribution before computing
    let contributions = zk_state.secret_variables.iter()
        .filter(|(_, var)| matches!(var.metadata, SecretVarType::Contribution { .. }))
        .count();
    
    let num_contributors = contributions as u32;
    
    assert!(
        num_contributors > 0,
        "At least one contributor is needed before ending the campaign"
    );
    
    // Update state
    state.status = CampaignStatus::Computing {};
    state.num_contributors = Some(num_contributors);
    
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
    // Open/declassify the output variables
    (
        state,
        vec![],
        vec![ZkStateChange::OpenVariables {
            variables: output_variables,
        }],
    )
}

/// Handle opened variables from ZK computation
/// Handle opened variables from ZK computation
#[zk_on_variables_opened]
fn open_variables(
    context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
    opened_variables: Vec<SecretVarId>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    // Skip processing if no opened variables
    assert!(!opened_variables.is_empty(), "No opened variables to process");
    
    // Get the first opened variable
    let var_id = *opened_variables.get(0).unwrap();
    let opened_variable = zk_state.get_variable(var_id).unwrap();
    
    // Process based on variable type
    match &opened_variable.metadata {
        // Process SumResult variables (from campaign completion)
        SecretVarType::SumResult {} => {
            // Read the sum result
            let total_raised = read_variable_u32_le(&opened_variable);
            
            // Count the number of contributions
            let num_contributors = zk_state
                .secret_variables
                .iter()
                .filter(|(_, var)| matches!(var.metadata, SecretVarType::Contribution { .. }))
                .count() as u32;
            
            // Check if the campaign is successful
            let is_successful = (total_raised as u128) >= state.funding_target;
            
            // For successful campaigns, we can reveal the total
            // For failed campaigns, we don't reveal the total
            if is_successful {
                state.total_raised = Some(total_raised as u128);
            } else {
                state.total_raised = None;
            }
            
            // Set the contributor count and success flag
            state.num_contributors = Some(num_contributors);
            state.is_successful = is_successful;
            
            // Mark campaign as completed
            state.status = CampaignStatus::Completed {};
            
            // IMPORTANT: We DO NOT mark the contract as done for either outcome
            // For successful campaigns, we return funds to the owner
            // For unsuccessful campaigns, we need to keep the ZK state active for refunds
            return (state, vec![], vec![]);
        },
        
        // Process RefundProof variables (from refund claims)
        SecretVarType::RefundProof { owner } => {
            // Only process if campaign is completed and unsuccessful
            if matches!(state.status, CampaignStatus::Completed {}) && !state.is_successful {
                // UPDATED HANDLING: Don't check owner against sender
                // Instead, use the owner address from the metadata for the refund
                
                // Get the refund amount
                let refund_amount = read_variable_u32_le(&opened_variable);
                
                // Create token transfer for the refund if amount is > 0
                assert!(refund_amount > 0, "Refund amount must be greater than 0");
                
                // Create the token transfer event with callback for monitoring
                let mut event_group = EventGroup::builder();
                let transfer_shortname = Shortname::from_u32(TOKEN_TRANSFER_SHORTNAME as u32);
                
                // Calculate token amount from ZK amount
                let token_refund_amount = (refund_amount as u128) * 1_000_000_000_000; 
                
                // IMPORTANT CHANGE: Send the refund to the owner in the metadata
                // This is the contributor's address, not the context.sender
                event_group.call(state.token_address, transfer_shortname)
                    .argument(*owner)  // Use the owner from metadata
                    .argument(token_refund_amount)
                    .done();
                
                // Add the callback
                event_group.with_callback(ShortnameCallback::from_u32(REFUND_CALLBACK_SHORTNAME))
                    .argument(*owner)  // Use the owner from metadata
                    .argument(token_refund_amount)
                    .done();
                
                return (state, vec![event_group.build()], vec![]);
            }
        },
        
        // Skip other variable types
        _ => {}
    }
    
    // Default return if no processing was done
    (state, vec![], vec![])
}

//// Automatically called when the refund proof computation is completed
#[zk_on_compute_complete(shortname = 0x43)]
fn refund_proof_complete(
    _context: ContractContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
    output_variables: Vec<SecretVarId>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    // Make sure the output variables are properly opened
    assert!(!output_variables.is_empty(), "No output variables from refund computation");
    
    // Open/declassify the output variables
    (
        state,
        vec![],
        vec![ZkStateChange::OpenVariables {
            variables: output_variables,
        }],
    )
}

/// Allow the project owner to withdraw funds after a successful campaign
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
    
    assert!(
        state.is_successful,
        "Cannot withdraw funds from unsuccessful campaign"
    );
    
    // For successful campaigns, we use the verified total from ZK computation
    let total_to_withdraw = state.total_raised.unwrap_or(0);
    
    // For successful campaigns, we transfer all tokens to the owner
    let mut events = Vec::new();
    
    // Create Shortname from u8 value
    let transfer_shortname = Shortname::from_u32(TOKEN_TRANSFER_SHORTNAME as u32);
    
    // Set up transfer event to owner with the total tokens
    let mut event_group = EventGroup::builder();
    event_group.call(state.token_address, transfer_shortname)
        .argument(state.owner)
        .argument(total_to_withdraw)
        .done();
    
    events.push(event_group.build());
    
    (state, events)
}

/// Generate refund proof and claim refund in one step
#[action(shortname = 0x06, zk = true)]
fn claim_refund(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    // Verify campaign state
    assert_eq!(
        state.status, CampaignStatus::Completed {},
        "Campaign must be completed before claiming refund"
    );
    
    assert!(
        !state.is_successful,
        "Cannot claim refund from successful campaign"
    );
    
    // Check if the computation is already in progress
    assert_eq!(
        zk_state.calculation_state,
        CalculationStatus::Waiting,
        "Computation must start from Waiting state, but was {:?}",
        zk_state.calculation_state,
    );
    
    // Find ALL contribution variables
    // We'll let the ZK computation handle filtering
    let all_contribution_vars: Vec<SecretVarId> = zk_state
        .secret_variables
        .iter()
        .filter_map(|(id, var)| {
            if let SecretVarType::Contribution { .. } = &var.metadata {
                Some(id)
            } else {
                None
            }
        })
        .collect();
    
    // Assert that there's at least one contribution
    assert!(!all_contribution_vars.is_empty(), "No contributions found in the contract");
    
    // Create metadata for the refund proof output variable
    // We'll use the owner from the context as a hint, but the open_variables
    // function will correctly send tokens to the owner in the metadata
    let refund_metadata = vec![SecretVarType::RefundProof { 
        owner: context.sender 
    }];
    
    // Start computation with no public inputs
    let state_change = ZkStateChange::start_computation(
        ShortnameZkComputation::from_u32(REFUND_COMPUTATION_SHORTNAME),
        refund_metadata,
        Some(ShortnameZkComputeComplete::from_u32(REFUND_COMPUTE_COMPLETE_SHORTNAME))
    );
    
    (state, vec![], vec![state_change])
}

/// Callback for token refund to verify successful transfer
#[callback(shortname = 0x44, zk = true)]
fn refund_callback(
    _ctx: ContractContext,
    callback_ctx: CallbackContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
    recipient: Address,
    amount: u128,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    // If token transfer failed, panic to revert the transaction
    assert!(callback_ctx.success, "Token refund transfer failed");
    
    // Return unchanged state
    (state, vec![], vec![])
}

/// Reads a variable's data as an u32
fn read_variable_u32_le(variable: &pbc_contract_common::zk::ZkClosed<SecretVarType>) -> u32 {
    let mut buffer = [0u8; 4];
    buffer.copy_from_slice(variable.data.as_ref().unwrap().as_slice());
    <u32>::from_le_bytes(buffer)
}