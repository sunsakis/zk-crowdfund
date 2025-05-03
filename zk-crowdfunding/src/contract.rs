#![doc = include_str!("../README.md")]
#![allow(unused_variables)]

#[macro_use]
extern crate pbc_contract_codegen;
extern crate pbc_contract_common;
extern crate pbc_lib;

mod zk_compute;
mod token_interface;

use pbc_contract_common::address::Address;
use pbc_contract_common::context::ContractContext;
use pbc_contract_common::events::EventGroup;
use pbc_contract_common::zk::ZkClosed;
use pbc_contract_common::zk::{CalculationStatus, SecretVarId, ZkInputDef, ZkState, ZkStateChange};
use pbc_zk::Sbi32;
use read_write_rpc_derive::ReadWriteRPC;
use read_write_state_derive::ReadWriteState;
use token_interface::MPC20TokenInterface;
use pbc_contract_common::sorted_vec_map::SortedVecMap;

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
#[derive(ReadWriteState, ReadWriteRPC, Debug, PartialEq, create_type_spec_derive::CreateTypeSpec, Clone)]
#[repr(u8)]
enum CampaignStatus {
    #[discriminant(0)]
    Setup {},    // Initial setup state - awaiting token approval
    #[discriminant(1)]
    Active {},   // Accepting contributions
    #[discriminant(2)]
    Computing {}, // ZK computation in progress
    #[discriminant(3)]
    Completed {}, // Campaign finished - success or failure determined
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
    /// The token contract address for this campaign
    token_address: Address,
    /// Funding target (threshold to reveal total and release funds)
    funding_target: u128,
    /// Deadline timestamp in milliseconds
    deadline: u64,
    /// Current status of the crowdfunding campaign
    status: CampaignStatus,
    /// Will contain the total raised amount when computation is complete
    total_raised: Option<u128>,
    /// Number of contributors
    num_contributors: Option<u32>,
    /// Whether the campaign was successful (reached funding target)
    is_successful: bool,
    /// Map to track contributor addresses and their contribution IDs (ZK variable IDs)
    /// This allows for refunds later if needed
    contributor_var_ids: SortedVecMap<Address, SecretVarId>,
}

/// Event emitted when the campaign status changes
#[derive(ReadWriteRPC)]
struct CampaignStatusChangedEvent {
    campaign_address: Address,
    new_status: CampaignStatus,
    timestamp: u64,
}

/// Event emitted when a contribution is received
#[derive(ReadWriteRPC)]
struct ContributionReceivedEvent {
    contributor: Address,
    timestamp: u64,
}

/// Event emitted when the campaign completes processing
#[derive(ReadWriteRPC)]
struct CampaignCompletedEvent {
    campaign_address: Address,
    is_successful: bool,
    total_contributors: u32,
    total_raised: Option<u128>,
    timestamp: u64,
}

/// Event emitted when funds are withdrawn by the project owner
#[derive(ReadWriteRPC)]
struct FundsWithdrawnEvent {
    campaign_address: Address,
    owner: Address,
    amount: u128,
    timestamp: u64,
}

/// Event emitted when a refund is processed
#[derive(ReadWriteRPC)]
struct RefundProcessedEvent {
    campaign_address: Address,
    contributor: Address,
    timestamp: u64,
}

/// Initializes contract
#[init(zk = true)]
fn initialize(
    ctx: ContractContext,
    zk_state: ZkState<SecretVarType>,
    title: String,
    description: String,
    token_address: Address,
    funding_target: u128,
    deadline: u64,
) -> ContractState {
    // Validate inputs
    assert!(!title.is_empty(), "Title cannot be empty");
    assert!(!description.is_empty(), "Description cannot be empty");
    assert!(funding_target > 0, "Funding target must be greater than 0");
    assert!(deadline > ctx.block_production_time.try_into().unwrap(), "Deadline must be in the future");

    ContractState {
        owner: ctx.sender,
        title,
        description,
        token_address,
        funding_target,
        deadline,
        status: CampaignStatus::Setup {}, // Start in setup state
        total_raised: None,
        num_contributors: None,
        is_successful: false,
        contributor_var_ids: SortedVecMap::new(),
    }
}

/// Start the campaign - changes state to Active
#[action(shortname = 0x01, zk = true)]
fn start_campaign(
    context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>) {
    // Verify sender is the owner
    assert_eq!(context.sender, state.owner, "Only owner can start the campaign");
    
    // Verify campaign is in Setup state
    assert_eq!(state.status, CampaignStatus::Setup {}, "Campaign must be in Setup state");
    
    // Change state to Active
    state.status = CampaignStatus::Active {};
    
    // Create status changed event
    let status_event = CampaignStatusChangedEvent {
        campaign_address: context.contract_address,
        new_status: state.status.clone(),
        timestamp: context.block_production_time.try_into().unwrap(),
    };
    
    // Create event group with binary content
    let mut builder = EventGroup::builder();
    // Use add_raw_event - correct version of the method
    builder = builder.add_raw_event(&status_event);
    let event_group = builder.build();
    
    // Return updated state and events
    (state, vec![event_group])
}

/// Add a contribution as a secret input
/// This also transfers the tokens from the contributor to this contract
#[zk_on_secret_input(shortname = 0x40)]
fn add_contribution(
    context: ContractContext,
    mut state: ContractState,
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
    
    // Check deadline
    assert!(
        context.block_production_time <= state.deadline.try_into().unwrap(),
        "Campaign deadline has passed"
    );
    
    // Verify contributor hasn't already contributed
    assert!(
        !state.contributor_var_ids.contains_key(&context.sender),
        "Each address can only contribute once to maintain privacy"
    );
    
    // Create a new secret input definition
    let input_def =
        ZkInputDef::with_metadata(Some(SHORTNAME_INPUTTED_VARIABLE), SecretVarType::Contribution {});
    
    // Create contribution received event
    let contribution_event = ContributionReceivedEvent {
        contributor: context.sender,
        timestamp: context.block_production_time.try_into().unwrap(),
    };
    
    // Create event group with binary content
    let mut builder = EventGroup::builder();
    // Use add_raw_event - correct version of the method
    builder = builder.add_raw_event(&contribution_event);
    let event_group = builder.build();
    
    // NOTE: The token transfer happens in the inputted_variable callback
    // after the value is confirmed on-chain
    
    // Return updated state, events, and input definition
    (state, vec![event_group], input_def)
}

/// Automatically called when a variable is confirmed on chain
/// This is where we actually process the token transfer after the contribution is confirmed
#[zk_on_variable_inputted(shortname = 0x41)]
fn inputted_variable(
    context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
    inputted_variable: SecretVarId,
) -> (ContractState, Vec<EventGroup>) {
    // Get the variable that was input
    let variable = zk_state.get_variable(inputted_variable).unwrap();
    
    // Only process contribution variables
    if let SecretVarType::Contribution {} = variable.metadata {
        // Extract the contribution amount from the secret input
        let amount = read_variable_u32_le(&variable) as u128;
        
        // Store the variable ID for this contributor (for potential refunds)
        state.contributor_var_ids.insert(variable.owner, inputted_variable);
        
        // Call the token contract to transfer tokens from contributor to this contract
        // This uses the transferFrom method which requires prior approval from the sender
        let mut events = Vec::new();
        if amount > 0 {
            let token_interface = MPC20TokenInterface::new(state.token_address);
            let transfer_events = token_interface.transfer_from(
                &context,
                variable.owner,  // from
                context.contract_address, // to (this contract)
                amount
            );
            events.push(transfer_events);
        }
        
        return (state, events);
    }
    
    (state, vec![])
}

/// End campaign and compute results
/// Can be called by anyone after the deadline, or by the owner anytime
#[action(shortname = 0x02, zk = true)]
fn end_campaign(
    context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    // Check permissions - owner can end anytime, others only after deadline
    if context.sender != state.owner {
        assert!(
            context.block_production_time > state.deadline.try_into().unwrap(),
            "Only the owner can end the campaign before the deadline"
        );
    }
    
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
    let num_contributors = zk_state
        .secret_variables
        .iter()
        .filter(|(_, var)| matches!(var.metadata, SecretVarType::Contribution {}))
        .count() as u32;
        
    assert!(
        num_contributors > 0,
        "At least one contributor is needed before ending the campaign"
    );
    
    // Update state
    state.status = CampaignStatus::Computing {};
    state.num_contributors = Some(num_contributors);
    
    // Create status changed event
    let status_event = CampaignStatusChangedEvent {
        campaign_address: context.contract_address,
        new_status: state.status.clone(),
        timestamp: context.block_production_time.try_into().unwrap(),
    };
    
    // Create event group with binary content
    let mut builder = EventGroup::builder();
    // Use add_raw_event - correct version of the method
    builder = builder.add_raw_event(&status_event);
    let event_group = builder.build();
    
    // Start ZK computation to sum all contributions
    (
        state,
        vec![event_group],
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

/// Called when computation variables are opened/declassified
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
        // Read the sum result (u32) and convert to u128 for token amounts
        let total_raised = read_variable_u32_le(&opened_variable) as u128;
        
        // Count the number of contributions
        let num_contributors = zk_state
            .secret_variables
            .iter()
            .filter(|(_, var)| matches!(var.metadata, SecretVarType::Contribution {}))
            .count() as u32;
        
        // Determine if campaign was successful
        let is_successful = total_raised >= state.funding_target;
        
        // Update state with results
        state.total_raised = Some(total_raised);
        state.num_contributors = Some(num_contributors);
        state.is_successful = is_successful;
        
        // Mark campaign as completed
        state.status = CampaignStatus::Completed {};
        
        // Create events
        let status_event = CampaignStatusChangedEvent {
            campaign_address: context.contract_address,
            new_status: state.status.clone(),
            timestamp: context.block_production_time.try_into().unwrap(),
        };
        
        let completed_event = CampaignCompletedEvent {
            campaign_address: context.contract_address,
            is_successful,
            total_contributors: num_contributors,
            total_raised: Some(total_raised),
            timestamp: context.block_production_time.try_into().unwrap(),
        };
        
        // Create event group with binary content
        let mut builder = EventGroup::builder();
        // Use add_raw_event - correct version of the method
        builder = builder.add_raw_event(&status_event);
        builder = builder.add_raw_event(&completed_event);
        let event_group = builder.build();
        
        // Finalize ZK contract
        zk_state_changes = vec![ZkStateChange::ContractDone];
        
        return (
            state,
            vec![event_group],
            zk_state_changes,
        );
    }
    
    (state, vec![], zk_state_changes)
}

/// Withdraw funds by project owner after successful campaign
#[action(shortname = 0x03, zk = true)]
fn withdraw_funds(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>) {
    // Check campaign is completed
    assert_eq!(
        state.status, CampaignStatus::Completed {},
        "Campaign must be completed before withdrawing funds"
    );
    
    // Check if sender is the owner
    assert_eq!(
        context.sender, state.owner,
        "Only the project owner can withdraw funds"
    );
    
    // Check if campaign was successful
    assert!(
        state.is_successful,
        "Funds can only be withdrawn if the campaign was successful"
    );
    
    // Get total raised amount
    let amount = state.total_raised.unwrap();
    
    // Transfer tokens from this contract to the owner
    let token_interface = MPC20TokenInterface::new(state.token_address);
    let transfer_events = token_interface.transfer(
        &context,
        state.owner,
        amount
    );
    
    // Create withdrawal event
    let withdrawal_event = FundsWithdrawnEvent {
        campaign_address: context.contract_address,
        owner: state.owner,
        amount,
        timestamp: context.block_production_time.try_into().unwrap(),
    };
    
    // Create event group with binary content
    let mut builder = EventGroup::builder();
    // Use add_raw_event - correct version of the method
    builder = builder.add_raw_event(&withdrawal_event);
    let event_group = builder.build();
    
    // Return events
    (state, vec![event_group, transfer_events])
}

/// Claim refund if campaign failed
#[action(shortname = 0x04, zk = true)]
fn claim_refund(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>) {
    // Check campaign is completed
    assert_eq!(
        state.status, CampaignStatus::Completed {},
        "Campaign must be completed before claiming refunds"
    );
    
    // Check campaign failed
    assert!(
        !state.is_successful,
        "Refunds are only available if the campaign failed"
    );
    
    // Verify sender has contributed
    assert!(
        state.contributor_var_ids.contains_key(&context.sender),
        "No contribution found for this address"
    );
    
    // Get the variable ID for this contributor
    let var_id = state.contributor_var_ids.get(&context.sender).unwrap();
    
    // Get the contribution amount
    let variable = zk_state.get_variable(*var_id).unwrap();
    let contribution_amount = read_variable_u32_le(&variable) as u128;
    
    // Transfer tokens from this contract back to the contributor
    let token_interface = MPC20TokenInterface::new(state.token_address);
    let transfer_events = token_interface.transfer(
        &context,
        context.sender,
        contribution_amount
    );
    
    // Create refund event
    let refund_event = RefundProcessedEvent {
        campaign_address: context.contract_address,
        contributor: context.sender,
        timestamp: context.block_production_time.try_into().unwrap(),
    };
    
    // Create event group with binary content
    let mut builder = EventGroup::builder();
    // Use add_raw_event - correct version of the method
    builder = builder.add_raw_event(&refund_event);
    let event_group = builder.build();
    
    // Return events
    (state, vec![event_group, transfer_events])
}

/// Verify if the caller has made a contribution to this campaign
///
/// This function allows any user to check if their contribution was included in the campaign
/// without revealing their contribution amount
#[action(shortname = 0x05, zk = true)]
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
    let has_contribution = state.contributor_var_ids.contains_key(&context.sender);
             
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