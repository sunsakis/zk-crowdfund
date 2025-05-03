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
// Import the Shortname type from address module
use pbc_contract_common::address::Shortname;
// Import the ShortnameCallback type from address module
use pbc_contract_common::address::ShortnameCallback;
use pbc_contract_common::zk::ZkClosed;
use pbc_contract_common::zk::{CalculationStatus, SecretVarId, ZkInputDef, ZkState, ZkStateChange};
use pbc_contract_common::avl_tree_map::AvlTreeMap;
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
    /// Will contain the total raised amount when computation is complete
    total_raised: Option<u128>,
    /// Number of contributors
    num_contributors: Option<u32>,
    /// Whether the campaign was successful (reached funding target)
    is_successful: bool,
    /// Map of contributor addresses to their contribution amounts (for refunds)
    contributions: AvlTreeMap<Address, u128>,
}

// Define shortname constants correctly
const TOKEN_TRANSFER_FROM_SHORTNAME: u8 = 0x03;
const TOKEN_TRANSFER_SHORTNAME: u8 = 0x01;
const CONTRIBUTION_CALLBACK_SHORTNAME: u32 = 0x31;

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
        token_address.address_type == AddressType::PublicContract,
        "Token address must be a public contract"
    );

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
        contributions: AvlTreeMap::new(),
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
    
    // Create a new secret input definition
    let input_def =
        ZkInputDef::with_metadata(Some(SHORTNAME_INPUTTED_VARIABLE), SecretVarType::Contribution {});
    
    (state, vec![], input_def)
}

/// Contribute tokens to the campaign
/// This should be called after approving tokens from the token contract
#[action(shortname = 0x03, zk = true)]
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

    // Create event group for token transfer
    let mut events = Vec::new();
    
    // Build event group
    let mut event_group = EventGroup::builder();
    
    // Create Shortname from u8 value
    let transfer_from_shortname = Shortname::from_u8(TOKEN_TRANSFER_FROM_SHORTNAME);
    
    // Create proper ShortnameCallback from u32 value
    let callback_shortname = ShortnameCallback::from_u32(CONTRIBUTION_CALLBACK_SHORTNAME);
    
    // Use call with Shortname
    event_group.call(state.token_address, transfer_from_shortname)
        .argument(context.sender)
        .argument(context.contract_address)
        .argument(amount)
        .done();
    
    // Use with_callback with ShortnameCallback
    event_group.with_callback(callback_shortname)
        .argument(amount)
        .done();
    
    events.push(event_group.build());
    
    // Return state and events
    (state, events)
}

/// Callback for token contribution
#[callback(shortname = 0x31, zk = true)]
fn contribute_callback(
    ctx: ContractContext,
    callback_ctx: CallbackContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>, 
    amount: u128,
) -> (ContractState, Vec<EventGroup>) {
    if !callback_ctx.success {
        panic!("Token transfer failed");
    }

    // Record contribution for potential refund
    let current_contribution = state.contributions.get(&ctx.sender).unwrap_or(0);
    state.contributions.insert(ctx.sender, current_contribution + amount);

    // Return updated state
    (state, vec![])
}

/// Automatically called when a variable is confirmed on chain
#[zk_on_variable_inputted(shortname = 0x41)]
fn inputted_variable(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
    inputted_variable: SecretVarId,
) -> ContractState {
    state
}

/// End campaign and compute results
/// Uses shortname 0x01 to make it easier to call from frontend
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
    
    // Start ZK computation to sum all contributions
    (
        state,
        vec![],
        vec![zk_compute::sum_contributions_start(
            Some(SHORTNAME_SUM_COMPUTE_COMPLETE),
            &SecretVarType::SumResult {},
        )],
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
        
        // Determine if campaign was successful
        let is_successful = total_raised as u128 >= state.funding_target;
        
        // Set the total_raised amount
        state.total_raised = Some(total_raised as u128);
        
        // Set the contributor count and success flag
        state.num_contributors = Some(num_contributors);
        state.is_successful = is_successful;
        
        // Mark campaign as completed
        state.status = CampaignStatus::Completed {};
        
        // Finalize ZK contract
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
    
    // Create event group for token transfer
    let mut events = Vec::new();
    
    // Create Shortname from u8 value
    let transfer_shortname = Shortname::from_u8(TOKEN_TRANSFER_SHORTNAME);
    
    // Set up transfer event with proper Shortname
    let mut event_group = EventGroup::builder();
    event_group.call(state.token_address, transfer_shortname)
        .argument(state.owner)
        .argument(state.total_raised.unwrap_or(0))
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
    
    // Get contribution amount
    let amount = state.contributions.get(&context.sender).unwrap_or(0);
    assert!(amount > 0, "No contribution found for this address");
    
    // Remove contribution record
    state.contributions.remove(&context.sender);
    
    // Create event group for token transfer
    let mut events = Vec::new();
    
    // Create Shortname from u8 value
    let transfer_shortname = Shortname::from_u8(TOKEN_TRANSFER_SHORTNAME);
    
    // Set up transfer event
    let mut event_group = EventGroup::builder();
    event_group.call(state.token_address, transfer_shortname)
        .argument(context.sender)
        .argument(amount)
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
    
    // Check if sender has a contribution
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