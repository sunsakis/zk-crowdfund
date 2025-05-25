use pbc_zk::*;

// Constants - FIXED to only sum actual token balances
#[allow(unused)]
const CONTRIBUTION_VARIABLE_KIND: u8 = 0u8;  // ZK contribution commitment (not counted)
const TOKEN_BALANCE_VARIABLE_KIND: u8 = 1u8;  // Actual token balance (counted in sum)

/// FIXED: Perform a zk computation to sum only the actual token balances that were transferred
/// This prevents the deadlock bug by ensuring we only count tokens that are actually in the contract
#[zk_compute(shortname = 0x61)]
pub fn sum_actual_token_balances() -> Sbu32 {
    // Initialize state with u32 (raw token units)
    let mut total_actual_tokens: Sbu32 = Sbu32::from(0u32);

    // Sum ONLY the TokenBalance variables (actual transferred tokens)
    // NOT the Contribution variables (which are just commitments)
    for variable_id in secret_variable_ids() {
        // Check if this is a TOKEN_BALANCE variable (actual transferred tokens)
        if load_metadata::<u8>(variable_id) == TOKEN_BALANCE_VARIABLE_KIND {
            // Load and add the actual token amount that was successfully transferred
            let actual_token_amount: Sbu32 = load_sbi::<Sbu32>(variable_id);
            total_actual_tokens = total_actual_tokens + actual_token_amount;
        }
    }
    
    total_actual_tokens
}