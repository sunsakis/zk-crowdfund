use pbc_zk::*;

#[allow(unused)]
const CONTRIBUTION_VARIABLE_KIND: u8 = 0u8;

/// Perform a zk computation on secret-shared data to sum all the secret contributions.
///
/// ### Returns:
///
/// The sum of all contributions.
#[zk_compute(shortname = 0x61)]
pub fn sum_contributions() -> Sbi32 {
    // Initialize state
    let mut total_contributions: Sbi32 = Sbi32::from(0);

    // Sum each contribution
    for variable_id in secret_variable_ids() {
        if load_metadata::<u8>(variable_id) == CONTRIBUTION_VARIABLE_KIND {
            let contribution_amount = load_sbi::<Sbi32>(variable_id);
            total_contributions = total_contributions + contribution_amount;
        }
    }

    total_contributions
}

/// Compute the refund amount for a specific user
/// Using a simpler approach focused on summing all contributions
///
/// ### Returns:
///
/// The sum of the user's contributions.
#[zk_compute(shortname = 0x62)]
pub fn compute_refund() -> Sbi32 {
    // Just sum all contributions
    // (the contract filters them before starting computation)
    let mut total_refund: Sbi32 = Sbi32::from(0);
    
    for variable_id in secret_variable_ids() {
        // Add all available contributions
        let contribution_amount = load_sbi::<Sbi32>(variable_id);
        total_refund = total_refund + contribution_amount;
    }
    
    total_refund
}