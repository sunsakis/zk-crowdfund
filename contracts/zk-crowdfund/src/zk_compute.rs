use pbc_zk::*;

// Variable type constants - matching the contract discriminants
const CONTRIBUTION_VARIABLE_KIND: u8 = 0u8;
const FUNDING_TARGET_VARIABLE_KIND: u8 = 4u8;

/// Production-ready MPC threshold check with ACTUAL dynamic funding target
/// Now properly loads the funding target from secret variables
/// Returns (threshold_met, conditional_total) where:
/// - threshold_met: 1 if target reached, 0 if not (always revealed)
/// - conditional_total: actual total if threshold met, 0 if not (conditionally revealed)
#[zk_compute(shortname = 0x61)]
pub fn threshold_check_and_conditional_reveal() -> (Sbu32, Sbu32) {
    // Step 1: Sum all contributions and find the actual funding target
    let mut total_contributions: Sbu32 = Sbu32::from(0u32);
    let mut funding_target: Sbu32 = Sbu32::from(0u32);
    let mut target_found = false;
    
    // Process all secret variables
    for variable_id in secret_variable_ids() {
        let metadata_kind = load_metadata::<u8>(variable_id);
        
        if metadata_kind == CONTRIBUTION_VARIABLE_KIND {
            // Regular contribution - sum it up
            let contribution_amount: Sbu32 = load_sbi::<Sbu32>(variable_id);
            total_contributions = total_contributions + contribution_amount;
        } else if metadata_kind == FUNDING_TARGET_VARIABLE_KIND && !target_found {
            // ✅ CRITICAL FIX: Load the ACTUAL funding target from contract
            funding_target = load_sbi::<Sbu32>(variable_id);
            target_found = true;
        }
    }
    
    // Step 2: Ensure we found the funding target
    if !target_found {
        // This should not happen in production - indicates contract error
        // Return failure condition (threshold not met, total hidden)
        return (Sbu32::from(0u32), Sbu32::from(0u32));
    }
    
    // Step 3: Perform threshold check in MPC with ACTUAL values
    let meets_threshold = total_contributions >= funding_target;
    
    let threshold_met: Sbu32 = if meets_threshold {
        Sbu32::from(1u32) // Threshold met
    } else {
        Sbu32::from(0u32) // Threshold not met
    };
    
    // Step 4: Conditional revelation logic
    // If threshold met, return actual total; otherwise return 0
    let conditional_total: Sbu32 = if meets_threshold {
        total_contributions // Reveal actual total only if threshold met
    } else {
        Sbu32::from(0u32)   // Hide total by returning 0
    };
    
    // Return both results:
    // 1. threshold_met (1 or 0) - always revealed to determine success
    // 2. conditional_total - only meaningful if threshold_met == 1
    (threshold_met, conditional_total)
}