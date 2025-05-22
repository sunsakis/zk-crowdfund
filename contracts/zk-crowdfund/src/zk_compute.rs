use pbc_zk::*;

// Constants
#[allow(unused)]
const CONTRIBUTION_VARIABLE_KIND: u8 = 0u8;  // Matches SecretVarType::Contribution discriminant

/// Perform a zk computation on secret-shared data to sum all the secret contributions.
#[zk_compute(shortname = 0x61)]
pub fn sum_contributions() -> Sbi32 {
    // Initialize state
    let mut total_contributions: Sbi32 = Sbi32::from(0);

    // Sum each contribution
    for variable_id in secret_variable_ids() {
        // Check if this is a contribution variable by looking at metadata type
        if load_metadata::<u8>(variable_id) == CONTRIBUTION_VARIABLE_KIND {
            // Load and add the contribution amount
            let contribution_amount = load_sbi::<Sbi32>(variable_id);
            total_contributions = total_contributions + contribution_amount;
        }
    }
    
    total_contributions
}

/// Compute the refund amount for the remaining contribution variables.
/// This function processes ALL remaining contribution variables in the contract.
/// The contract must ensure only the requesting user's variables remain before calling this.
#[zk_compute(shortname = 0x62)]
pub fn compute_refund() -> Sbi32 {
    // Initialize refund amount
    let mut total_refund: Sbi32 = Sbi32::from(0);
    
    // Sum all remaining contribution variables
    for variable_id in secret_variable_ids() {
        // Check if this is a contribution variable
        if load_metadata::<u8>(variable_id) == CONTRIBUTION_VARIABLE_KIND {
            let contribution_amount = load_sbi::<Sbi32>(variable_id);
            total_refund = total_refund + contribution_amount;
        }
    }
    
    total_refund
}