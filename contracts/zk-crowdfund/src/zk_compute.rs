use pbc_zk::*;

// FIXED: Only one variable type now
const CONTRIBUTION_AND_TOKENS_VARIABLE_KIND: u8 = 0u8;

/// FIXED: Sum all contribution amounts (ZK computation works with single variable type)
#[zk_compute(shortname = 0x61)]
pub fn sum_actual_token_balances() -> Sbu32 {
    let mut total_contributions: Sbu32 = Sbu32::from(0u32);

    // Sum ALL ContributionAndTokens variables
    // Since we only create these after successful token transfers, they all represent real contributions
    for variable_id in secret_variable_ids() {
        // Check if this is a CONTRIBUTION_AND_TOKENS variable
        if load_metadata::<u8>(variable_id) == CONTRIBUTION_AND_TOKENS_VARIABLE_KIND {
            let contribution_amount: Sbu32 = load_sbi::<Sbu32>(variable_id);
            total_contributions = total_contributions + contribution_amount;
        }
    }
    
    total_contributions
}