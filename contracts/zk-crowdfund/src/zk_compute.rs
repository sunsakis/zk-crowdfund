use pbc_zk::*;

// Variable type constants
const CONTRIBUTION_VARIABLE_KIND: u8 = 0u8;

/// ZK computation that receives funding target as public input
/// and compares it against the sum of private contributions
/// Returns (threshold_met, conditional_total) - exactly 2 variables
#[zk_compute(shortname = 0x61)]
pub fn threshold_check_and_conditional_reveal(funding_target: u32) -> (Sbu32, Sbu32) {
    // Convert the public input u32 to Sbu32 for ZK operations
    let target_sbu32 = Sbu32::from(funding_target);

    // Step 1: Sum all contribution variables
    let mut total_contributions: Sbu32 = Sbu32::from(0u32);

    for variable_id in secret_variable_ids() {
        let metadata_kind = load_metadata::<u8>(variable_id);

        if metadata_kind == CONTRIBUTION_VARIABLE_KIND {
            let contribution_amount: Sbu32 = load_sbi::<Sbu32>(variable_id);
            total_contributions = total_contributions + contribution_amount;
        }
    }

    // Step 2: Check if total meets the funding target (passed as public input)
    let meets_threshold = total_contributions >= target_sbu32;

    let threshold_met: Sbu32 = if meets_threshold {
        Sbu32::from(1u32) // Threshold met
    } else {
        Sbu32::from(0u32) // Threshold not met
    };

    // Step 3: Conditional revelation logic
    // Only reveal total if threshold is met, otherwise return 0
    let conditional_total: Sbu32 = if meets_threshold {
        total_contributions
    } else {
        Sbu32::from(0u32) // Keep total hidden if threshold not met
    };

    // Return exactly 2 results:
    // 1. Whether threshold was met (1 = yes, 0 = no)
    // 2. Total contributions if threshold met, 0 if not met
    (threshold_met, conditional_total)
}
