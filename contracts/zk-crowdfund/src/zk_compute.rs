use pbc_zk::*;

// Constants
#[allow(unused)]
const CONTRIBUTION_VARIABLE_KIND: u8 = 0u8;  // Matches SecretVarType::Contribution discriminant

/// Perform a zk computation on secret-shared data to sum all the secret contributions.
/// Returns the total sum of all contributions as Sbu32 (raw token units).
#[zk_compute(shortname = 0x61)]
pub fn sum_contributions() -> Sbu32 {
    // Initialize state with u32 (raw token units)
    let mut total_contributions: Sbu32 = Sbu32::from(0u32);

    // Sum each contribution
    for variable_id in secret_variable_ids() {
        // Check if this is a contribution variable by looking at metadata type
        if load_metadata::<u8>(variable_id) == CONTRIBUTION_VARIABLE_KIND {
            // Load and add the contribution amount as Sbu32 (raw token units)
            let contribution_amount: Sbu32 = load_sbi::<Sbu32>(variable_id);
            total_contributions = total_contributions + contribution_amount;
        }
    }
    
    total_contributions
}