// Copyright (c) Daniel Porteous
// SPDX-License-Identifier: Apache-2.0

//! See the README for more information about how this tontine module works.

module addr::tontine {
    use std::error;
    use std::option::{Self, Option};
    use std::signer;
    use std::vector;
    use std::timestamp::now_seconds;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_std::simple_map::{Self, SimpleMap};

    /// Used when the caller tries to use a function that requires a TontineStore to
    /// exist on their account but it does not yet exist.
    const E_NOT_INITIALIZED: u64 = 1;

    /// The `members` list was empty.
    const E_CREATION_memberS_EMPTY: u64 = 2;

    /// `per_member_amount_octa` was zero.
    const E_CREATION_PER_MEMBER_AMOUNT_ZERO: u64 = 3;

    /// `check_in_frequency_secs` was out of the accepted range.
    const E_CREATION_CHECK_IN_FREQUENCY_OUT_OF_RANGE: u64 = 4;

    /// `claim_window_secs` was too small.
    const E_CREATION_CLAIM_WINDOW_TOO_SMALL: u64 = 5;

    /// Tried to interact with an account with no TontineStore.
    const E_TONTINE_STORE_NOT_FOUND: u64 = 6;

    /// Tried to get a Tontine from a TontineStore but there was nothing found with
    /// the requested index.
    const E_TONTINE_NOT_FOUND: u64 = 7;

    /// Tried to perform an action but the given member is not in the tontine.
    const E_MEMBER_NOT_IN_TONTINE: u64 = 8;

    #[test_only]
    /// Used for assertions in tests.
    const E_TEST_FAILURE: u64 = 100;

    /*
    ** Codes representing the overall status of a tontine.
    */

    /// The tontine has been created and is awaiting contributions.
    const OVERALL_STATUS_STAGING: u8 = 0;

    /// The tontine has been cancelled while in OVERALL_STATUS_STAGING.
    /// This happens either if the creator withdraws from the tontine.
    const OVERALL_STATUS_CANCELLED: u8 = 1;

    /// The final contribution has been made so the tontine can now be locked.
    const OVERALL_STATUS_CAN_BE_LOCKED: u8 = 2;

    /// The tontine is locked.
    const OVERALL_STATUS_LOCKED: u8 = 3;

    /// All parties but one have failed to check in within the window, so the
    /// remaining party may claim the funds.
    const OVERALL_STATUS_FUNDS_CLAIMABLE: u8 = 4;

    /// The funds were claimed. This is a terminal state. From this point on the
    /// tontine can be deleted.
    const OVERALL_STATUS_FUNDS_CLAIMED: u8 = 5;

    /// The final party failed to claim the funds within the claim window, so the
    /// fallback policy can be called.
    const OVERALL_STATUS_FUNDS_NEVER_CLAIMED: u8 = 6;

    /// The fallback policy was invoked. This is a terminal state. From this point on
    /// the tontine can be deleted.
    const OVERALL_STATUS_FALLBACK_EXECUTED: u8 = 7;

    /*
    ** Codes representing the status of members within a tontine.
    */

    /// The member needs to contribute funds.
    const MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS: u8 = 0;

    /// The member must reconfirm their intent to be in the tontine.
    const MEMBER_STATUS_MUST_RECONFIRM: u8 = 1;

    /// The member has contributed funds and reconfirmed if necessary, they are now
    /// just waiting for the tontine to be locked.
    const MEMBER_STATUS_READY: u8 = 2;

    /// The member has so far checked in every time within the check in window and is
    /// therefore still in the running for the funds.
    const MEMBER_STATUS_STILL_ELIGIBLE: u8 = 3;

    /// The member has failed to check in within the check in window and will therefore
    /// never be able to claim the funds.
    const MEMBER_STATUS_INELIGIBLE: u8 = 4;

    /// The member is the last person standing and can claim the funds.
    const MEMBER_STATUS_CAN_CLAIM_FUNDS: u8 = 5;

    /// The member was the last person standing and claimed the funds.
    const MEMBER_STATUS_CLAIMED_FUNDS: u8 = 6;

    /// The member was the last person standing but failed to claim the funds.
    const MEMBER_STATUS_NEVER_CLAIMED_FUNDS: u8 = 7;

    /// todo
    struct Tontine has store {
        /// The parameters used to configure initial creation of the tontine.
        config: TontineConfig,

        /// The time (unixtime in secs) at which the tontine was created.
        creation_time_secs: u64,

        /// The contributions from each member.
        // TODO: Besides using the immutable upgrade policy, what is to stop me from
        // adding an extension to this Move module that lets me withdraw all the funds?
        contributions: SimpleMap<address, Coin<AptosCoin>>,

        /// Any members who need to reconfirm membership in the tontine following a
        /// membership or configuration change.
        reconfirmation_required: vector<address>,

        /// The time (unixtime in secs) at which the tontine was locked. This will be
        /// zero until the tontine is locked.
        locked_time_secs: u64,

        /// The last time (unixtime in secs) each member of the tontine checked in.
        /// This will be empty to begin with. Once the tontine is started, at that
        /// moment we add a check in for all members.
        last_check_in_times_secs: SimpleMap<address, u64>,

        /// The time (unixtime in secs) at which the funds in the tontine were claimed.
        /// This will be zero until that happens.
        // TODO: This could just be an event maybe.
        funds_claimed_secs: u64,

        /// The address of the member that claimed the funds. This will be None until
        /// a member claims the funds, and may be None forever if the last member
        /// standing fails to claim the funds and the tontine moves into fallback mode.q
        funds_claimed_by: Option<address>,

        /// True if the fallback policy was executed.
        fallback_executed: bool,
    }

    struct TontineConfig has store {
        /// Who (where identity is defined by account address) is party to the tontine.
        /// If the creator does not include their own address in this, we will add it.
        members: vector<address>,

        /// How much each member must contribute to the tontine.
        per_member_amount_octa: u64,

        /// How often, in seconds, each member must check-in to prove that they're
        /// still in control of their account.
        check_in_frequency_secs: u64,

        /// When there is only one member left standing, this is the additional time
        /// beyond the end of their next check in window in which they may claim the
        /// funds in the tontine.
        grace_period_secs: u64,

        /// What happens if the last-standing member of the tontine fails to claim the
        /// funds within the claim window.
        fallback_policy: TontineFallbackPolicy
    }

    struct TontineFallbackPolicy has store {

    }

    struct TontineStore has key {
        /// This contains all the tontines the user has created.
        tontines: SimpleMap<u32, Tontine>,

        /// Here we track the next index to use in the above map.
        next_index: u32,
    }

    /// Initialize the list to the caller's account.
    // TODO: Use the TontineConfig struct directly when that is possible.
    // TODO: Look into some kind of set for participiants instead of a vec.
    // TODO: Find a way to assert members has no duplicates.
    // No fallback policy for now, not yet implemented. Look into enums.
    public entry fun create_tontine(
        creator: &signer,
        members: vector<address>,
        check_in_frequency_secs: u64,
        grace_period_secs: u64,
        per_member_amount_octa: u64,
    ) acquires TontineStore {
        // Assert some details about the tontine parameters.
        assert!(!vector::is_empty(&members), error::invalid_argument(E_CREATION_memberS_EMPTY));
        assert!(check_in_frequency_secs < 60, error::invalid_argument(E_CREATION_CHECK_IN_FREQUENCY_OUT_OF_RANGE));
        assert!(check_in_frequency_secs > 60 * 60 * 24 * 365, error::invalid_argument(E_CREATION_CHECK_IN_FREQUENCY_OUT_OF_RANGE));
        assert!(grace_period_secs > 60 * 60 * 24 * 30, error::invalid_argument(E_CREATION_CLAIM_WINDOW_TOO_SMALL));
        assert!(per_member_amount_octa > 0, error::invalid_argument(E_CREATION_PER_MEMBER_AMOUNT_ZERO));

        let creator_addr = signer::address_of(creator);

        // Create the TontineStore if necessary.
        if (!exists<TontineStore>(creator_addr)) {
            let tontine_store = TontineStore { tontines: simple_map::create(), next_index: 0 };
            move_to(creator, tontine_store);
        };

        // Add the creator's address to `members` if necessary.
        if (!vector::contains(&members, &creator_addr)) {
            vector::push_back(&mut members, creator_addr);
        };

        // Build the TontineConfig. We modify some of the arguments above (e.g.
        // `members`) so this isn't a direct mapping of the inputs.
        let tontine_config = TontineConfig {
            members: members,
            per_member_amount_octa: per_member_amount_octa,
            check_in_frequency_secs: check_in_frequency_secs,
            grace_period_secs: grace_period_secs,
            fallback_policy: TontineFallbackPolicy {},
        };

        // Create the Tontine.
        let tontine = Tontine {
            config: tontine_config,
            creation_time_secs: now_seconds(),
            contributions: simple_map::create(),
            reconfirmation_required: vector::empty(),
            locked_time_secs: 0,
            last_check_in_times_secs: simple_map::create(),
            funds_claimed_secs: 0,
            funds_claimed_by: option::none(),
            fallback_executed: false,
        };

        // Add the Tontine into the TontineStore.
        let tontine_store = borrow_global_mut<TontineStore>(creator_addr);

        simple_map::add(&mut tontine_store.tontines, tontine_store.next_index, tontine);
        tontine_store.next_index = tontine_store.next_index + 1;
    }

    public entry fun contribute(
        contributor: &signer,
        creator: address,
        index: u32,
        contribution_amount_octa: u64,
    ) acquires TontineStore {
        // Assert a TontineStore exists on the creator's account.
        assert!(exists<TontineStore>(creator), error::invalid_state(E_TONTINE_STORE_NOT_FOUND));

        // Get the tontine.
        let tontine_store = borrow_global_mut<TontineStore>(creator);
        assert!(simple_map::contains_key(&tontine_store.tontines, &index), error::invalid_state(E_TONTINE_NOT_FOUND));
        let tontine = simple_map::borrow_mut(&mut tontine_store.tontines, &index);

        // Withdraw the contribution from the contributor's account.
        let contribution = coin::withdraw<AptosCoin>(contributor, contribution_amount_octa);

        let contributor_addr = signer::address_of(contributor);

        if (simple_map::contains_key(&tontine.contributions, &contributor_addr)) {
            // This contributor has already contributed, merge this new contribution
            // with their existing one.
            let existing_contribution = simple_map::borrow_mut(&mut tontine.contributions, &contributor_addr);
            coin::merge(existing_contribution, contribution);
        } else {
            // The contributor has not contributed yet.
            simple_map::add(&mut tontine.contributions, contributor_addr, contribution);
        }

        // todo, consider emitting event.
    }

    #[view]
    /// If the creator leaves a tontine we consider it cancelled and do not allow any
    /// further actions (including them rejoining) besides withdrawing funds.
    fun is_cancelled(creator: address, index: u32): bool acquires TontineStore {
        // Assert a TontineStore exists on the creator's account.
        assert!(exists<TontineStore>(creator), error::invalid_state(E_TONTINE_STORE_NOT_FOUND));

        // Get the tontine.
        let tontine_store = borrow_global_mut<TontineStore>(creator);
        assert!(simple_map::contains_key(&tontine_store.tontines, &index), error::invalid_state(E_TONTINE_NOT_FOUND));
        let tontine = simple_map::borrow(&mut tontine_store.tontines, &index);

        is_cancelled_inner(tontine, &creator)
    }

    /// If the creator leaves a tontine we consider it cancelled and do not allow any
    /// further actions (including them rejoining) besides withdrawing funds.
    fun is_cancelled_inner(tontine: &Tontine, creator: &address): bool {
        vector::contains(&tontine.config.members, creator)
    }

    /// Get the time a member last checked in.
    fun get_last_check_in_time_secs(tontine: &Tontine, member: &address): u64 {
        if (!simple_map::contains_key(&tontine.last_check_in_times_secs, member)) {
            // If the member has never explicitly checked in, the implied last check in
            // is the time the tontine was locked.
            tontine.locked_time_secs
        } else {
            // TODO: Originally I had it that this function returned an owned value, but
            // I couldn't figure out how to take a ref like &u64 and turn it into a u64.
            *simple_map::borrow(&tontine.last_check_in_times_secs, member)
        }
    }


    /// Get the statuses of the members of the tontine.
    fun get_member_statuses_inner(tontine: &Tontine): SimpleMap<address, u8> {
        let statuses: SimpleMap<address, u8> = simple_map::create();

        let now = now_seconds();

        let funds_claimed = option::is_some(&tontine.funds_claimed_by);
        let tontine_locked = tontine.locked_time_secs > 0;

        // Some data we collect as we build the statuses.
        let num_still_eligible = 0;
        let most_recent_check_in_address = vector::borrow(&tontine.config.members, 0);
        let most_recent_check_in_time_secs = 0;

        let i = 0;
        let len = vector::length(&tontine.config.members);
        while (i < len) {
            let member = vector::borrow(&tontine.config.members, i);

            let status = if (funds_claimed) {
                // The funds were claimed.
                let claimed_by = option::borrow(&tontine.funds_claimed_by);
                if (member == claimed_by) {
                    // The member claimed the funds.
                    MEMBER_STATUS_CLAIMED_FUNDS
                } else {
                    // Everyone else is ineligible.
                    MEMBER_STATUS_INELIGIBLE
                }
            } else if (tontine_locked) {
                // The tontine is locked. It might even be finished.
                let last_check_in_time_secs = get_last_check_in_time_secs(tontine, member);
                // Keep track of who checked in most recently.
                if (last_check_in_time_secs > most_recent_check_in_time_secs) {
                    most_recent_check_in_time_secs = last_check_in_time_secs;
                    most_recent_check_in_address = member;
                };
                if (now > last_check_in_time_secs + tontine.config.check_in_frequency_secs) {
                    // The member failed to check in.
                    MEMBER_STATUS_INELIGIBLE
                } else {
                    // The member has been checking in at the required frequency.
                    num_still_eligible = num_still_eligible + 1;
                    MEMBER_STATUS_STILL_ELIGIBLE
                }
            } else {
                // The tontine is not locked yet.
                if (!simple_map::contains_key(&tontine.contributions, member)) {
                    // The member has not contributed funds yet.
                    MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS
                } else {
                    let contributed_amount = coin::value(simple_map::borrow(&tontine.contributions, member));
                    if (contributed_amount < tontine.config.per_member_amount_octa) {
                        // The member has contributed funds, but not yet enough.
                        MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS
                    } else {
                        if (vector::contains(&tontine.reconfirmation_required, member)) {
                            // The member has contributed the required funds but we're
                            // waiting for them to reconfirm their membership intent.
                            MEMBER_STATUS_MUST_RECONFIRM
                        } else {
                            // The member has contributed the required funds and has no
                            // reconfirmation obligations.
                            MEMBER_STATUS_READY
                        }
                    }
                }
            };

            simple_map::add(&mut statuses, *member, status);
            i = i + 1;
        };

        if (!funds_claimed && tontine_locked) {
            // The tontine is ongoing or entered fallback mode.
            if (num_still_eligible == 1) {
                // Only one person is still eligible, mark them as being able to claim
                // the funds.
                simple_map::upsert(&mut statuses, *most_recent_check_in_address, MEMBER_STATUS_CAN_CLAIM_FUNDS);
            } else if (num_still_eligible == 0) {
                // No one is eligible to claim the funds anymore, indicate that the
                // most recent to check in could have claimed the funds but didn't.
                simple_map::upsert(&mut statuses, *most_recent_check_in_address, MEMBER_STATUS_NEVER_CLAIMED_FUNDS);
            }

        };

        statuses
    }

    #[view]
    /// Get the status of a member of the tontine.
    fun get_member_status(creator: address, index: u32, member: address): u8 acquires TontineStore {
        // Assert a TontineStore exists on the creator's account.
        assert!(exists<TontineStore>(creator), error::invalid_state(E_TONTINE_STORE_NOT_FOUND));

        // Get the tontine.
        let tontine_store = borrow_global_mut<TontineStore>(creator);
        assert!(simple_map::contains_key(&tontine_store.tontines, &index), error::invalid_state(E_TONTINE_NOT_FOUND));
        let tontine = simple_map::borrow_mut(&mut tontine_store.tontines, &index);

        let statuses = get_member_statuses_inner(tontine);
        let (_, v) = simple_map::remove(&mut statuses, &member);
        v
    }

    #[view]
    /// Get the status of the tontine.
    fun get_overall_status(creator: address, index: u32): u8 acquires TontineStore {
        // Assert a TontineStore exists on the creator's account.
        assert!(exists<TontineStore>(creator), error::invalid_state(E_TONTINE_STORE_NOT_FOUND));

        // Get the tontine.
        let tontine_store = borrow_global_mut<TontineStore>(creator);
        assert!(simple_map::contains_key(&tontine_store.tontines, &index), error::invalid_state(E_TONTINE_NOT_FOUND));
        let tontine = simple_map::borrow_mut(&mut tontine_store.tontines, &index);

        if (is_cancelled_inner(tontine, &creator)) {
            return OVERALL_STATUS_CANCELLED
        };

        if (option::is_some(&tontine.funds_claimed_by)) {
            return OVERALL_STATUS_FUNDS_CLAIMED
        };

        if (tontine.fallback_executed) {
            return OVERALL_STATUS_FALLBACK_EXECUTED
        };

        let (_, statuses) = simple_map::to_vec_pair(get_member_statuses_inner(tontine));

        // Build up counts of relevant per member statuses.
        let num_members = vector::length(&tontine.config.members);
        let num_ready = 0;
        let a_member_can_claim_funds = false;
        let last_member_standing_never_claimed_funds = false;

        loop {
            if (vector::is_empty(&statuses)) {
                break
            };
            let status = vector::pop_back(&mut statuses);
            if (status == MEMBER_STATUS_READY) {
                num_ready = num_ready + 1;
            };
            if (status == MEMBER_STATUS_CAN_CLAIM_FUNDS) {
                a_member_can_claim_funds = true;
            };
            if (status == MEMBER_STATUS_NEVER_CLAIMED_FUNDS) {
                last_member_standing_never_claimed_funds = true;
            };
        };

        if (tontine.locked_time_secs == 0) {
            if (num_ready == num_members) {
                return OVERALL_STATUS_CAN_BE_LOCKED
            } else {
                return OVERALL_STATUS_STAGING
            }
        };

        if (last_member_standing_never_claimed_funds) {
            return OVERALL_STATUS_FUNDS_NEVER_CLAIMED
        };

        if (a_member_can_claim_funds) {
            return OVERALL_STATUS_FUNDS_CLAIMABLE
        };

        OVERALL_STATUS_LOCKED
    }
}
