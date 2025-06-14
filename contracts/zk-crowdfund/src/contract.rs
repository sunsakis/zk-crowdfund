#![doc = include_str!("../README.md")]

#[macro_use]
extern crate pbc_contract_codegen;
extern crate pbc_contract_common;
extern crate pbc_lib;

mod zk_compute;

use create_type_spec_derive::CreateTypeSpec;
use pbc_contract_common::address::Address;
use pbc_contract_common::address::Shortname;
use pbc_contract_common::address::ShortnameCallback;
use pbc_contract_common::context::{CallbackContext, ContractContext};
use pbc_contract_common::events::EventGroup;
use pbc_contract_common::shortname::{ShortnameZkComputation, ShortnameZkComputeComplete};
use pbc_contract_common::zk::{CalculationStatus, SecretVarId, ZkInputDef, ZkState, ZkStateChange};
use pbc_zk::Sbu32;
use read_write_rpc_derive::ReadWriteRPC;
use read_write_state_derive::ReadWriteState;

/// Secret variable metadata types
#[derive(ReadWriteState, ReadWriteRPC, Debug, Clone, CreateTypeSpec)]
#[repr(u8)]
enum SecretVarType {
    #[discriminant(0)]
    Contribution { owner: Address, timestamp: i64 },
    #[discriminant(1)]
    TokenBalance { owner: Address, timestamp: i64 },
    #[discriminant(2)]
    ThresholdCheckResult { _placeholder: u8 },
    #[discriminant(3)]
    ConditionalTotal { _placeholder: u8 },
    #[discriminant(4)]
    ActualTotal { _placeholder: u8 },
}

/// Campaign status
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

/// Contract state with separate trackers for public display vs private withdrawal
#[state]
struct ContractState {
    owner: Address,
    title: String,
    description: String,
    token_address: Address,
    funding_target: u32,
    status: CampaignStatus,
    total_raised: Option<u32>, // Public display (only if threshold met)
    num_contributors: Option<u32>,
    is_successful: bool,
    funds_withdrawn: bool,
    balance_tracker_id: Option<SecretVarId>, // For public display (conditional)
    withdrawal_tracker_id: Option<SecretVarId>, // For owner withdrawal (actual total)
}

/// Constants
const TOKEN_TRANSFER_SHORTNAME: u8 = 0x01;
const CONTRIBUTION_CALLBACK_SHORTNAME: u32 = 0x31;
const THRESHOLD_CHECK_COMPLETE_SHORTNAME: u32 = 0x42;
const ZK_THRESHOLD_CHECK_SHORTNAME: u32 = 0x61;
const WEI_PER_TOKEN_UNIT: u128 = 1_000_000_000_000;

fn token_units_to_wei(token_units: u32) -> u128 {
    (token_units as u128) * WEI_PER_TOKEN_UNIT
}

/// Initialize contract
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
        balance_tracker_id: None,
        withdrawal_tracker_id: None,
    };

    (state, vec![], vec![])
}

/// Add contribution
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
        state.status,
        CampaignStatus::Active {},
        "Contributions can only be made when campaign is active"
    );

    let metadata = SecretVarType::Contribution {
        owner: context.sender,
        timestamp: context.block_production_time,
    };

    let input_def = ZkInputDef::with_metadata(None, metadata);
    (state, vec![], input_def)
}

/// Token transfer
#[action(shortname = 0x07, zk = true)]
fn contribute_tokens(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
    amount: u32,
) -> (ContractState, Vec<EventGroup>) {
    assert_eq!(
        state.status,
        CampaignStatus::Active {},
        "Contributions can only be made when campaign is active"
    );

    assert!(amount > 0, "Contribution amount must be greater than 0");

    let user_contribution_count = zk_state.secret_variables.iter()
        .filter(|(_, var)| matches!(&var.metadata, SecretVarType::Contribution { owner, .. } if *owner == context.sender))
        .count();

    assert!(
        user_contribution_count > 0,
        "Must create contribution commitment first"
    );

    let wei_amount = token_units_to_wei(amount);

    let mut event_group = EventGroup::builder();

    event_group
        .call(state.token_address, Shortname::from_u32(0x03))
        .argument(context.sender)
        .argument(context.contract_address)
        .argument(wei_amount)
        .done();

    event_group
        .with_callback(ShortnameCallback::from_u32(CONTRIBUTION_CALLBACK_SHORTNAME))
        .argument(amount)
        .done();

    (state, vec![event_group.build()])
}

/// Callback
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
    (state, vec![], vec![])
}

/// End campaign - Now creates 3 ZK variables for privacy-preserving withdrawal
#[action(shortname = 0x01, zk = true)]
fn end_campaign(
    context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    assert_eq!(
        context.sender, state.owner,
        "Only owner can end the campaign"
    );
    assert_eq!(
        state.status,
        CampaignStatus::Active {},
        "Campaign can only be ended from Active state"
    );
    assert_eq!(
        zk_state.calculation_state,
        CalculationStatus::Waiting,
        "Computation must start from Waiting state"
    );

    let contributions = zk_state
        .secret_variables
        .iter()
        .filter(|(_, var)| matches!(var.metadata, SecretVarType::Contribution { .. }))
        .count();

    let num_contributors = contributions as u32;
    state.status = CampaignStatus::Computing {};
    state.num_contributors = Some(num_contributors);

    if contributions == 0 {
        // No contributions, campaign automatically fails
        state.status = CampaignStatus::Completed {};
        state.is_successful = false;
        state.total_raised = None;
        return (state, vec![], vec![]);
    }

    let function_shortname = ShortnameZkComputation::from_u32(ZK_THRESHOLD_CHECK_SHORTNAME);
    let on_complete_hook = Some(ShortnameZkComputeComplete::from_u32(
        THRESHOLD_CHECK_COMPLETE_SHORTNAME,
    ));

    // Create 3 output variables for privacy-preserving withdrawal
    let output_metadata = vec![
        SecretVarType::ThresholdCheckResult { _placeholder: 0 }, // Always revealed
        SecretVarType::ConditionalTotal { _placeholder: 0 }, // Public display (only if successful)
        SecretVarType::ActualTotal { _placeholder: 0 }, // Private withdrawal (always available to owner)
    ];

    let input_arguments = vec![state.funding_target];

    let computation_change = ZkStateChange::start_computation_with_inputs(
        function_shortname,
        output_metadata,
        input_arguments,
        on_complete_hook,
    );

    (state, vec![], vec![computation_change])
}

/// Computation complete - Now handles 3 variables
#[zk_on_compute_complete(shortname = 0x42)]
fn threshold_check_complete(
    _context: ContractContext,
    mut state: ContractState,
    _zk_state: ZkState<SecretVarType>,
    output_variables: Vec<SecretVarId>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    if output_variables.len() >= 3 {
        // output_variables[0] = ThresholdCheckResult (1 if met, 0 if not)
        // output_variables[1] = ConditionalTotal (total if met, 0 if not) - for public display
        // output_variables[2] = ActualTotal (always real total) - for owner withdrawal

        state.balance_tracker_id = Some(output_variables[1]); // Public display
        state.withdrawal_tracker_id = Some(output_variables[2]); // Private withdrawal

        // Always reveal the threshold result (whether target was met)
        (
            state,
            vec![],
            vec![ZkStateChange::OpenVariables {
                variables: vec![output_variables[0]], // Reveal threshold result
            }],
        )
    } else {
        state.status = CampaignStatus::Completed {};
        state.is_successful = false;
        state.total_raised = None;
        (state, vec![], vec![])
    }
}

/// Handle revelations - Enhanced for privacy-preserving withdrawal
#[zk_on_variables_opened]
fn handle_opened_variables(
    _context: ContractContext,
    mut state: ContractState,
    zk_state: ZkState<SecretVarType>,
    opened_variables: Vec<SecretVarId>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    if opened_variables.is_empty() {
        return (state, vec![], vec![]);
    }

    let opened_variable = zk_state.get_variable(opened_variables[0]).unwrap();
    let variable_id = opened_variables[0];

    if matches!(state.status, CampaignStatus::Computing {}) {
        // First revelation: threshold check result
        if let Some(threshold_data) = &opened_variable.data {
            if threshold_data.len() >= 4 {
                let threshold_bytes: [u8; 4] = threshold_data[0..4].try_into().unwrap_or([0u8; 4]);
                let threshold_met = u32::from_le_bytes(threshold_bytes);

                state.status = CampaignStatus::Completed {};

                if threshold_met == 1 {
                    // Threshold was met - campaign successful
                    state.is_successful = true;

                    // Reveal the conditional total for public display
                    if let Some(balance_tracker_id) = state.balance_tracker_id {
                        return (
                            state,
                            vec![],
                            vec![ZkStateChange::OpenVariables {
                                variables: vec![balance_tracker_id],
                            }],
                        );
                    }
                } else {
                    // Threshold not met - campaign failed
                    state.is_successful = false;
                    state.total_raised = None; // Keep public total hidden
                }
            }
        }

        return (state, vec![], vec![]);
    }

    // Check if this is the conditional total being revealed (for public display)
    if let Some(balance_tracker_id) = state.balance_tracker_id {
        if variable_id == balance_tracker_id {
            if let Some(total_data) = &opened_variable.data {
                if total_data.len() >= 4 {
                    let total_bytes: [u8; 4] = total_data[0..4].try_into().unwrap_or([0u8; 4]);
                    let total_amount = u32::from_le_bytes(total_bytes);

                    // Set public total (will be 0 if campaign failed, real total if successful)
                    state.total_raised = Some(total_amount);
                }
            }
            return (state, vec![], vec![]);
        }
    }

    // Check if this is the actual total being revealed (for withdrawal)
    if let Some(withdrawal_tracker_id) = state.withdrawal_tracker_id {
        if variable_id == withdrawal_tracker_id && state.funds_withdrawn {
            if let Some(withdrawal_data) = &opened_variable.data {
                if withdrawal_data.len() >= 4 {
                    let amount_bytes: [u8; 4] =
                        withdrawal_data[0..4].try_into().unwrap_or([0u8; 4]);
                    let tokens_to_withdraw = u32::from_le_bytes(amount_bytes);

                    if tokens_to_withdraw > 0 {
                        let withdraw_amount_wei = token_units_to_wei(tokens_to_withdraw);

                        let mut event_group = EventGroup::builder();
                        event_group
                            .call(state.token_address, Shortname::from_u32(0x01))
                            .argument(state.owner)
                            .argument(withdraw_amount_wei)
                            .done();

                        return (state, vec![event_group.build()], vec![]);
                    }
                }
            }
        }
    }

    (state, vec![], vec![])
}

/// Withdraw funds - Now uses separate withdrawal tracker for privacy
#[action(shortname = 0x04, zk = true)]
fn withdraw_funds(
    context: ContractContext,
    mut state: ContractState,
    _zk_state: ZkState<SecretVarType>,
) -> (ContractState, Vec<EventGroup>, Vec<ZkStateChange>) {
    assert_eq!(
        context.sender, state.owner,
        "Only the owner can withdraw funds"
    );
    assert_eq!(
        state.status,
        CampaignStatus::Completed {},
        "Campaign must be completed"
    );
    assert!(!state.funds_withdrawn, "Funds have already been withdrawn");

    // REMOVED: No longer require campaign to be successful for withdrawal
    // Owner can withdraw even from failed campaigns (but amount stays private from public)

    let withdrawal_tracker_id = state
        .withdrawal_tracker_id
        .expect("Withdrawal tracker should exist after campaign completion");

    state.funds_withdrawn = true;

    // Open the actual total (private to owner, not revealed to public)
    (
        state,
        vec![],
        vec![ZkStateChange::OpenVariables {
            variables: vec![withdrawal_tracker_id],
        }],
    )
}
