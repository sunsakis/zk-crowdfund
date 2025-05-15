#![doc = include_str!("../README.md")]
#![allow(unused_variables)]

#[macro_use]
extern crate pbc_contract_codegen;
extern crate pbc_contract_common;
extern crate pbc_lib;

mod zk_compute;

use pbc_contract_common::address::Address;
use pbc_contract_common::address::AddressType;
use pbc_contract_common::context::{CallbackContext, ContractContext};
use pbc_contract_common::events::EventGroup;
use pbc_contract_common::address::Shortname;
use pbc_contract_common::address::ShortnameCallback;
use pbc_contract_common::zk::ZkClosed;
use pbc_contract_common::zk::{CalculationStatus, SecretVarId, ZkInputDef, ZkState, ZkStateChange};
use pbc_contract_common::avl_tree_map::AvlTreeMap;
use pbc_contract_common::shortname::{ShortnameZkComputation, ShortnameZkComputeComplete};
use pbc_zk::Sbi32;
use read_write_rpc_derive::ReadWriteRPC;
use read_write_state_derive::ReadWriteState;

/// Secret variable metadata types
#[derive(ReadWriteState, ReadWriteRPC, Debug)]
#[repr(u8)]
enum SecretVarType {
    #[discriminant(0)]
    Contribution {},
    #[discriminant(1)]
    SumResult {},
}

/// Status of the crowdfunding campaign
#[derive(ReadWriteState, ReadWriteRPC, Debug, PartialEq, create_type_spec_derive::CreateTypeSpec)]
#[repr(u8)]
enum CampaignStatus {
    #[discriminant(0)]
    Active {},
    #[discriminant(1)]
    Computing {},
    #[discriminant(2)]
    Completed {},
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
    /// Will contain the total raised amount when computation is complete (in ZK units)
    total_raised: Option<u128>,
    /// Number of contributors
    num_contributors: Option<u32>,
    /// Whether the campaign was successful (reached funding target)
    is_successful: bool,
    /// Escrow for token amounts - kept private during active phase
    /// Only used for refunds if campaign fails
    escrow: AvlTreeMap<Address, u128>,
}

// Define shortname constants
const TOKEN_TRANSFER_FROM_SHORTNAME: u8 = 0x03;
const TOKEN_TRANSFER_SHORTNAME: u8 = 0x01;
const CONTRIBUTION_CALLBACK_SHORTNAME: u32 = 0x31;
const SUM_COMPUTE_COMPLETE_SHORTNAME: u32 = 0x42;  // Renamed to avoid collision

/// Initializes contract - starts directly in Active state
#[init(zk = true)]
fn initialize(
    ctx: ContractContext,
    zk_state: ZkState<SecretVarType>,
    title: String,
    description: String,
    token_address: Address,
    funding_target: u128,
) -> ContractState {
    // Validate inputs
    assert!(!title.is_empty(), "Title cannot be empty");
    assert!(!description.is_empty(), "Description cannot be empty");
    assert!(funding_target > 0, "Funding target must be greater than 0");
    assert!(
        token_address.address_type != AddressType::Account,
        "Token address cannot be a user account"
    );

    ContractState {
        owner: ctx.sender,
        title,
        description,
        token_address,
        funding_target, // This is in ZK units (10^6 scale) as expected from frontend
        status: CampaignStatus::Active {},
        total_raised: None,
        num_contributors: None,
        is_successful: false,
        escrow: AvlTreeMap::new(),
    }
}

/// Add a contribution as a secret input
#[zk_on_secret_input(shortname = 0x40)]
fn add_contribution(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
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
    
    // Create a new secret input definition for the ZK contribution
    // The amount is extracted from the secret input itself
    let input_def = 
        ZkInputDef::with_metadata(Some(SHORTNAME_INPUTTED_VARIABLE), SecretVarType::Contribution {});
    
    (state, vec![], input_def)
}

/// Add funds to the campaign from token transfer
/// We use escrow to track contributions while keeping them private
#[action(shortname = 0x07, zk = true)]
fn contribute_tokens(
    context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
    amount: u128,
) -> (ContractState, Vec<EventGroup>) {
    // Check campaign status
    assert_eq!(
        state.status, CampaignStatus::Active {},
        "Contributions can only be made when campaign is active"
    );
    
    // Create token transfer event
    let mut event_group = EventGroup::builder();
    
    // Create token transfer call with the specified amount
    event_group.call(state.token_address, Shortname::from_u32(TOKEN_TRANSFER_FROM_SHORTNAME as u32))
        .argument(context.sender)
        .argument(context.contract_address)
        .argument(amount)
        .done();
    
    // Add callback to handle token transfer result
    event_group.with_callback(ShortnameCallback::from_u32(CONTRIBUTION_CALLBACK_SHORTNAME))
        .argument(amount)
        .done();
    
    // Store in escrow for potential refunds
    // This is still private during active phase since total is unknown
    let current_amount = state.escrow.get(&context.sender).unwrap_or(0);
    state.escrow.insert(context.sender, current_amount + amount);
    
    (state, vec![event_group.build()])
}

/// Callback for token contributions
#[callback(shortname = 0x31, zk = true)]
fn contribute_callback(
    ctx: ContractContext,
    callback_ctx: CallbackContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
    amount: u128,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    // If token transfer failed, panic to revert the transaction
    if !callback_ctx.success {
        panic!("Token transfer failed");
    }

    // Return updated state
    (state, vec![], vec![])
}

/// Automatically called when a variable is confirmed on chain
#[zk_on_variable_inputted(shortname = 0x41)]
fn inputted_variable(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
    inputted_variable: SecretVarId,
) -> ContractState {
    // We don't need additional logic here
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
    let num_contributors = zk_state.secret_variables.len() as u32;
    assert!(
        num_contributors > 0,
        "At least one contributor is needed before ending the campaign"
    );
    
    // Update state
    state.status = CampaignStatus::Computing {};
    state.num_contributors = Some(num_contributors);
    
    // Create function shortname for our zk_compute function
    let function_shortname = ShortnameZkComputation::from_u32(0x61);
    
    // Create callback shortname for the completion function
    let on_complete_hook = Some(ShortnameZkComputeComplete::from_u32(SUM_COMPUTE_COMPLETE_SHORTNAME));
    
    // Create metadata for the output variable - just the discriminant value for SumResult
    let output_metadata: Vec<Vec<u8>> = vec![vec![1]]; // 1 is the discriminant for SumResult
    
    // Start the computation using the StartComputation variant
    (
        state,
        vec![],
        vec![ZkStateChange::StartComputation {
            function_shortname,
            output_variable_metadata: output_metadata, // Fixed field name (was output_variables_metadata)
            input_arguments: vec![],
            on_complete_function_shortname: on_complete_hook,
        }],
    )
}

/// Automatically called when the computation is completed
#[zk_on_compute_complete(shortname = 0x42)]
fn sum_compute_complete(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
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

/// Called when the sum variable is opened
#[zk_on_variables_opened]
fn open_sum_variable(
    context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
    opened_variables: Vec<SecretVarId>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    assert_eq!(
        opened_variables.len(),
        1,
        "Unexpected number of output variables"
    );
    
    let opened_variable = zk_state
        .get_variable(*opened_variables.first().unwrap())
        .unwrap();

    let mut zk_state_changes = vec![];
    
    if let SecretVarType::SumResult {} = opened_variable.metadata {
        // Read the sum result
        let total_raised = read_variable_u32_le(&opened_variable);
        
        // Count the number of contributions
        let num_contributors = zk_state
            .secret_variables
            .iter()
            .filter(|(_, var)| matches!(var.metadata, SecretVarType::Contribution {}))
            .count() as u32;
        
        // IMPORTANT: Interpret both values in ZK units (millionths of a token)
        // Check if the campaign is successful
        let is_successful = (total_raised as u128) >= state.funding_target;
        
        // For successful campaigns, we can safely reveal the total
        // If unsuccessful, we keep it private (but users can see their own refunds)
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
        
        // Mark ZK contract as done
        zk_state_changes = vec![ZkStateChange::ContractDone];
    }
    
    (state, vec![], zk_state_changes)
}

/// Allow the project owner to withdraw funds after a successful campaign
#[action(shortname = 0x04, zk = true)]
fn withdraw_funds(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
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
    
    // Calculate total token amount from escrow
    // This is safe to do for successful campaigns
    let mut total_amount: u128 = 0;
    for (_, amount) in state.escrow.iter() {
        total_amount += amount;
    }
    
    // Create event group for token transfer
    let mut events = Vec::new();
    
    // Create Shortname from u8 value
    let transfer_shortname = Shortname::from_u32(TOKEN_TRANSFER_SHORTNAME as u32);
    
    // Set up transfer event to owner
    let mut event_group = EventGroup::builder();
    event_group.call(state.token_address, transfer_shortname)
        .argument(state.owner)
        .argument(total_amount)
        .done();
    
    events.push(event_group.build());
    
    (state, events)
}

/// Allow contributors to claim refunds after a failed campaign
#[action(shortname = 0x05, zk = true)]
fn claim_refund(
    context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>) {
    // Verify campaign state
    assert_eq!(
        state.status, CampaignStatus::Completed {},
        "Campaign must be completed before claiming refund"
    );
    
    assert!(
        !state.is_successful,
        "Cannot claim refund from successful campaign"
    );
    
    // Get user's contribution amount from escrow
    let refund_amount = state.escrow.get(&context.sender).unwrap_or(0);
    assert!(refund_amount > 0, "No contribution found for this address");
    
    // Remove from escrow to prevent double refunds
    state.escrow.remove(&context.sender);
    
    // Create event group for token transfer
    let mut events = Vec::new();
    
    // Create Shortname from u8 value
    let transfer_shortname = Shortname::from_u32(TOKEN_TRANSFER_SHORTNAME as u32);
    
    // Set up transfer event with the exact amount the user contributed
    let mut event_group = EventGroup::builder();
    event_group.call(state.token_address, transfer_shortname)
        .argument(context.sender)
        .argument(refund_amount)
        .done();
    
    events.push(event_group.build());
    
    (state, events)
}

/// Verify if the caller has made a contribution to this campaign
#[action(shortname = 0x06, zk = true)]
fn verify_my_contribution(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>) {
    // Ensure we only verify completed campaigns
    assert!(
        state.status == CampaignStatus::Completed {},
        "Verification only available after campaign is completed"
    );
    
    // Check if sender has a contribution in ZK state
    let has_contribution = zk_state
        .secret_variables
        .iter()
        .any(|(_, var)| var.owner == context.sender && 
             matches!(var.metadata, SecretVarType::Contribution {}));
             
    // The transaction success/failure will indicate the result
    assert!(has_contribution, "No contribution found for this address");
    
    (state, vec![])
}

/// Reads a variable's data as an u32
fn read_variable_u32_le(variable: &ZkClosed<SecretVarType>) -> u32 {
    let mut buffer = [0u8; 4];
    buffer.copy_from_slice(variable.data.as_ref().unwrap().as_slice());
    <u32>::from_le_bytes(buffer)
}