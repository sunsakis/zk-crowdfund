use pbc_zk::*;

// Variable type constants
const CONTRIBUTION_VARIABLE_KIND: u8 = 0u8;

/// Privacy-preserving ZK computation with separate variables for public display and private withdrawal
/// Returns (threshold_met, conditional_total, actual_total) - exactly 3 variables
#[zk_compute(shortname = 0x61)]
pub fn threshold_check_with_privacy_preserving_withdrawal(
    funding_target: u32,
) -> (Sbu32, Sbu32, Sbu32) {
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

    // Step 2: Check if total meets the funding target
    let meets_threshold = total_contributions >= target_sbu32;

    let threshold_met: Sbu32 = if meets_threshold {
        Sbu32::from(1u32) // Threshold met
    } else {
        Sbu32::from(0u32) // Threshold not met
    };

    // Step 3: Conditional total for PUBLIC display
    // Only reveal total publicly if threshold is met, otherwise return 0
    let conditional_total: Sbu32 = if meets_threshold {
        total_contributions
    } else {
        Sbu32::from(0u32) // Keep total hidden from public if threshold not met
    };

    // Step 4: Actual total for PRIVATE withdrawal
    // Always available to owner for withdrawal, regardless of threshold
    let actual_total: Sbu32 = total_contributions;

    // Return exactly 3 results:
    // 1. Whether threshold was met (1 = yes, 0 = no) - ALWAYS revealed to public
    // 2. Conditional total - ONLY revealed to public if threshold met, 0 otherwise
    // 3. Actual total - ONLY revealed to owner for withdrawal, never shown to public
    (threshold_met, conditional_total, actual_total)
}
