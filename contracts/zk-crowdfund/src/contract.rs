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
    /// Track addresses that have already claimed refunds
    refund_claimed: Vec<Address>,
    /// Track variables that have been processed for refunds (to avoid reuse)
    processed_variables: Vec<SecretVarId>,
}

/// Shortname constants for contract actions and callbacks
const TOKEN_TRANSFER_FROM_SHORTNAME: u8 = 0x03;
const TOKEN_TRANSFER_SHORTNAME: u8 = 0x01;
const CONTRIBUTION_CALLBACK_SHORTNAME: u32 = 0x31;
const SUM_COMPUTE_COMPLETE_SHORTNAME: u32 = 0x42;
const ZK_COMPUTATION_SHORTNAME: u32 = 0x61;

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
        is_successful: false,
        refund_claimed: Vec::new(),
        processed_variables: Vec::new(),
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
    
    // For successful campaigns, we use the verified total from ZK computation
    let total_to_withdraw = state.total_raised.unwrap_or(0) * 1_000_000_000_000_u128;
    
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