// Copyright (c) Daniel Porteous
// SPDX-License-Identifier: Apache-2.0

//! See the README for more information about how this tontine module works.

module addr::tontine {
    use std::error;
    use std::option::{Self, Option};
    use std::signer;
    use std::vector;
    use std::timestamp::now_seconds;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::event::{Self, EventHandle};
    use aptos_std::object::{Self, Object};
    use aptos_std::simple_map::{Self, SimpleMap};

    #[test_only]
    use std::string;
    #[test_only]
    use std::timestamp;
    #[test_only]
    use aptos_framework::account;
    #[test_only]
    use aptos_framework::coin::MintCapability;
    //#[test_only]
    //use aptos_std::debug;

    /// The `invitees` list was empty.
    const E_CREATION_INVITEES_EMPTY: u64 = 2;

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

    /// Tried to perform an action but the given caller is not in the tontine.
    const E_CALLER_NOT_IN_TONTINE: u64 = 8;

    /// Tried to perform an action but the given tontine is cancelled.
    const E_TONTINE_CANCELLED: u64 = 9;

    /// Tried to perform an action that relies on the member having contributed, but
    /// they haven't done so yet.
    const E_MEMBER_HAS_NOT_CONTRIBUTED_YET: u64 = 10;

    /// Tried to lock the tontine but the conditions aren't yet met.
    const E_LOCK_CONDITIONS_NOT_MET: u64 = 11;

    /// Tried to perform an action but the given tontine is locked.
    const E_TONTINE_LOCKED: u64 = 12;

    /*
    ** Error codes corresponding to the overall status of a tontine. We use these when
    ** the tontine is one of these states and that state is invalid for the intended
    ** operation.
    */

    /// The tontine is in state OVERALL_STATUS_STAGING, which is invalid for this operation.
    const E_OVERALL_STATUS_IS_STAGING: u8 = 64;

    /// The tontine is in state OVERALL_STATUS_CANCELLED, which is invalid for this operation.
    const E_OVERALL_STATUS_IS_CANCELLED: u8 = 65;

    /// The tontine is in state OVERALL_STATUS_CAN_BE_LOCKED, which is invalid for this operation.
    const E_OVERALL_STATUS_IS_CAN_BE_LOCKED: u8 = 66;

    /// The tontine is in state OVERALL_STATUS_LOCKED, which is invalid for this operation.
    const E_OVERALL_STATUS_IS_LOCKED: u8 = 67;

    /// The tontine is in state OVERALL_STATUS_FUNDS_CLAIMABLE, which is invalid for this operation.
    const E_OVERALL_STATUS_IS_FUNDS_CLAIMABLE: u8 = 68;

    /// The tontine is in state OVERALL_STATUS_FUNDS_CLAIMED, which is invalid for this operation.
    const E_OVERALL_STATUS_IS_FUNDS_CLAIMED: u8 = 69;

    /// The tontine is in state OVERALL_STATUS_FUNDS_NEVER_CLAIMED, which is invalid for this operation.
    const E_OVERALL_STATUS_IS_FUNDS_NEVER_CLAIMED: u8 = 70;

    /// The tontine is in state OVERALL_STATUS_FALLBACK_EXECUTED, which is invalid for this operation.
    const E_OVERALL_STATUS_IS_FALLBACK_EXECUTED: u8 = 71;

    /*
    ** Codes representing the overall status of a tontine.
    */

    /// The tontine has been created and is awaiting contributions.
    const OVERALL_STATUS_STAGING: u8 = 64;

    /// The tontine has been cancelled while in OVERALL_STATUS_STAGING.
    /// This happens either if the creator withdraws from the tontine.
    const OVERALL_STATUS_CANCELLED: u8 = 65;

    /// The final contribution has been made so the tontine can now be locked.
    const OVERALL_STATUS_CAN_BE_LOCKED: u8 = 66;

    /// The tontine is locked.
    const OVERALL_STATUS_LOCKED: u8 = 67;

    /// All parties but one have failed to check in within the window, so the
    /// remaining party may claim the funds.
    const OVERALL_STATUS_FUNDS_CLAIMABLE: u8 = 68;

    /// The funds were claimed. This is a terminal state. From this point on the
    /// tontine can be deleted.
    const OVERALL_STATUS_FUNDS_CLAIMED: u8 = 69;

    /// The final party failed to claim the funds within the claim window, so the
    /// fallback policy can be called.
    const OVERALL_STATUS_FUNDS_NEVER_CLAIMED: u8 = 70;

    /// The fallback policy was invoked. This is a terminal state. From this point on
    /// the tontine can be deleted.
    const OVERALL_STATUS_FALLBACK_EXECUTED: u8 = 71;

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

    // TODO: Use a set for `reconfirmation_required` and `members`.

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    /// todo
    struct Tontine has key, store {
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
        /// standing fails to claim the funds and the tontine moves into fallback mode.
        funds_claimed_by: Option<address>,

        /// True if the fallback policy was executed.
        fallback_executed: bool,

        // Events emitted for various lifecycle events.
        tontine_created_events: EventHandle<TontineCreatedEvent>, // todo: this one might be unnecessary
        member_invited_events: EventHandle<MemberInvitedEvent>,
        member_removed_events: EventHandle<MemberRemovedEvent>,
        member_contributed_events: EventHandle<MemberContributedEvent>,
        member_withdrew_events: EventHandle<MemberWithdrewEvent>,
        member_left_events: EventHandle<MemberLeftEvent>,
        tontine_locked_events: EventHandle<TontineLockedEvent>,
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

    struct TontineCreatedEvent has store, drop {
        creator: address,
        object_address: address,
    }

    struct MemberInvitedEvent has store, drop {
        member: address,
    }

    struct MemberRemovedEvent has store, drop {
        member: address,
    }

    struct MemberContributedEvent has store, drop {
        member: address,
        amount_octa: u64,
    }

    struct MemberWithdrewEvent has store, drop {
        member: address,
        amount_octa: u64,
    }

    struct MemberLeftEvent has store, drop {
        member: address,
    }

    struct TontineLockedEvent has store, drop {}

    /// todo explain
    /// testing.
    // TODO: Use the TontineConfig struct directly when that is possible.
    // TODO: Look into some kind of set for participiants instead of a vec.
    // TODO: Find a way to assert members has no duplicates.
    // No fallback policy for now, not yet implemented. Look into enums.
    public entry fun create(
        creator: &signer,
        invitees: vector<address>,
        check_in_frequency_secs: u64,
        grace_period_secs: u64,
        per_member_amount_octa: u64,
    ) {
        create_(creator, invitees, check_in_frequency_secs, grace_period_secs, per_member_amount_octa);
    }

    /// This function is separate from the top level create function so we can use it
    /// tests. This is necessary because entry functions (correctly) cannot return
    /// anything but we need it to return the object with the tontine in it.
    fun create_(
        creator: &signer,
        invitees: vector<address>,
        check_in_frequency_secs: u64,
        grace_period_secs: u64,
        per_member_amount_octa: u64,
    ): Object<Tontine> {
        // Assert some details about the tontine parameters.
        assert!(!vector::is_empty(&invitees), error::invalid_argument(E_CREATION_INVITEES_EMPTY));
        assert!(check_in_frequency_secs > 60, error::invalid_argument(E_CREATION_CHECK_IN_FREQUENCY_OUT_OF_RANGE));
        assert!(check_in_frequency_secs < 60 * 60 * 24 * 365, error::invalid_argument(E_CREATION_CHECK_IN_FREQUENCY_OUT_OF_RANGE));
        assert!(grace_period_secs > 60 * 60 * 24, error::invalid_argument(E_CREATION_CLAIM_WINDOW_TOO_SMALL));
        assert!(grace_period_secs < 60 * 60 * 24 * 365, error::invalid_argument(E_CREATION_CLAIM_WINDOW_TOO_SMALL));
        assert!(per_member_amount_octa > 0, error::invalid_argument(E_CREATION_PER_MEMBER_AMOUNT_ZERO));

        let creator_addr = signer::address_of(creator);

        // Add the creator's address to `invitees` if necessary.
        if (!vector::contains(&invitees, &creator_addr)) {
            vector::push_back(&mut invitees, creator_addr);
        };

        // Create a new object.
        let constructor_ref = &object::create_object_from_account(creator);
        let object_signer = &object::generate_signer(constructor_ref);

        // Emit an event for each invitee.
        let member_invited_events = object::new_event_handle(object_signer);
        let len = vector::length(&invitees);
        let i = 0;
        while (i < len) {
            let invitee = *vector::borrow(&invitees, i);
            event::emit_event(&mut member_invited_events, MemberInvitedEvent {
                member: invitee,
            });
            i = i + 1;
        };

        // Build the TontineConfig. We modify some of the arguments above (e.g.
        // `invitees`) so this isn't a direct mapping of the inputs.
        let tontine_config = TontineConfig {
            members: invitees,
            per_member_amount_octa: per_member_amount_octa,
            check_in_frequency_secs: check_in_frequency_secs,
            grace_period_secs: grace_period_secs,
            fallback_policy: TontineFallbackPolicy {},
        };

        // Create the Tontine.
        let tontine_created_events = object::new_event_handle(object_signer);
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
            tontine_created_events,
            member_invited_events,
            member_removed_events: object::new_event_handle(object_signer),
            member_contributed_events: object::new_event_handle(object_signer),
            member_withdrew_events: object::new_event_handle(object_signer),
            member_left_events: object::new_event_handle(object_signer),
            tontine_locked_events: object::new_event_handle(object_signer),
        };

        // Emit an event so the creator of the Tontine and its location can be discovered.
        event::emit_event(&mut tontine.tontine_created_events, TontineCreatedEvent {
            creator: creator_addr,
            object_address: object::address_from_constructor_ref(constructor_ref),
        });

        move_to(object_signer, tontine);

        object::object_from_constructor_ref(constructor_ref)
    }

    public entry fun contribute(
        member: &signer,
        tontine: Object<Tontine>,
        contribution_amount_octa: u64,
    ) acquires Tontine {
        // Assert the tontine is in a valid state.
        let allowed = vector::empty();
        vector::push_back(&mut allowed, OVERALL_STATUS_STAGING);
        vector::push_back(&mut allowed, OVERALL_STATUS_CAN_BE_LOCKED);
        assert_overall_status(tontine, allowed);

        // Withdraw the contribution from the contributor's account.
        let contribution = coin::withdraw<AptosCoin>(member, contribution_amount_octa);

        let tontine_ = borrow_global_mut<Tontine>(object::object_address(&tontine));

        let member_addr = signer::address_of(member);

        if (simple_map::contains_key(&tontine_.contributions, &member_addr)) {
            // This contributor has already contributed, merge this new contribution
            // with their existing one.
            let existing_contribution = simple_map::borrow_mut(&mut tontine_.contributions, &member_addr);
            coin::merge(existing_contribution, contribution);
        } else {
            // The contributor has not contributed yet.
            simple_map::add(&mut tontine_.contributions, member_addr, contribution);
        };

        // Emit an event.
        event::emit_event(&mut tontine_.member_contributed_events, MemberContributedEvent {
            member: member_addr,
            amount_octa: contribution_amount_octa,
        });
    }

    public entry fun withdraw(
        member: &signer,
        tontine: Object<Tontine>,
        withdrawal_amount_octa: u64,
    ) acquires Tontine {
        // Assert the tontine is in a valid state.
        let allowed = vector::empty();
        vector::push_back(&mut allowed, OVERALL_STATUS_STAGING);
        vector::push_back(&mut allowed, OVERALL_STATUS_CAN_BE_LOCKED);
        vector::push_back(&mut allowed, OVERALL_STATUS_CANCELLED);
        assert_overall_status(tontine, allowed);

        let tontine_ = borrow_global_mut<Tontine>(object::object_address(&tontine));
        let member_addr = signer::address_of(member);

        // Assert the member has actually contributed.
        assert!(simple_map::contains_key(&tontine_.contributions, &member_addr), error::invalid_state(E_MEMBER_HAS_NOT_CONTRIBUTED_YET));

        let (member_addr, contribution) = simple_map::remove(&mut tontine_.contributions, &member_addr);
        let withdrawal = coin::extract<AptosCoin>(&mut contribution, withdrawal_amount_octa);
        coin::deposit<AptosCoin>(member_addr, withdrawal);

        if (coin::value(&contribution) == 0) {
            coin::destroy_zero(contribution);
        } else {
            simple_map::add(&mut tontine_.contributions, member_addr, contribution);
        };

        // Emit an event.
        event::emit_event(&mut tontine_.member_withdrew_events, MemberWithdrewEvent {
            member: member_addr,
            amount_octa: withdrawal_amount_octa,
        });
    }

    /// Leave a tontine. If the caller has funds in the tontine, they will be returned
    /// to them.
    public entry fun leave(
        member: &signer,
        tontine: Object<Tontine>,
    ) acquires Tontine {
        let member_addr = signer::address_of(member);
        let tontine_ = borrow_global_mut<Tontine>(object::object_address(&tontine));

        // Leave the tontine.
        let (in_tontine, i) = vector::index_of(&tontine_.config.members, &member_addr);
        assert!(in_tontine, error::invalid_state(E_CALLER_NOT_IN_TONTINE));
        vector::remove(&mut tontine_.config.members, i);

        // Emit an event.
        event::emit_event(&mut tontine_.member_left_events, MemberLeftEvent {
            member: member_addr,
        });

        // Withdraw funds if necessary.
        if (simple_map::contains_key(&tontine_.contributions, &member_addr)) {
            let value = coin::value(simple_map::borrow(&tontine_.contributions, &member_addr));
            withdraw(member, tontine, value);
        };
    }


    /// Attempt to lock the tontine.
    public entry fun lock(
        caller: &signer,
        tontine: Object<Tontine>,
    ) acquires Tontine {
        // Assert the tontine is in a valid state.
        let allowed = vector::empty();
        vector::push_back(&mut allowed, OVERALL_STATUS_CAN_BE_LOCKED);
        assert_overall_status(tontine, allowed);

        let tontine_ = borrow_global_mut<Tontine>(object::object_address(&tontine));

        // Assert the caller is a member of the tontine.
        let caller_addr = signer::address_of(caller);
        let (in_tontine, _i) = vector::index_of(&tontine_.config.members, &caller_addr);
        assert!(in_tontine, error::invalid_state(E_CALLER_NOT_IN_TONTINE));

        // Set the locked_time_secs to the current time.
        tontine_.locked_time_secs = now_seconds();

        // Emit an event.
        event::emit_event(&mut tontine_.tontine_locked_events, TontineLockedEvent {});
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

    // TODO: Talk about the philosophy where top level functions take in Object<Tontine>
    // and everything else lower down should too unless it would cause issues with dangling
    // refs or something like that.

    /// Get the statuses of the members of the tontine.
    fun get_member_statuses(tontine: Object<Tontine>): SimpleMap<address, u8> acquires Tontine {
        let statuses: SimpleMap<address, u8> = simple_map::create();

        let now = now_seconds();

        let tontine_ = borrow_global<Tontine>(object::object_address(&tontine));

        let funds_claimed = option::is_some(&tontine_.funds_claimed_by);
        let tontine_locked = tontine_.locked_time_secs > 0;

        // Some data we collect as we build the statuses.
        let num_still_eligible = 0;
        let most_recent_check_in_address = vector::borrow(&tontine_.config.members, 0);
        let most_recent_check_in_time_secs = 0;

        let i = 0;
        let len = vector::length(&tontine_.config.members);
        while (i < len) {
            let member = vector::borrow(&tontine_.config.members, i);

            let status = if (funds_claimed) {
                // The funds were claimed.
                let claimed_by = option::borrow(&tontine_.funds_claimed_by);
                if (member == claimed_by) {
                    // The member claimed the funds.
                    MEMBER_STATUS_CLAIMED_FUNDS
                } else {
                    // Everyone else is ineligible.
                    MEMBER_STATUS_INELIGIBLE
                }
            } else if (tontine_locked) {
                // The tontine is locked. It might even be finished.
                let last_check_in_time_secs = get_last_check_in_time_secs(tontine_, member);
                // Keep track of who checked in most recently.
                if (last_check_in_time_secs > most_recent_check_in_time_secs) {
                    most_recent_check_in_time_secs = last_check_in_time_secs;
                    most_recent_check_in_address = member;
                };
                if (now > last_check_in_time_secs + tontine_.config.check_in_frequency_secs) {
                    // The member failed to check in.
                    MEMBER_STATUS_INELIGIBLE
                } else {
                    // The member has been checking in at the required frequency.
                    num_still_eligible = num_still_eligible + 1;
                    MEMBER_STATUS_STILL_ELIGIBLE
                }
            } else {
                // The tontine is not locked yet.
                if (!simple_map::contains_key(&tontine_.contributions, member)) {
                    // The member has not contributed funds yet.
                    MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS
                } else {
                    let contributed_amount = coin::value(simple_map::borrow(&tontine_.contributions, member));
                    if (contributed_amount < tontine_.config.per_member_amount_octa) {
                        // The member has contributed funds, but not yet enough.
                        MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS
                    } else {
                        if (vector::contains(&tontine_.reconfirmation_required, member)) {
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
    fun get_member_status(tontine: Object<Tontine>, member: address): u8 acquires Tontine {
        let statuses = get_member_statuses(tontine);
        let (_, v) = simple_map::remove(&mut statuses, &member);
        v
    }

    #[view]
    /// Get the status of the tontine.
    fun get_overall_status(tontine: Object<Tontine>): u8 acquires Tontine {
        if (is_cancelled(tontine)) {
            return OVERALL_STATUS_CANCELLED
        };

        let (_, statuses) = simple_map::to_vec_pair(get_member_statuses(tontine));

        let tontine_ = borrow_global<Tontine>(object::object_address(&tontine));

        if (option::is_some(&tontine_.funds_claimed_by)) {
            return OVERALL_STATUS_FUNDS_CLAIMED
        };

        if (tontine_.fallback_executed) {
            return OVERALL_STATUS_FALLBACK_EXECUTED
        };

        // Build up counts of relevant per member statuses.
        let num_members = vector::length(&tontine_.config.members);
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

        if (tontine_.locked_time_secs == 0) {
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

    #[view]
    /// If the creator leaves a tontine we consider it cancelled and do not allow any
    /// further actions (including them rejoining) besides withdrawing funds.
    fun is_cancelled(tontine: Object<Tontine>): bool acquires Tontine {
        let tontine_ = borrow_global<Tontine>(object::object_address(&tontine));
        !vector::contains(&tontine_.config.members, &object::owner(tontine))
    }

    // Assert that the overall status is in the allowed list. If not, return an error
    // corresponding to what status it is in.
    fun assert_overall_status(tontine: Object<Tontine>, allowed: vector<u8>) acquires Tontine {
        let status = get_overall_status(tontine);

        // This is a bit of a hack based on the fact that the status codes and the
        // error codes we use when the tontine is in that state match.
        assert!(vector::contains(&allowed, &status), error::invalid_state((status as u64)));
    }

    #[test_only]
    fun create_test_account(
        mint_cap: &MintCapability<AptosCoin>,
        account: &signer,
    ) {
        account::create_account_for_test(signer::address_of(account));
        coin::register<AptosCoin>(account);
        let coins = coin::mint<AptosCoin>(100000, mint_cap);
        coin::deposit(signer::address_of(account), coins);
    }

    #[test_only]
    fun get_mint_cap(
        aptos_framework: &signer
    ): MintCapability<AptosCoin> {
        let (burn_cap, freeze_cap, mint_cap) = coin::initialize<AptosCoin>(
            aptos_framework,
            string::utf8(b"TC"),
            string::utf8(b"TC"),
            8,
            false,
        );
        coin::destroy_freeze_cap(freeze_cap);
        coin::destroy_burn_cap(burn_cap);
        mint_cap
    }

    #[test_only]
    public fun set_global_time(
        aptos_framework: &signer,
        timestamp: u64
    ) {
        timestamp::set_time_has_started_for_testing(aptos_framework);
        timestamp::update_global_time_for_test_secs(timestamp);
    }


    #[test_only]
    fun create_tontine(creator: &signer, friend1: &signer, friend2: &signer, aptos_framework: &signer): Object<Tontine> {
        let time = 1;
        set_global_time(aptos_framework, time);

        let mint_cap = get_mint_cap(aptos_framework);
        create_test_account(&mint_cap, creator);
        create_test_account(&mint_cap, friend1);
        create_test_account(&mint_cap, friend2);
        coin::destroy_mint_cap(mint_cap);

        let friend1_addr = signer::address_of(friend1);
        let friend2_addr = signer::address_of(friend2);

        let members = vector::empty();
        vector::push_back(&mut members, friend1_addr);
        vector::push_back(&mut members, friend2_addr);

        let check_in_frequency_secs = 60 * 60 * 24 * 30;
        let grace_period_secs = 60 * 60 * 24 * 30;
        create_(creator, members, check_in_frequency_secs, grace_period_secs, 10000)
    }

    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_create(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) {
        create_tontine(&creator, &friend1, &friend2, &aptos_framework);
    }

    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_status_reporting(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        let tontine = create_tontine(&creator, &friend1, &friend2, &aptos_framework);

        let creator_addr = signer::address_of(&creator);
        let friend1_addr = signer::address_of(&friend1);
        let friend2_addr = signer::address_of(&friend2);

        // See that everyone is marked as needing to contribute to begin with.
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &creator_addr) == MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend1_addr) == MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend2_addr) == MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS, 0);

        // See that the overall status is still staging.
        assert!(get_overall_status(tontine) == OVERALL_STATUS_STAGING, 0);

        // Contribute less than the required amount, see that they will still be
        // marked as needing to contribute funds.
        contribute(&friend1, tontine, 5000);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend1_addr) == MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS, 0);

        // Contribute the rest and see that they get marked as ready.
        contribute(&friend1, tontine, 5000);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend1_addr) == MEMBER_STATUS_READY, 0);

        // See that the other members still have the same status.
        contribute(&friend1, tontine, 5000);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &creator_addr) == MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend2_addr) == MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS, 0);

        // See that the tontine can't be locked.
        // TODO ^, might be easier to do in its own test.

        // See that the tontine overall status indicates it can be locked once
        // all members contribute.
        contribute(&creator, tontine, 10000);
        contribute(&friend2, tontine, 10000);
        assert!(get_overall_status(tontine) == OVERALL_STATUS_CAN_BE_LOCKED, 0);

        // See that we can lock the tontine now, and anyone in the tontine can do it.
        lock(&friend1, tontine);

        // See that no one can contribute or withdraw anymore.
        // TODO
    }

    #[expected_failure(abort_code = 196673, location = Self)]
    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_cancellation(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        let tontine = create_tontine(&creator, &friend1, &friend2, &aptos_framework);

        let creator_addr = signer::address_of(&creator);

        // Contribute funds as the creator and friend1.
        contribute(&creator, tontine, 5000);
        contribute(&friend1, tontine, 5000);

        // As the creator, leave the tontine.
        leave(&creator, tontine);

        // Confirm that the creator is no longer in the tontine.
        assert!(!simple_map::contains_key(&get_member_statuses(tontine), &creator_addr), 0);

        // Confirm that the overall status is cancelled.
        assert!(get_overall_status(tontine) == OVERALL_STATUS_CANCELLED, 0);

        // Confirm that others can still withdraw and leave.
        withdraw(&friend1, tontine, 5000);

        // Leaving should also work, which withdraws if necessary.
        leave(&friend2, tontine);

        // Confirm that others can no longer perform actions like contribute.
        // This call should result in the error we're looking for in the
        // expected_failure attribute above.
        contribute(&friend1, tontine, 5000);
    }
}

