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
        
        // Create bytes for transfer (0x01)
        let mut data = Vec::new();
        data.push(0x01);
        
        // Add recipient address
        data.extend_from_slice(to.as_bytes());
        
        // Add amount as u128 (16 bytes, little-endian)
        data.extend_from_slice(&amount.to_le_bytes());
        
        // Use event group binary_call method
        builder.binary_call(self.token_address, &data);
        
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
        
        // Create bytes for transfer_from (0x03)
        let mut data = Vec::new();
        data.push(0x03);
        
        // Add sender address
        data.extend_from_slice(from.as_bytes());
        
        // Add recipient address
        data.extend_from_slice(to.as_bytes());
        
        // Add amount as u128 (16 bytes, little-endian)
        data.extend_from_slice(&amount.to_le_bytes());
        
        // Use event group binary_call method
        builder.binary_call(self.token_address, &data);
        
        builder.build()
    }
    
    /// Approve tokens to be spent by another address
    /// Shortname 0x05 matches the MPC-20 standard
    pub fn approve(&self, context: &ContractContext, spender: Address, amount: u128) -> EventGroup {
        // Create event to call the token contract
        let mut builder = EventGroup::builder();
        
        // Create bytes for approve (0x05)
        let mut data = Vec::new();
        data.push(0x05);
        
        // Add spender address
        data.extend_from_slice(spender.as_bytes());
        
        // Add amount as u128 (16 bytes, little-endian)
        data.extend_from_slice(&amount.to_le_bytes());
        
        // Use event group binary_call method
        builder.binary_call(self.token_address, &data);
        
        builder.build()
    }
}