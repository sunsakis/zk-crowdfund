#![doc = include_str!("../README.md")]
#![allow(unused_variables)]

#[macro_use]
extern crate pbc_contract_codegen;
extern crate pbc_contract_common;
extern crate pbc_lib;

use pbc_contract_common::address::Address;
use pbc_contract_common::context::ContractContext;
use pbc_contract_common::events::EventGroup;
use read_write_rpc_derive::ReadWriteRPC;
use read_write_state_derive::ReadWriteState;
use create_type_spec_derive::CreateTypeSpec;
use std::convert::TryInto;

/// This contract's state
#[state]
struct ContractState {
    /// Admin address (can update parameters)
    admin: Address,
    /// List of crowdfunding campaigns created by this factory
    campaigns: Vec<CampaignInfo>,
}

/// Information about a deployed crowdfunding campaign
#[derive(ReadWriteState, ReadWriteRPC, Debug, Clone, CreateTypeSpec)]
pub struct CampaignInfo {
    /// Address of the crowdfunding contract
    address: Address,
    /// Owner of the campaign
    owner: Address,
    /// Title of the campaign
    title: String,
    /// Brief description of the campaign
    description: String,
    /// Creation timestamp
    creation_time: u64,
    /// Funding target amount
    target: u32,
    /// Deadline as timestamp
    deadline: u64,
}

/// Parameters for creating a new campaign
#[derive(ReadWriteRPC, CreateTypeSpec)]
struct CreateCampaignParams {
    title: String,
    description: String,
    category: String,
    image_url: Option<String>,
    funding_target: u32,
    deadline: u64,
}

/// Event data for campaign creation
#[derive(ReadWriteRPC)]
struct CreateCampaignEvent {
    owner: Address,
    title: String,
    description: String,
    category: String,
    image_url: Option<String>,
    funding_target: u32,
    deadline: u64,
}

/// Initializes contract
#[init]
fn initialize(ctx: ContractContext) -> ContractState {
    ContractState {
        admin: ctx.sender,
        campaigns: Vec::new(),
    }
}

/// Create a new crowdfunding campaign
#[action]
fn create_campaign(
    ctx: ContractContext,
    mut state: ContractState,
    params: CreateCampaignParams,
) -> (ContractState, Vec<EventGroup>) {
    // Validate parameters
    assert!(!params.title.is_empty(), "Title cannot be empty");
    assert!(!params.description.is_empty(), "Description cannot be empty");
    assert!(!params.category.is_empty(), "Category cannot be empty");
    assert!(params.funding_target > 0, "Funding target must be greater than 0");
    assert!(
        params.deadline > ctx.block_production_time.try_into().unwrap(),
        "Deadline must be in the future"
    );

    // Create deployment event for the node
    let create_event = CreateCampaignEvent {
        owner: ctx.sender,
        title: params.title.clone(),
        description: params.description.clone(),
        category: params.category.clone(),
        image_url: params.image_url.clone(),
        funding_target: params.funding_target,
        deadline: params.deadline,
    };

    // In a real implementation, this would create an event to deploy the contract
    // For now, we'll just add the campaign to our list
    let temp_info = CampaignInfo {
        address: ctx.sender, // This will be updated later with the actual contract address
        owner: ctx.sender,
        title: params.title,
        description: params.description,
        creation_time: ctx.block_production_time.try_into().unwrap(),
        target: params.funding_target,
        deadline: params.deadline,
    };

    state.campaigns.push(temp_info);
    
    // In production, you would send an event to a contract deployer service
    // For now, we'll return an empty event list since PBC doesn't directly support
    // contract creation from other contracts
    (state, vec![])
}

/// Register a deployed campaign
/// This would be called by the admin after deploying the campaign contract
#[action]
fn register_campaign(
    ctx: ContractContext,
    mut state: ContractState,
    campaign_address: Address,
    owner: Address,
    index: u32,
) -> ContractState {
    // Ensure only authorized callers can register campaigns
    assert!(
        ctx.sender == state.admin,
        "Only admin can register campaigns"
    );
    
    // Ensure the index is valid
    assert!(
        (index as usize) < state.campaigns.len(),
        "Invalid campaign index"
    );
    
    // Update the campaign address
    state.campaigns[index as usize].address = campaign_address;
    
    state
}

/// Get all campaigns
#[action(shortname = 0x01)]
fn get_campaigns(ctx: ContractContext, state: ContractState) -> Vec<CampaignInfo> {
    state.campaigns
}

/// Get campaigns owned by the sender
#[action(shortname = 0x02)]
fn get_my_campaigns(ctx: ContractContext, state: ContractState) -> Vec<CampaignInfo> {
    state.campaigns
        .iter()
        .filter(|campaign| campaign.owner == ctx.sender)
        .cloned()
        .collect()
}

/// Get campaign by address
#[action(shortname = 0x03)]
fn get_campaign_by_address(ctx: ContractContext, state: ContractState, address: Address) -> Option<CampaignInfo> {
    state.campaigns
        .iter()
        .find(|campaign| campaign.address == address)
        .cloned()
}