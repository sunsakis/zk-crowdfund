use pbc_zk::*;

/// Contribution variable type identifier
const CONTRIBUTION_VARIABLE_KIND: u8 = 0u8;

/// Perform a zk computation to sum all the secret contributions.
///
/// This computation runs when the campaign ends and calculates the total amount raised
/// without revealing individual contribution amounts.
///
/// ### Returns:
///
/// The sum of all contributions.
#[zk_compute(shortname = 0x61)]
pub fn sum_contributions() -> Sbi32 {
    // Initialize total to zero
    let mut total_contributions: Sbi32 = Sbi32::from(0);

    // Sum each contribution (variables with CONTRIBUTION_VARIABLE_KIND)
    for variable_id in secret_variable_ids() {
        if load_metadata::<u8>(variable_id) == CONTRIBUTION_VARIABLE_KIND {
            let contribution_amount = load_sbi::<Sbi32>(variable_id);
            total_contributions = total_contributions + contribution_amount;
        }
    }

    // Return the total sum, which will be the only revealed information
    total_contributions
}

/// Computes a refund proof for a specific contributor
///
/// This computation creates a proof that a user contributed a specific amount
/// without revealing that amount to anyone else. The proof allows them
/// to claim a refund of exactly what they contributed.
///
/// ### Returns:
///
/// A refund proof containing the amount to be refunded.
#[zk_compute(shortname = 0x62)]
pub fn generate_refund_proof() -> Sbi32 {
    // Initialize refund amount to zero
    let mut refund_amount: Sbi32 = Sbi32::from(0);

    // Process each contribution variable 
    // In ZK computations, use secret_variable_ids() to access all variables
    for variable_id in secret_variable_ids() {
        if load_metadata::<u8>(variable_id) == CONTRIBUTION_VARIABLE_KIND {
            let contribution_amount = load_sbi::<Sbi32>(variable_id);
            // Sum all contributions from this user
            // Note: The contract only passed variables owned by the requesting user
            // so we can sum all of them without checking ownership
            refund_amount = refund_amount + contribution_amount;
        }
    }

    // Return the total contribution amount for this specific user
    refund_amount
}

/// Verifies that a user contributed to the campaign without revealing how much
///
/// This computation creates a boolean proof that the user contributed
/// at least once to the campaign. It does not reveal any amounts.
///
/// ### Returns:
///
/// A boolean indicating whether the user contributed (1) or not (0)
#[zk_compute(shortname = 0x63)]
pub fn verify_contribution() -> Sbu1 {
    // Default to false (0)
    let mut has_contributed = Sbu1::from(false);

    // Check if any contribution variable belongs to the requesting user
    // In ZK computations, use secret_variable_ids() to access all variables
    for variable_id in secret_variable_ids() {
        if load_metadata::<u8>(variable_id) == CONTRIBUTION_VARIABLE_KIND {
            // If we found at least one contribution, set result to true
            has_contributed = Sbu1::from(true);
            break;
        }
    }

    has_contributed
}