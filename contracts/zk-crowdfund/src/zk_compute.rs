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

/// Compute the refund amount for a specific user.
/// The contract passes specific contribution variables through
/// the computation inputs.
///
/// ### Returns:
///
/// The sum of the user's contributions.
#[zk_compute(shortname = 0x62)]
pub fn compute_refund() -> Sbi32 {
    // Initialize state for user's total contribution
    let mut user_contribution: Sbi32 = Sbi32::from(0);

    // Sum all available secret variables
    // The contract will only pass in variables owned by the user
    // who is claiming the refund
    for variable_id in secret_variable_ids() {
        // Only count contribution variables (type 0)
        if load_metadata::<u8>(variable_id) == CONTRIBUTION_VARIABLE_KIND {
            let contribution_amount = load_sbi::<Sbi32>(variable_id);
            user_contribution = user_contribution + contribution_amount;
        }
    }

    user_contribution
}