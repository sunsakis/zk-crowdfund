#![doc = include_str!("../README.md")]
#![allow(unused_variables)]

#[macro_use]
extern crate pbc_contract_codegen;
extern crate pbc_contract_common;
extern crate pbc_lib;

mod zk_compute;

use pbc_contract_common::address::Address;
use pbc_contract_common::context::ContractContext;
use pbc_contract_common::events::EventGroup;
use pbc_contract_common::zk::ZkClosed;
use pbc_contract_common::zk::{SecretVarId, ZkInputDef, ZkState, ZkStateChange};
use pbc_zk::Sbi32;
use read_write_rpc_derive::ReadWriteRPC;
use read_write_state_derive::ReadWriteState;
use std::convert::TryInto;

/// Secret variable metadata types
#[derive(ReadWriteState, ReadWriteRPC, Debug)]
#[repr(u8)]
enum SecretVarType {
    #[discriminant(0)]
    Contribution {},
    #[discriminant(1)]
    SumResult {},
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
    /// Funding target (threshold to reveal total and release funds)
    funding_target: u32,
    /// Campaign deadline as blockchain time
    deadline: u64,
    /// Current status of the crowdfunding campaign
    status: CampaignStatus,
    /// Will contain the total raised amount when computation is complete
    total_raised: Option<u32>,
    /// Number of contributors
    num_contributors: Option<u32>,
    /// Whether the campaign was successful (reached funding target)
    is_successful: bool,
}

/// Status of the crowdfunding campaign (removed Setup state)
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

/// Initializes contract - starts directly in Active state
#[init(zk = true)]
fn initialize(
    ctx: ContractContext,
    zk_state: ZkState<SecretVarType>,
    title: String,
    description: String,
    funding_target: u32,
    deadline: u64,
) -> ContractState {
    // Validate inputs
    assert!(!title.is_empty(), "Title cannot be empty");
    assert!(!description.is_empty(), "Description cannot be empty");
    assert!(funding_target > 0, "Funding target must be greater than 0");
    assert!(
        deadline > ctx.block_production_time.try_into().unwrap(),
        "Deadline must be in the future"
    );

    ContractState {
        owner: ctx.sender,
        title,
        description,
        funding_target,
        deadline,
        status: CampaignStatus::Active {}, // Start directly in Active state
        total_raised: None,
        num_contributors: None,
        is_successful: false,
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
    
    // Check that deadline hasn't passed
    assert!(
        state.deadline > context.block_production_time.try_into().unwrap(),
        "Campaign deadline has passed"
    );
    
    // Check that this address hasn't already contributed
    assert!(
        zk_state
            .secret_variables
            .iter()
            .chain(zk_state.pending_inputs.iter())
            .all(|(_, v)| v.owner != context.sender),
        "Each address is only allowed to contribute once. Sender: {:?}",
        context.sender
    );
    
    // Create a new secret input definition
    let input_def =
        ZkInputDef::with_metadata(Some(SHORTNAME_INPUTTED_VARIABLE), SecretVarType::Contribution {});
    
    (state, vec![], input_def)
}

/// Automatically called when a variable is confirmed on chain
#[zk_on_variable_inputted(shortname = 0x41)]
fn inputted_variable(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
    inputted_variable: SecretVarId,
) -> ContractState {
    // This is a hook that gets called when a contribution is added
    // For our simple case, we don't need to do anything special here
    state
}

/// End campaign and compute results
#[action(shortname = 0x02, zk = true)]
fn end_campaign(
    context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    // Check permissions - anyone can end the campaign if deadline has passed
    let is_owner = context.sender == state.owner;
    let deadline_passed = context.block_production_time >= state.deadline.try_into().unwrap();
    
    assert!(
        is_owner || deadline_passed,
        "Only owner can end campaign before deadline"
    );
    
    // Check state
    assert_eq!(
        state.status, CampaignStatus::Active {},
        "Campaign can only be ended from Active state"
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

/// Automatically called when a variable is opened/declassified
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
        
        // Update state with total raised
        state.total_raised = Some(total_raised);
        
        // Check if campaign was successful
        state.is_successful = total_raised >= state.funding_target;
        
        // Mark campaign as completed
        state.status = CampaignStatus::Completed {};
        
        // Finalize ZK contract
        zk_state_changes = vec![ZkStateChange::ContractDone];
    }
    
    (state, vec![], zk_state_changes)
}

/// Withdraw funds (only available to owner if campaign was successful)
#[action(shortname = 0x03, zk = true)]
fn withdraw_funds(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> ContractState {
    // Check permissions
    assert_eq!(
        context.sender, state.owner,
        "Only owner can withdraw funds"
    );
    
    // Check if campaign is completed
    assert_eq!(
        state.status, CampaignStatus::Completed {},
        "Campaign must be completed before withdrawing funds"
    );
    
    // Check if campaign was successful
    assert!(
        state.is_successful,
        "Funds can only be withdrawn if campaign was successful"
    );
    
    // In a real implementation, this would transfer the funds to the owner
    // But since we're just tracking contributions and not actual token transfers,
    // we'll just mark it as a conceptual withdrawal
    
    state
}

/// Reads a variable's data as an u32
fn read_variable_u32_le(variable: &ZkClosed<SecretVarType>) -> u32 {
    let mut buffer = [0u8; 4];
    buffer.copy_from_slice(variable.data.as_ref().unwrap().as_slice());
    <u32>::from_le_bytes(buffer)
}