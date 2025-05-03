use pbc_contract_common::address::Address;
use pbc_contract_common::context::ContractContext;
use pbc_contract_common::events::EventGroup;

/// Interface for interacting with MPC-20 token contracts
pub struct MPC20TokenInterface {
    token_address: Address,
}

impl MPC20TokenInterface {
    /// Create a new MPC-20 token interface
    pub fn new(token_address: Address) -> Self {
        Self { token_address }
    }
    
    /// Transfer tokens from this contract to another address
    /// Shortname 0x01 matches the MPC-20 standard
    pub fn transfer(&self, context: &ContractContext, to: Address, amount: u128) -> EventGroup {
        // Create event to call the token contract
        let mut builder = EventGroup::builder();
        
        // Add shortname (0x01 for transfer)
        let mut shortname = Vec::with_capacity(1 + Address::LEN + 16);
        shortname.push(0x01);
        
        // Add recipient address
        let to_bytes = to.to_bytes();
        shortname.extend_from_slice(&to_bytes);
        
        // Add amount as u128 (16 bytes, little-endian)
        shortname.extend_from_slice(&amount.to_le_bytes());
        
        // Build the event
        builder = builder.binary_call(self.token_address, &shortname);
        builder.build()
    }
    
    /// Transfer tokens from one address to another (requires prior approval)
    /// Shortname 0x03 matches the MPC-20 standard
    pub fn transfer_from(
        &self,
        context: &ContractContext,
        from: Address,
        to: Address,
        amount: u128,
    ) -> EventGroup {
        // Create event to call the token contract
        let mut builder = EventGroup::builder();
        
        // Add shortname (0x03 for transfer_from)
        let mut shortname = Vec::with_capacity(1 + Address::LEN + Address::LEN + 16);
        shortname.push(0x03);
        
        // Add sender address
        let from_bytes = from.to_bytes();
        shortname.extend_from_slice(&from_bytes);
        
        // Add recipient address
        let to_bytes = to.to_bytes();
        shortname.extend_from_slice(&to_bytes);
        
        // Add amount as u128 (16 bytes, little-endian)
        shortname.extend_from_slice(&amount.to_le_bytes());
        
        // Build the event
        builder = builder.binary_call(self.token_address, &shortname);
        builder.build()
    }
    
    /// Approve tokens to be spent by another address
    /// Shortname 0x05 matches the MPC-20 standard
    pub fn approve(&self, context: &ContractContext, spender: Address, amount: u128) -> EventGroup {
        // Create event to call the token contract
        let mut builder = EventGroup::builder();
        
        // Add shortname (0x05 for approve)
        let mut shortname = Vec::with_capacity(1 + Address::LEN + 16);
        shortname.push(0x05);
        
        // Add spender address
        let spender_bytes = spender.to_bytes();
        shortname.extend_from_slice(&spender_bytes);
        
        // Add amount as u128 (16 bytes, little-endian)
        shortname.extend_from_slice(&amount.to_le_bytes());
        
        // Build the event
        builder = builder.binary_call(self.token_address, &shortname);
        builder.build()
    }
}