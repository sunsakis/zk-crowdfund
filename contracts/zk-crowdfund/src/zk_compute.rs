use pbc_zk::*;

// Variable type constants
const CONTRIBUTION_VARIABLE_KIND: u8 = 0u8;
const FUNDING_TARGET_VARIABLE_KIND: u8 = 4u8;

/// ZK computation that reads the ACTUAL funding target from secret variables
/// This will correctly compare contributions vs the real funding target from deployment
/// Returns (threshold_met, conditional_total) - exactly 2 variables
#[zk_compute(shortname = 0x61)]
pub fn threshold_check_and_conditional_reveal() -> (Sbu32, Sbu32) {
    
    // Step 1: Find the ACTUAL funding target from secret variables
    let mut funding_target: Sbu32 = Sbu32::from(0u32);
    let mut target_found = false;
    
    // The funding target was created as a ZK variable by setup_funding_target
    for variable_id in secret_variable_ids() {
        let metadata_kind = load_metadata::<u8>(variable_id);
        
        if metadata_kind == FUNDING_TARGET_VARIABLE_KIND && !target_found {
            funding_target = load_sbi::<Sbu32>(variable_id);
            target_found = true;
            break; // Found the target, don't need to keep looking
        }
    }
    
    // Step 2: Sum all contributions
    let mut total_contributions: Sbu32 = Sbu32::from(0u32);
    
    for variable_id in secret_variable_ids() {
        let metadata_kind = load_metadata::<u8>(variable_id);
        
        if metadata_kind == CONTRIBUTION_VARIABLE_KIND {
            let contribution_amount: Sbu32 = load_sbi::<Sbu32>(variable_id);
            total_contributions = total_contributions + contribution_amount;
        }
    }
    
    // Step 3: Ensure we found the funding target
    if !target_found {
        // This should not happen - indicates setup_funding_target wasn't called
        return (Sbu32::from(0u32), Sbu32::from(0u32));
    }
    
    let meets_threshold = total_contributions >= funding_target;
    
    let threshold_met: Sbu32 = if meets_threshold {
        Sbu32::from(1u32) // Threshold met
    } else {
        Sbu32::from(0u32) // Threshold not met
    };
    
    // Step 5: Conditional revelation logic
    let conditional_total: Sbu32 = if meets_threshold {
        total_contributions
    } else {
        Sbu32::from(0u32)
    };
    
    // Return exactly 2 results:
    (threshold_met, conditional_total)
}