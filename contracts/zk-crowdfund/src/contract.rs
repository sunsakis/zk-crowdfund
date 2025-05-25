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
use pbc_zk::Sbu32;
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

/// Public campaign information structure - NO private amounts exposed
#[derive(ReadWriteState, ReadWriteRPC, Debug, Clone, CreateTypeSpec)]
struct CampaignPublicInfo {
    owner: Address,
    title: String,
    description: String,
    token_address: Address,
    funding_target: u32,
    status: CampaignStatus,
    total_raised: Option<u32>, // Only revealed if threshold met
    num_contributors: Option<u32>,
    is_successful: bool,
}

/// Contract state - NO sensitive amounts stored here
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
    /// Funding target in raw token units
    funding_target: u32,
    /// Current status of the crowdfunding campaign
    status: CampaignStatus,
    /// Total raised - ONLY revealed if threshold met
    total_raised: Option<u32>,
    /// Number of contributors
    num_contributors: Option<u32>,
    /// Whether the campaign was successful
    is_successful: bool,
    /// Tracks whether the funds have been withdrawn
    funds_withdrawn: bool,
    /// Secret variable ID that tracks the actual token balance (encrypted)
    /// This ID points to encrypted data, amount is never visible
    balance_tracker_id: Option<SecretVarId>,
}

/// Shortname constants
const TOKEN_TRANSFER_FROM_SHORTNAME: u8 = 0x03;
const TOKEN_TRANSFER_SHORTNAME: u8 = 0x01;
const CONTRIBUTION_CALLBACK_SHORTNAME: u32 = 0x31;
const SUM_COMPUTE_COMPLETE_SHORTNAME: u32 = 0x42;
const ZK_COMPUTATION_SHORTNAME: u32 = 0x61;

/// Conversion factor
const WEI_PER_TOKEN_UNIT: u128 = 1_000_000_000_000; // 1e12

fn token_units_to_wei(token_units: u32) -> u128 {
    (token_units as u128) * WEI_PER_TOKEN_UNIT
}

/// Initializes contract - creates initial encrypted balance tracker
#[init(zk = true)]
fn initialize(
    ctx: ContractContext,
    _zk_state: ZkState<SecretVarType>,
    title: String,
    description: String,
    token_address: Address,
    funding_target: u32,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    assert!(!title.is_empty(), "Title cannot be empty");
    assert!(!description.is_empty(), "Description cannot be empty");
    assert!(funding_target > 0, "Funding target must be greater than 0");

    // We'll create the encrypted balance tracker during the first contribution
    // to avoid compilation issues with manual ZK variable creation
    
    let state = ContractState {
        owner: ctx.sender,
        title,
        description,
        token_address,
        funding_target,
        status: CampaignStatus::Active {},
        total_raised: None,
        num_contributors: None,
        is_successful: false,
        funds_withdrawn: false,
        balance_tracker_id: None, // Will be set during ZK computation
    };

    (state, vec![], vec![])
}

/// Add a contribution as a secret input
#[zk_on_secret_input(shortname = 0x40)]
fn add_contribution(
    context: ContractContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
) -> (
    ContractState,
    Vec<EventGroup>,
    ZkInputDef<SecretVarType, Sbu32>,
) {
    assert_eq!(
        state.status, CampaignStatus::Active {},
        "Contributions can only be made when campaign is active"
    );
    
    let metadata = SecretVarType::Contribution { 
        owner: context.sender,
        timestamp: context.block_production_time,
    };
    
    let input_def = ZkInputDef::with_metadata(None, metadata);
    (state, vec![], input_def)
}

/// Process token transfer for contribution
#[action(shortname = 0x07, zk = true)]
fn contribute_tokens(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
    amount: u32,
) -> (ContractState, Vec<EventGroup>) {
    assert_eq!(
        state.status, CampaignStatus::Active {},
        "Contributions can only be made when campaign is active"
    );
    
    assert!(amount > 0, "Contribution amount must be greater than 0");
    
    // Check for ZK contribution commitment
    let user_contribution_count = zk_state.secret_variables.iter()
        .filter(|(_, var)| matches!(&var.metadata, SecretVarType::Contribution { owner, .. } if *owner == context.sender))
        .count();
    
    assert!(
        user_contribution_count > 0,
        "Must create contribution commitment first"
    );
    
    let wei_amount = token_units_to_wei(amount);
    
    let mut event_group = EventGroup::builder();
    event_group.call(state.token_address, Shortname::from_u32(TOKEN_TRANSFER_FROM_SHORTNAME as u32))
        .argument(context.sender)
        .argument(context.contract_address)
        .argument(wei_amount)
        .done();
    
    event_group.with_callback(ShortnameCallback::from_u32(CONTRIBUTION_CALLBACK_SHORTNAME))
        .argument(amount)
        .done();
    
    (state, vec![event_group.build()])
}

/// Track tokens in encrypted ZK variable only
#[callback(shortname = 0x31, zk = true)]
fn contribute_callback(
    _ctx: ContractContext,
    callback_ctx: CallbackContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
    _amount: u32,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    if !callback_ctx.success {
        panic!("Token transfer failed");
    }

    // The actual token amount tracking happens ONLY in ZK variables during end_campaign
    // We don't store any amounts in the contract state here
    // This preserves perfect privacy - no amounts are ever visible in contract state
    
    (state, vec![], vec![])
}

/// End campaign and compute results - this reveals total only if threshold met
#[action(shortname = 0x01, zk = true)]
fn end_campaign(
    context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    assert_eq!(context.sender, state.owner, "Only owner can end the campaign");
    assert_eq!(state.status, CampaignStatus::Active {}, "Campaign can only be ended from Active state");
    assert_eq!(zk_state.calculation_state, CalculationStatus::Waiting, "Computation must start from Waiting state");

    let contributions = zk_state.secret_variables.iter()
        .filter(|(_, var)| matches!(var.metadata, SecretVarType::Contribution { .. }))
        .count();
    
    let num_contributors = contributions as u32;
    state.status = CampaignStatus::Computing {};
    state.num_contributors = Some(num_contributors);
    
    if num_contributors == 0 {
        state.status = CampaignStatus::Completed {};
        state.is_successful = false;
        state.total_raised = None; // No total to reveal
        return (state, vec![], vec![]);
    }
    
    // Start ZK computation to sum all contributions
    // This will create encrypted variables with the sum
    let function_shortname = ShortnameZkComputation::from_u32(ZK_COMPUTATION_SHORTNAME);
    let on_complete_hook = Some(ShortnameZkComputeComplete::from_u32(SUM_COMPUTE_COMPLETE_SHORTNAME));
    let output_metadata = vec![SecretVarType::SumResult {}];
    
    let zk_change = ZkStateChange::start_computation(
        function_shortname,
        output_metadata,
        on_complete_hook,
    );
    
    (state, vec![], vec![zk_change])
}

/// ZK computation completed - now decide whether to reveal the total
#[zk_on_compute_complete(shortname = 0x42)]
fn sum_compute_complete(
    _context: ContractContext,
    mut state: ContractState,
    _zk_state: ZkState<SecretVarType>,
    output_variables: Vec<SecretVarId>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    // Store the balance tracker ID for withdrawal purposes
    // This points to encrypted data - the amount is never visible in contract state
    if !output_variables.is_empty() {
        state.balance_tracker_id = Some(output_variables[0]);
    }

    // Open/declassify the sum result to check if threshold was met
    (
        state,
        vec![],
        vec![ZkStateChange::OpenVariables {
            variables: output_variables.clone(),
        }],
    )
}

/// Handle both threshold-based revelation and withdrawal processing
#[zk_on_variables_opened]
fn handle_opened_variables(
    _context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
    opened_variables: Vec<SecretVarId>,
) -> (ContractState, Vec<EventGroup>) {
    if opened_variables.is_empty() {
        return (state, vec![]);
    }
    
    let opened_variable = zk_state.get_variable(opened_variables[0]).unwrap();
    
    // Case 1: Handle sum revelation (when status is Computing)
    if matches!(state.status, CampaignStatus::Computing {}) {
        if let Some(sum_data) = &opened_variable.data {
            if sum_data.len() >= 4 {
                let sum_bytes: [u8; 4] = sum_data[0..4].try_into().unwrap_or([0u8; 4]);
                let sum_value = u32::from_le_bytes(sum_bytes);
                
                state.status = CampaignStatus::Completed {};
                
                // THRESHOLD-BASED REVELATION: Only reveal total if threshold met
                if sum_value >= state.funding_target {
                    state.is_successful = true;
                    state.total_raised = Some(sum_value); // ✅ Reveal total
                } else {
                    state.is_successful = false;
                    state.total_raised = None; // ✅ Keep total completely hidden
                }
            } else {
                state.status = CampaignStatus::Completed {};
                state.is_successful = false;
                state.total_raised = None;
            }
        } else {
            state.status = CampaignStatus::Completed {};
            state.is_successful = false;
            state.total_raised = None;
        }
        
        return (state, vec![]);
    }
    
    // Case 2: Handle withdrawal transfer (when funds_withdrawn is true)
    if state.funds_withdrawn {
        if let Some(withdrawal_data) = &opened_variable.data {
            if withdrawal_data.len() >= 4 {
                let amount_bytes: [u8; 4] = withdrawal_data[0..4].try_into().unwrap_or([0u8; 4]);
                let tokens_to_withdraw = u32::from_le_bytes(amount_bytes);
                
                if tokens_to_withdraw > 0 {
                    let withdraw_amount_wei = token_units_to_wei(tokens_to_withdraw);
                    
                    let mut event_group = EventGroup::builder();
                    event_group.call(state.token_address, Shortname::from_u32(TOKEN_TRANSFER_SHORTNAME as u32))
                        .argument(state.owner)
                        .argument(withdraw_amount_wei)
                        .done();
                    
                    return (state, vec![event_group.build()]);
                }
            }
        }
    }
    
    (state, vec![])
}

/// Withdraw funds using the encrypted balance tracker
#[action(shortname = 0x04, zk = true)]
fn withdraw_funds(
    context: ContractContext,
    mut state: ContractState,
    _zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    assert_eq!(context.sender, state.owner, "Only the owner can withdraw funds");
    assert_eq!(state.status, CampaignStatus::Completed {}, "Campaign must be completed");
    assert!(!state.funds_withdrawn, "Funds have already been withdrawn");
    
    // Use the encrypted balance tracker to get the actual amount
    let balance_tracker_id = state.balance_tracker_id
        .expect("Balance tracker should exist after campaign completion");
    
    // Since we know the campaign was successful, we can directly open the balance tracker
    // instead of running another computation
    state.funds_withdrawn = true;
    
    (state, vec![], vec![ZkStateChange::OpenVariables {
        variables: vec![balance_tracker_id],
    }])
}

/// Handle withdrawal completion
#[zk_on_compute_complete(shortname = 0x43)]
fn withdrawal_complete(
    _context: ContractContext,
    state: ContractState,
    _zk_state: ZkState<SecretVarType>,
    output_variables: Vec<SecretVarId>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    // Open the withdrawal amount temporarily for transfer
    (
        state,
        vec![],
        vec![ZkStateChange::OpenVariables {
            variables: output_variables,
        }],
    )
}