// Copyright (c) Daniel Porteous
// SPDX-License-Identifier: Apache-2.0

//! See the README for more information about how this tontine module works.

module addr::tontine05 {
    use std::error;
    use std::option::{Self, Option};
    use std::signer;
    use std::string;
    use std::vector;
    use std::timestamp::now_seconds;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::event::{Self, EventHandle};
    use aptos_std::object::{Self, DeleteRef, Object};
    use aptos_std::simple_map::{Self, SimpleMap};

    #[test_only]
    use std::timestamp;
    #[test_only]
    use aptos_framework::account;
    #[test_only]
    use aptos_framework::coin::MintCapability;

    /// The `invitees` list was empty.
    const E_CREATION_INVITEES_EMPTY: u64 = 1;

    /// The `invitees` list had duplicate items.
    const E_CREATION_INVITEES_HAS_DUPLICATES: u64 = 2;

    /// `per_member_amount_octa` was zero.
    const E_CREATION_PER_MEMBER_AMOUNT_ZERO: u64 = 3;

    /// `check_in_frequency_secs` was out of the accepted range.
    const E_CREATION_CHECK_IN_FREQUENCY_OUT_OF_RANGE: u64 = 4;

    /// `claim_window_secs` was too small.
    const E_CREATION_CLAIM_WINDOW_TOO_SMALL: u64 = 5;

    /// `fallback_policy` was invalid.
    const E_CREATION_INVALID_FALLBACK_POLICY: u64 = 6;

    /// Tried to interact with an account with no TontineStore.
    const E_TONTINE_STORE_NOT_FOUND: u64 = 7;

    /// Tried to get a Tontine from a TontineStore but there was nothing found with
    /// the requested index.
    const E_TONTINE_NOT_FOUND: u64 = 8;

    /// Tried to perform an action but the given caller is not in the tontine.
    const E_CALLER_NOT_IN_TONTINE: u64 = 9;

    /// Tried to perform an action that relies on the member having contributed, but
    /// they haven't done so yet or they have withdrawn their contribution.
    const E_NO_CONTRIBUTION_MADE_YET: u64 = 11;

    /// Tried to lock the tontine but the conditions aren't yet met.
    const E_LOCK_CONDITIONS_NOT_MET: u64 = 12;

    /// Tried to perform an action but the given tontine is locked.
    const E_TONTINE_LOCKED: u64 = 13;

    /// Tried to perform an action but the caller was not the creator.
    const E_CALLER_IS_NOT_CREATOR: u64 = 14;

    /// Tried to perform an action that the creator is not allowed to take.
    const E_CALLER_IS_CREATOR: u64 = 15;

    /*
    ** Error codes corresponding to the overall status of a tontine. We use these when
    ** the tontine is one of these states and that state is invalid for the intended
    ** operation.
    */

    /// The tontine is in state OVERALL_STATUS_STAGING, which is invalid for this operation.
    const E_OVERALL_STATUS_IS_STAGING: u8 = 64;

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
    ** Error codes corresponding to the status of a member in a tontine. We use these
    ** when the member is in one of these states and that state is invalid for the
    ** intended operation.
    */

    /// The member is in state MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS, which is invalid for this operation.
    const E_MEMBER_STATUS_IS_MUST_CONTRIBUTE_FUNDS: u8 = 128;

    /// The member is in state MEMBER_STATUS_MUST_RECONFIRM, which is invalid for this operation.
    const E_MEMBER_STATUS_IS_MUST_RECONFIRM: u8 = 129;

    /// The member is in state MEMBER_STATUS_READY, which is invalid for this operation.
    const E_MEMBER_STATUS_IS_READY: u8 = 130;

    /// The member is in state MEMBER_STATUS_STILL_ELIGIBLE, which is invalid for this operation.
    const E_MEMBER_STATUS_IS_STILL_ELIGIBLE: u8 = 131;

    /// The member is in state MEMBER_STATUS_INELIGIBLE, which is invalid for this operation.
    const E_MEMBER_STATUS_IS_INELIGIBLE: u8 = 132;

    /// The member is in state MEMBER_STATUS_CAN_CLAIM_FUNDS, which is invalid for this operation.
    const E_MEMBER_STATUS_IS_CAN_CLAIM_FUNDS: u8 = 133;

    /// The member is in state MEMBER_STATUS_CLAIMED_FUNDS, which is invalid for this operation.
    const E_MEMBER_STATUS_IS_CLAIMED_FUNDS: u8 = 134;

    /// The member is in state MEMBER_STATUS_NEVER_CLAIMED_FUNDS, which is invalid for this operation.
    const E_MEMBER_STATUS_IS_NEVER_CLAIMED_FUNDS: u8 = 135;

    /*
    ** Codes representing the overall status of a tontine.
    */

    /// The tontine has been created and is awaiting contributions.
    const OVERALL_STATUS_STAGING: u8 = 64;

    /// The final contribution has been made so the tontine can now be locked.
    const OVERALL_STATUS_CAN_BE_LOCKED: u8 = 66;

    /// The tontine is locked.
    const OVERALL_STATUS_LOCKED: u8 = 67;

    /// All parties but one have failed to check in within the window, so the
    /// remaining party may claim the funds.
    const OVERALL_STATUS_FUNDS_CLAIMABLE: u8 = 68;

    /// The funds were claimed. This is a terminal state. From this point on the
    /// tontine can be destroyed.
    const OVERALL_STATUS_FUNDS_CLAIMED: u8 = 69;

    /// The final party failed to claim the funds within the claim window, so the
    /// fallback policy can be called.
    const OVERALL_STATUS_FUNDS_NEVER_CLAIMED: u8 = 70;

    /// The fallback policy was invoked. This is a terminal state. From this point on
    /// the tontine can be destroyed.
    const OVERALL_STATUS_FALLBACK_EXECUTED: u8 = 71;

    /*
    ** Codes representing the status of members within a tontine.
    */

    /// The member needs to contribute funds.
    const MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS: u8 = 128;

    /// The member must reconfirm their intent to be in the tontine.
    const MEMBER_STATUS_MUST_RECONFIRM: u8 = 129;

    /// The member has contributed funds and reconfirmed if necessary, they are now
    /// just waiting for the tontine to be locked.
    const MEMBER_STATUS_READY: u8 = 130;

    /// The member has so far checked in every time within the check in window and is
    /// therefore still in the running for the funds.
    const MEMBER_STATUS_STILL_ELIGIBLE: u8 = 131;

    /// The member has failed to check in within the check in window and will therefore
    /// never be able to claim the funds.
    const MEMBER_STATUS_INELIGIBLE: u8 = 132;

    /// The member is the last person standing and can claim the funds.
    const MEMBER_STATUS_CAN_CLAIM_FUNDS: u8 = 133;

    /// The member was the last person standing and claimed the funds.
    const MEMBER_STATUS_CLAIMED_FUNDS: u8 = 134;

    /// The member was the last person standing but failed to claim the funds.
    const MEMBER_STATUS_NEVER_CLAIMED_FUNDS: u8 = 135;

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
        member_checked_in_events: EventHandle<MemberCheckedInEvent>,
        funds_claimed_events: EventHandle<FundsClaimedEvent>,
        fallback_executed_events: EventHandle<FallbackExecutedEvent>,

        // Let's the creator delete the tontine once it is in a terminal state.
        delete_ref: DeleteRef,
    }

    struct TontineConfig has store, drop {
        /// Vanity description for the tontine, this is only used for display purposes.
        description: string::String,

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
        claim_window_secs: u64,

        /// What happens if the last-standing member of the tontine fails to claim the
        /// funds within the claim window.
        fallback_policy: TontineFallbackPolicy
    }

    const TONTINE_FALLBACK_POLICY_RETURN_TO_MEMBERS: u8 = 0;
    const TONTINE_FALLBACK_POLICY_DONATE: u8 = 1;

    /// This policy defines what happens if the last-standing member of the tontine
    /// fails to claim the funds within the claim window. The options are:
    /// 1. The funds are returned to the members.
    /// 2. The funds are sent to giving.apt (for charity).
    struct TontineFallbackPolicy has store, drop {
        policy: u8,
    }

    // Note, we don't need to include the address of the object when we create it
    // because the event will be emitted from the object itself.
    struct TontineCreatedEvent has store, drop {
        creator: address,
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
        creator_left: bool,
    }

    struct TontineLockedEvent has store, drop {}

    struct MemberCheckedInEvent has store, drop {
        member: address,
    }

    struct FundsClaimedEvent has store, drop {
        member: address,
    }

    struct FallbackExecutedEvent has store, drop {}

    /// todo explain
    /// testing.
    // TODO: Use the TontineConfig struct directly when that is possible.
    // TODO: Look into some kind of set for participiants instead of a vec.
    // TODO: Find a way to assert members has no duplicates.
    // No fallback policy for now, not yet implemented. Look into enums.
    public entry fun create(
        caller: &signer,
        description: string::String,
        invitees: vector<address>,
        check_in_frequency_secs: u64,
        claim_window_secs: u64,
        per_member_amount_octa: u64,
        fallback_policy: u8,
    ) {
        create_(caller, description, invitees, check_in_frequency_secs, claim_window_secs, per_member_amount_octa, fallback_policy);
    }

    /// This function is separate from the top level create function so we can use it
    /// tests. This is necessary because entry functions (correctly) cannot return
    /// anything but we need it to return the object with the tontine in it.
    inline fun create_(
        caller: &signer,
        description: string::String,
        invitees: vector<address>,
        check_in_frequency_secs: u64,
        claim_window_secs: u64,
        per_member_amount_octa: u64,
        fallback_policy: u8,
    ): Object<Tontine> {
        // Assert some details about the tontine parameters.
        assert!(!vector::is_empty(&invitees), error::invalid_argument(E_CREATION_INVITEES_EMPTY));
        assert!(check_in_frequency_secs > 30, error::invalid_argument(E_CREATION_CHECK_IN_FREQUENCY_OUT_OF_RANGE));
        assert!(check_in_frequency_secs < 60 * 60 * 24 * 365, error::invalid_argument(E_CREATION_CHECK_IN_FREQUENCY_OUT_OF_RANGE));
        assert!(claim_window_secs > 60 * 60, error::invalid_argument(E_CREATION_CLAIM_WINDOW_TOO_SMALL));
        assert!(claim_window_secs < 60 * 60 * 24 * 365, error::invalid_argument(E_CREATION_CLAIM_WINDOW_TOO_SMALL));
        assert!(per_member_amount_octa > 0, error::invalid_argument(E_CREATION_PER_MEMBER_AMOUNT_ZERO));

        let caller_addr = signer::address_of(caller);

        // Add the creator's address to `invitees` if necessary.
        if (!vector::contains(&invitees, &caller_addr)) {
            vector::push_back(&mut invitees, caller_addr);
        };

        // Ensure there are no duplicates in the invitees list.
        let len = vector::length(&invitees);
        let i = 0;
        while (i < len) {
            let invitee = vector::borrow(&invitees, i);
            let j = i + 1;
            while (j < len) {
                let other_invitee = vector::borrow(&invitees, j);
                assert!(invitee != other_invitee, error::invalid_argument(E_CREATION_INVITEES_HAS_DUPLICATES));
                j = j + 1;
            };
            i = i + 1;
        };

        // Create a new object.
        let constructor_ref = &object::create_object_from_account(caller);
        let delete_ref = object::generate_delete_ref(constructor_ref);
        let object_signer = &object::generate_signer(constructor_ref);

        // Emit an event for each invitee except for the creator.
        let member_invited_events = object::new_event_handle(object_signer);
        let len = vector::length(&invitees);
        let i = 0;
        while (i < len) {
            let invitee = vector::borrow(&invitees, i);
            if (invitee != &caller_addr) {
                event::emit_event(&mut member_invited_events, MemberInvitedEvent {
                    member: *invitee,
                });
            };
            i = i + 1;
        };

        assert!(
            fallback_policy == TONTINE_FALLBACK_POLICY_RETURN_TO_MEMBERS ||
            fallback_policy == TONTINE_FALLBACK_POLICY_DONATE,
            error::invalid_argument(E_CREATION_INVALID_FALLBACK_POLICY),
        );

        // Build the TontineConfig. We modify some of the arguments above (e.g.
        // `invitees`) so this isn't a direct mapping of the inputs.
        let tontine_config = TontineConfig {
            description,
            members: invitees,
            per_member_amount_octa: per_member_amount_octa,
            check_in_frequency_secs: check_in_frequency_secs,
            claim_window_secs: claim_window_secs,
            fallback_policy: TontineFallbackPolicy {
                policy: fallback_policy,
            },
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
            member_checked_in_events: object::new_event_handle(object_signer),
            funds_claimed_events: object::new_event_handle(object_signer),
            fallback_executed_events: object::new_event_handle(object_signer),
            delete_ref,
        };

        // Emit an event so the creator of the Tontine and its location can be discovered.
        event::emit_event(&mut tontine.tontine_created_events, TontineCreatedEvent {
            creator: caller_addr,
        });

        move_to(object_signer, tontine);

        object::object_from_constructor_ref(constructor_ref)
    }

    public entry fun contribute(
        caller: &signer,
        tontine: Object<Tontine>,
        contribution_amount_octa: u64,
    ) acquires Tontine {
        // Assert the tontine is in a valid state.
        let allowed = vector::empty();
        vector::push_back(&mut allowed, OVERALL_STATUS_STAGING);
        vector::push_back(&mut allowed, OVERALL_STATUS_CAN_BE_LOCKED);
        assert_overall_status(tontine, allowed);

        // Withdraw the contribution from the contributor's account.
        let contribution = coin::withdraw<AptosCoin>(caller, contribution_amount_octa);

        let tontine_ = borrow_global_mut<Tontine>(object::object_address(&tontine));

        let caller_addr = signer::address_of(caller);

        if (simple_map::contains_key(&tontine_.contributions, &caller_addr)) {
            // This contributor has already contributed, merge this new contribution
            // with their existing one.
            let existing_contribution = simple_map::borrow_mut(&mut tontine_.contributions, &caller_addr);
            coin::merge(existing_contribution, contribution);
        } else {
            // The contributor has not contributed yet.
            simple_map::add(&mut tontine_.contributions, caller_addr, contribution);
        };

        // Emit an event.
        event::emit_event(&mut tontine_.member_contributed_events, MemberContributedEvent {
            member: caller_addr,
            amount_octa: contribution_amount_octa,
        });
    }

    public entry fun withdraw(
        caller: &signer,
        tontine: Object<Tontine>,
        withdrawal_amount_octa: u64,
    ) acquires Tontine {
        // Assert the tontine is in a valid state.
        let allowed = vector::empty();
        vector::push_back(&mut allowed, OVERALL_STATUS_STAGING);
        vector::push_back(&mut allowed, OVERALL_STATUS_CAN_BE_LOCKED);
        assert_overall_status(tontine, allowed);

        let tontine_ = borrow_global_mut<Tontine>(object::object_address(&tontine));
        let caller_addr = signer::address_of(caller);

        withdraw_part(tontine_, caller_addr, withdrawal_amount_octa);
    }

    /// Leave a tontine. If the member has any funds in the tontine, this will withdraw
    /// them. The creator cannot leave their own tontine. Instead they must destroy the
    /// tontine, which will return everyone's funds.
    public entry fun leave(
        caller: &signer,
        tontine: Object<Tontine>,
    ) acquires Tontine {
        // Assert the tontine is in a valid state.
        let allowed = vector::empty();
        vector::push_back(&mut allowed, OVERALL_STATUS_STAGING);
        vector::push_back(&mut allowed, OVERALL_STATUS_CAN_BE_LOCKED);
        assert_overall_status(tontine, allowed);

        let tontine_ = borrow_global_mut<Tontine>(object::object_address(&tontine));

        let caller_addr = signer::address_of(caller);

        // Make sure the caller is not the creator.
        assert!(caller_addr != object::owner(tontine), error::invalid_argument(E_CALLER_IS_CREATOR));

        // Withdraw all funds.
        withdraw_all(tontine_, caller_addr);

        // Leave the tontine.
        let (in_tontine, i) = vector::index_of(&tontine_.config.members, &caller_addr);
        assert!(in_tontine, error::invalid_state(E_CALLER_NOT_IN_TONTINE));
        vector::remove(&mut tontine_.config.members, i);

        // Emit an event.
        event::emit_event(&mut tontine_.member_left_events, MemberLeftEvent {
            member: caller_addr,
            creator_left: caller_addr == object::object_address(&tontine),
        });
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
        assert_in_tontine(tontine_, &caller_addr);

        // Set the locked_time_secs to the current time.
        tontine_.locked_time_secs = now_seconds();

        // Emit an event.
        event::emit_event(&mut tontine_.tontine_locked_events, TontineLockedEvent {});
    }

    /// Check in, demonstrating that you're still "alive".
    public entry fun check_in(
        caller: &signer,
        tontine: Object<Tontine>,
    ) acquires Tontine {
        // Assert the caller is still allowed to check in.
        let caller_addr = signer::address_of(caller);
        let allowed = vector::empty();
        vector::push_back(&mut allowed, MEMBER_STATUS_STILL_ELIGIBLE);
        // Let the user keep checking in if they want, even though they could just
        // claim the funds.
        vector::push_back(&mut allowed, MEMBER_STATUS_CAN_CLAIM_FUNDS);
        assert_member_status(tontine, allowed, caller_addr);

        let tontine_ = borrow_global_mut<Tontine>(object::object_address(&tontine));

        // Update the last check in time for the caller.
        simple_map::upsert(&mut tontine_.last_check_in_times_secs, caller_addr, now_seconds());

        // Emit an event.
        event::emit_event(&mut tontine_.member_checked_in_events, MemberCheckedInEvent {
            member: caller_addr,
        });
    }

    /// Claim the funds of the tontine. This will only work if everyone else has failed
    /// to check in and the the claim window has not passed.
    public entry fun claim(
        caller: &signer,
        tontine: Object<Tontine>,
    ) acquires Tontine {
        // Assert the caller is allowed to claim the funds. The underlying member status
        // function will only ever return MEMBER_STATUS_CAN_CLAIM_FUNDS if only a single
        // member remains and we're within the claim window.
        let caller_addr = signer::address_of(caller);
        let allowed = vector::empty();
        vector::push_back(&mut allowed, MEMBER_STATUS_CAN_CLAIM_FUNDS);
        assert_member_status(tontine, allowed, caller_addr);

        let tontine_ = borrow_global_mut<Tontine>(object::object_address(&tontine));

        // Take out all the contributions from the tontine and merge them.
        let funds = coin::zero();
        let len = vector::length(&tontine_.config.members);
        let i = 0;
        while (i < len) {
            let member = vector::borrow(&tontine_.config.members, i);
            let (_, v) = simple_map::remove(&mut tontine_.contributions, member);
            coin::merge(&mut funds, v);
            i = i + 1;
        };

        // Give the funds to the claimer.
        coin::deposit<AptosCoin>(caller_addr, funds);

        // Mark the tontine as claimed.
        tontine_.funds_claimed_secs = now_seconds();
        tontine_.funds_claimed_by = option::some(caller_addr);

        // Emit an event.
        event::emit_event(&mut tontine_.funds_claimed_events, FundsClaimedEvent {
            member: caller_addr,
        });
    }

    /// Execute the fallback. Anyone can call this function, assuming the tontine is in
    /// a state where the fallback can be executed.
    public entry fun execute_fallback(
        tontine: Object<Tontine>,
    ) acquires Tontine {
        // Assert the tontine is in a state where the fallback can be executed.
        let allowed = vector::empty();
        vector::push_back(&mut allowed, OVERALL_STATUS_FUNDS_NEVER_CLAIMED);
        assert_overall_status(tontine, allowed);

        let tontine_ = borrow_global_mut<Tontine>(object::object_address(&tontine));

        if (tontine_.config.fallback_policy.policy == TONTINE_FALLBACK_POLICY_RETURN_TO_MEMBERS) {
            let i = 0;
            let len = vector::length(&tontine_.config.members);
            while (i < len) {
                let member = vector::borrow(&tontine_.config.members, i);
                let (_, v) = simple_map::remove(&mut tontine_.contributions, member);
                coin::deposit(*member, v);
                i = i + 1;
            };
        } else if (tontine_.config.fallback_policy.policy == TONTINE_FALLBACK_POLICY_DONATE) {
            let funds = coin::zero();
            let len = vector::length(&tontine_.config.members);
            let i = 0;
            while (i < len) {
                let member = vector::borrow(&tontine_.config.members, i);
                let (_, v) = simple_map::remove(&mut tontine_.contributions, member);
                coin::merge(&mut funds, v);
                i = i + 1;
            };
            // This address corresponds to giving.apt
            coin::deposit(@0xd08bfe94dccb607e27177958c7af33c71f926e73a13f3ecdd18e1cfba56783a7, funds);
        } else {
            // This should never happen.
            assert!(false, 255);
        };

        tontine_.fallback_executed = true;

        // Emit an event.
        event::emit_event(&mut tontine_.fallback_executed_events, FallbackExecutedEvent {});
    }

    /// Delete the tontine from global storage. This is only possible once the tontine
    /// is in a terminal state.
    public entry fun destroy(
        caller: &signer,
        tontine: Object<Tontine>,
    ) acquires Tontine {
        let caller_addr = signer::address_of(caller);
        let creator_addr = object::owner(tontine);

        // Only the creator can destroy a tontine.
        assert!(caller_addr == creator_addr, error::invalid_state(E_CALLER_IS_NOT_CREATOR));

        // Assert the tontine is in a terminal state.
        let allowed = vector::empty();
        vector::push_back(&mut allowed, OVERALL_STATUS_STAGING);
        vector::push_back(&mut allowed, OVERALL_STATUS_CAN_BE_LOCKED);
        vector::push_back(&mut allowed, OVERALL_STATUS_FUNDS_CLAIMED);
        vector::push_back(&mut allowed, OVERALL_STATUS_FALLBACK_EXECUTED);
        assert_overall_status(tontine, allowed);

        let tontine_ = move_from<Tontine>(object::object_address(&tontine));

        // Return any funds to the members of the tontine.
        let i = 0;
        let len = vector::length(&tontine_.config.members);
        while (i < len) {
            let addr = *vector::borrow(&tontine_.config.members, i);
            withdraw_all(&mut tontine_, addr);
            i = i + 1;
        };

        // Take all the fields out of the Tontine. Immediately drop those that can
        // be dropped.
        let Tontine {
            config: _,
            creation_time_secs: _,
            contributions,
            reconfirmation_required: _,
            locked_time_secs: _,
            last_check_in_times_secs: _,
            funds_claimed_secs: _,
            funds_claimed_by: _,
            fallback_executed: _,
            tontine_created_events,
            member_invited_events,
            member_removed_events,
            member_contributed_events,
            member_withdrew_events,
            member_left_events,
            tontine_locked_events,
            member_checked_in_events,
            funds_claimed_events,
            fallback_executed_events,
            delete_ref,
        } = tontine_;

        // There should be nothing in this map after returning all the funds above
        // so this is just destroying an empty map.
        let (_, coins) = simple_map::to_vec_pair(contributions);
        vector::destroy_empty(coins);

        // Delete the event handles.
        event::destroy_handle(tontine_created_events);
        event::destroy_handle(member_invited_events);
        event::destroy_handle(member_removed_events);
        event::destroy_handle(member_contributed_events);
        event::destroy_handle(member_withdrew_events);
        event::destroy_handle(member_left_events);
        event::destroy_handle(tontine_locked_events);
        event::destroy_handle(member_checked_in_events);
        event::destroy_handle(funds_claimed_events);
        event::destroy_handle(fallback_executed_events);

        // Destroy the object core.
        object::delete(delete_ref);
    }

    // Withdraw all the funds for a member, if any.
    inline fun withdraw_all(
        tontine_: &mut Tontine,
        withdrawer: address,
    ) {
        if (simple_map::contains_key(&tontine_.contributions, &withdrawer)) {
            let amount = coin::value(simple_map::borrow(&tontine_.contributions, &withdrawer));
            withdraw_part(tontine_, withdrawer, amount);
        }
    }

    inline fun withdraw_part(
        tontine_: &mut Tontine,
        // The address of the member who is withdrawing.
        withdrawer: address,
        withdrawal_amount_octa: u64,
    ) {
        // Assert the member has actually contributed.
        assert!(simple_map::contains_key(&tontine_.contributions, &withdrawer), error::invalid_state(E_NO_CONTRIBUTION_MADE_YET));

        // Extract the withdrawal amount from the member's contribution.
        let (withdrawer, contribution) = simple_map::remove(&mut tontine_.contributions, &withdrawer);
        let withdrawal = coin::extract<AptosCoin>(&mut contribution, withdrawal_amount_octa);
        coin::deposit<AptosCoin>(withdrawer, withdrawal);

        if (coin::value(&contribution) == 0) {
            // If the leftover amount is zero, destroy the contribution.
            coin::destroy_zero(contribution);
        } else {
            // If there is some left, put it back in the contributions map.
            simple_map::add(&mut tontine_.contributions, withdrawer, contribution);
        };

        // Emit an event.
        event::emit_event(&mut tontine_.member_withdrew_events, MemberWithdrewEvent {
            member: withdrawer,
            amount_octa: withdrawal_amount_octa,
        });
    }

    inline fun assert_in_tontine(tontine: &Tontine, caller: &address) {
        let (in_tontine, _i) = vector::index_of(&tontine.config.members, caller);
        assert!(in_tontine, error::invalid_state(E_CALLER_NOT_IN_TONTINE));
    }

    /// Get the time a member last checked in.
    fun get_last_check_in_time_secs(tontine: &Tontine, member: &address): u64 {
        if (!simple_map::contains_key(&tontine.last_check_in_times_secs, member)) {
            // If the member has never explicitly checked in, the implied last check in
            // is the time the tontine was locked.
            tontine.locked_time_secs
        } else {
            *simple_map::borrow(&tontine.last_check_in_times_secs, member)
        }
    }

    #[view]
    /// Get the statuses of the members of the tontine.
    fun get_member_statuses(tontine: Object<Tontine>): SimpleMap<address, u8> acquires Tontine {
        let statuses: SimpleMap<address, u8> = simple_map::create();

        let now = now_seconds();

        let tontine_ = borrow_global<Tontine>(object::object_address(&tontine));

        let funds_claimed = option::is_some(&tontine_.funds_claimed_by);
        let tontine_locked = tontine_.locked_time_secs > 0;

        // Some data we collect as we build the statuses.
        let num_checked_in_frequently_enough = 0;
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
                    num_checked_in_frequently_enough = num_checked_in_frequently_enough + 1;
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
            if (num_checked_in_frequently_enough == 1) {
                // Only one person is still eligible so we mark them as being able to
                // claim the funds.
                simple_map::upsert(&mut statuses, *most_recent_check_in_address, MEMBER_STATUS_CAN_CLAIM_FUNDS);
            } else if (num_checked_in_frequently_enough == 0) {
                // No one is able to check in any more. In this case, we look at the
                // person who checked in most recently and if we haven't moved past
                // the claim window, mark them as able to claim the funds.
                if (now < most_recent_check_in_time_secs + tontine_.config.claim_window_secs) {
                    simple_map::upsert(&mut statuses, *most_recent_check_in_address, MEMBER_STATUS_CAN_CLAIM_FUNDS);
                } else {
                    // The claim window has passed, mark the member who could've claimed
                    // the funds as having failed to do so.
                    simple_map::upsert(&mut statuses, *most_recent_check_in_address, MEMBER_STATUS_NEVER_CLAIMED_FUNDS);
                }
            }

        };

        statuses
    }

    #[view]
    /// Get the status of a member of the tontine.
    fun get_member_status(tontine: Object<Tontine>, member: address): u8 acquires Tontine {
        let statuses = get_member_statuses(tontine);
        assert!(simple_map::contains_key(&statuses, &member), error::invalid_state(E_CALLER_NOT_IN_TONTINE));
        let (_, v) = simple_map::remove(&mut statuses, &member);
        v
    }

    #[view]
    /// Get the status of the tontine.
    fun get_overall_status(tontine: Object<Tontine>): u8 acquires Tontine {
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

        loop {
            if (vector::is_empty(&statuses)) {
                break
            };
            let status = vector::pop_back(&mut statuses);
            if (status == MEMBER_STATUS_READY) {
                num_ready = num_ready + 1;
            };
            if (status == MEMBER_STATUS_CAN_CLAIM_FUNDS) {
                return OVERALL_STATUS_FUNDS_CLAIMABLE
            };
            if (status == MEMBER_STATUS_NEVER_CLAIMED_FUNDS) {
                return OVERALL_STATUS_FUNDS_NEVER_CLAIMED
            };
        };

        if (tontine_.locked_time_secs == 0) {
            if (num_ready == num_members) {
                return OVERALL_STATUS_CAN_BE_LOCKED
            } else {
                return OVERALL_STATUS_STAGING
            }
        };

        OVERALL_STATUS_LOCKED
    }

    // Assert that the overall status is in the allowed list. If not, return an error
    // corresponding to what status it is in.
    inline fun assert_overall_status(tontine: Object<Tontine>, allowed: vector<u8>) acquires Tontine {
        let status = get_overall_status(tontine);

        // This is a bit of a hack based on the fact that the status codes and the
        // error codes we use when the tontine is in that state match.
        assert!(vector::contains(&allowed, &status), error::invalid_state((status as u64)));
    }

    // Assert that the member status is in the allowed list. If not, return an error
    // corresponding to what status it is in.
    inline fun assert_member_status(tontine: Object<Tontine>, allowed: vector<u8>, member: address) acquires Tontine {
        let status = get_member_status(tontine, member);

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
    const START_TIME: u64 = 100;

    #[test_only]
    const CHECK_IN_FREQUENCY_SECS: u64 = 60 * 60 * 24 * 30;

    #[test_only]
    const CLAIM_WINDOW_SECS: u64 = 60 * 60 * 24 * 60;

    #[test_only]
    fun create_tontine(creator: &signer, friend1: &signer, friend2: &signer, aptos_framework: &signer): Object<Tontine> {
        set_global_time(aptos_framework, START_TIME);

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

        create_(creator, string::utf8(b"test"), members, CHECK_IN_FREQUENCY_SECS, CLAIM_WINDOW_SECS, 10000, TONTINE_FALLBACK_POLICY_RETURN_TO_MEMBERS)
    }

    #[test_only]
    fun create_and_lock_tontine(creator: &signer, friend1: &signer, friend2: &signer, aptos_framework: &signer): Object<Tontine> acquires Tontine {
        let tontine = create_tontine(creator, friend1, friend2, aptos_framework);

        let creator_addr = signer::address_of(creator);
        let friend1_addr = signer::address_of(friend1);
        let friend2_addr = signer::address_of(friend2);

        // See that everyone is marked as needing to contribute to begin with.
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &creator_addr) == MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend1_addr) == MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend2_addr) == MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS, 0);

        // See that the overall status is still staging.
        assert!(get_overall_status(tontine) == OVERALL_STATUS_STAGING, 0);

        // Contribute less than the required amount, see that they will still be
        // marked as needing to contribute funds.
        contribute(friend1, tontine, 5000);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend1_addr) == MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS, 0);

        // Contribute the rest and see that they get marked as ready.
        contribute(friend1, tontine, 5000);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend1_addr) == MEMBER_STATUS_READY, 0);

        // See that the other members still have the same status.
        contribute(friend1, tontine, 5000);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &creator_addr) == MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend2_addr) == MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS, 0);

        // See that the tontine can't be locked.
        // TODO ^, might be easier to do in its own test.

        // See that the tontine overall status indicates it can be locked once
        // all members contribute.
        contribute(creator, tontine, 10000);
        contribute(friend2, tontine, 10000);
        assert!(get_overall_status(tontine) == OVERALL_STATUS_CAN_BE_LOCKED, 0);

        // See that we can lock the tontine now, and anyone in the tontine can do it.
        lock(friend1, tontine);

        // See that the overall status is now locked.
        assert!(get_overall_status(tontine) == OVERALL_STATUS_LOCKED, 0);

        tontine
    }

    // Create a tontine, lock it, and advance it to the point where only one person is still eligible.
    #[test_only]
    fun create_tontine_only_one_remains(creator: &signer, friend1: &signer, friend2: &signer, aptos_framework: &signer): Object<Tontine> acquires Tontine {
        let tontine = create_and_lock_tontine(creator, friend1, friend2, aptos_framework);

        let creator_addr = signer::address_of(creator);
        let friend1_addr = signer::address_of(friend1);
        let friend2_addr = signer::address_of(friend2);

        // See that everyone is considered eligible at the start.
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &creator_addr) == MEMBER_STATUS_STILL_ELIGIBLE, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend1_addr) == MEMBER_STATUS_STILL_ELIGIBLE, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend2_addr) == MEMBER_STATUS_STILL_ELIGIBLE, 0);

        // Advance the time to 1 second before the required check in.
        set_global_time(aptos_framework, START_TIME + CHECK_IN_FREQUENCY_SECS - 1);

        // See that everyone is considered eligible still.
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &creator_addr) == MEMBER_STATUS_STILL_ELIGIBLE, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend1_addr) == MEMBER_STATUS_STILL_ELIGIBLE, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend2_addr) == MEMBER_STATUS_STILL_ELIGIBLE, 0);

        // Have two people check in.
        check_in(creator, tontine);
        check_in(friend1, tontine);

        // Advance the time past the original required check in time.
        set_global_time(aptos_framework, START_TIME + CHECK_IN_FREQUENCY_SECS + 1);

        // See that friend2 is no longer eligible but the rest are still eligible.
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &creator_addr) == MEMBER_STATUS_STILL_ELIGIBLE, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend1_addr) == MEMBER_STATUS_STILL_ELIGIBLE, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend2_addr) == MEMBER_STATUS_INELIGIBLE, 0);

        // Advance the time to roughly middle of the check in window.
        set_global_time(aptos_framework, START_TIME + CHECK_IN_FREQUENCY_SECS + 1 + CHECK_IN_FREQUENCY_SECS / 2);

        // Have only friend1 check in.
        check_in(friend1, tontine);

        // Advance the time to after the end of this check in window.
        set_global_time(aptos_framework, START_TIME + CHECK_IN_FREQUENCY_SECS + CHECK_IN_FREQUENCY_SECS + 1);

        // See that only friend1 is still eligible.
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &creator_addr) == MEMBER_STATUS_INELIGIBLE, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend1_addr) == MEMBER_STATUS_CAN_CLAIM_FUNDS, 0);
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend2_addr) == MEMBER_STATUS_INELIGIBLE, 0);

        // See that the overall status reflects that friend1 can claim the funds.
        assert!(get_overall_status(tontine) == OVERALL_STATUS_FUNDS_CLAIMABLE, 0);

        tontine
    }

    // Create a tontine and let it get to the point where one person was eligible to
    // claim funds but failed to do so within the claim window.
    #[test_only]
    fun create_tontine_no_one_remains(creator: &signer, friend1: &signer, friend2: &signer, aptos_framework: &signer): Object<Tontine> acquires Tontine {
        let tontine = create_tontine_only_one_remains(creator, friend1, friend2, aptos_framework);

        // Advance time way in the future.
        set_global_time(aptos_framework, 10000000000);

        let friend1_addr = signer::address_of(friend1);

        // See that friend1 can no longer claim the funds.
        assert!(*simple_map::borrow(&get_member_statuses(tontine), &friend1_addr) == MEMBER_STATUS_NEVER_CLAIMED_FUNDS, 0);
        assert!(get_overall_status(tontine) == OVERALL_STATUS_FUNDS_NEVER_CLAIMED, 0);

        tontine
    }

    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_create(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) {
        create_tontine(&creator, &friend1, &friend2, &aptos_framework);
    }

    #[expected_failure(abort_code = 65551, location = Self)]
    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_creator_cannot_leave(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        let tontine = create_tontine(&creator, &friend1, &friend2, &aptos_framework);

        // Confirm that the creator cannot leave their own tontine.
        leave(&creator, tontine);
    }

    // TODO: Confirm that these failure codes are what we expect.
    // https://github.com/aptos-labs/aptos-core/issues/8182

    #[expected_failure(abort_code = 196672, location = Self)]
    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_cannot_lock_until_all_contributed(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        let tontine = create_tontine(&creator, &friend1, &friend2, &aptos_framework);
        lock(&friend1, tontine);
    }

    #[expected_failure(abort_code = 196675, location = Self)]
    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_cannot_contribute_after_lock(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        let tontine = create_and_lock_tontine(&creator, &friend1, &friend2, &aptos_framework);
        contribute(&friend1, tontine, 1);
    }

    #[expected_failure(abort_code = 196675, location = Self)]
    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_cannot_withdraw_after_lock(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        let tontine = create_and_lock_tontine(&creator, &friend1, &friend2, &aptos_framework);
        withdraw(&friend1, tontine, 1);
    }

    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_check_in(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        create_tontine_only_one_remains(&creator, &friend1, &friend2, &aptos_framework);
    }

    #[expected_failure(abort_code = 196740, location = Self)]
    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_cannot_check_in_if_too_late(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        // In create_tontine_only_one_remains, everyone but friend1 failed to check in in time.
        let tontine = create_tontine_only_one_remains(&creator, &friend1, &friend2, &aptos_framework);

        // Confirm that creator can no longer check in.
        check_in(&creator, tontine);
    }

    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_claim(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        // In create_tontine_only_one_remains, everyone but friend1 failed to check in in time.
        let tontine = create_tontine_only_one_remains(&creator, &friend1, &friend2, &aptos_framework);

        // Confirm that friend1 can claim the funds.
        claim(&friend1, tontine);
    }

    #[expected_failure(abort_code = 196740, location = Self)]
    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_others_cannot_claim(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        // In create_tontine_only_one_remains, everyone but friend1 failed to check in in time.
        let tontine = create_tontine_only_one_remains(&creator, &friend1, &friend2, &aptos_framework);

        // This should fail, friend2 is not eligible claim the funds.
        claim(&friend2, tontine);
    }

    // Advance time beyond the end of the check in window and see that the last standing
    // member can still claim the funds if we're within the claim window.
    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_claim_within_window(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        // In create_tontine_only_one_remains, everyone but friend1 failed to check in in time.
        let tontine = create_tontine_only_one_remains(&creator, &friend1, &friend2, &aptos_framework);

        // This is when friend1 last checked in.
        let last_check_in_time = START_TIME + CHECK_IN_FREQUENCY_SECS + CHECK_IN_FREQUENCY_SECS / 2;

        set_global_time(&aptos_framework, last_check_in_time + CLAIM_WINDOW_SECS - 1);

        claim(&friend1, tontine);
    }

    #[expected_failure(abort_code = 196743, location = Self)]
    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_cannot_claim_outside_of_claim_window(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        let tontine = create_tontine_only_one_remains(&creator, &friend1, &friend2, &aptos_framework);

        // This is when friend1 last checked in.
        let last_check_in_time = START_TIME + CHECK_IN_FREQUENCY_SECS + CHECK_IN_FREQUENCY_SECS / 2;

        set_global_time(&aptos_framework, last_check_in_time + CLAIM_WINDOW_SECS + 1);

        claim(&friend1, tontine);
    }

    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_execute_fallback(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        let tontine = create_tontine_no_one_remains(&creator, &friend1, &friend2, &aptos_framework);
        execute_fallback(tontine);
    }

    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_destroy_staging(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        let tontine = create_tontine(&creator, &friend1, &friend2, &aptos_framework);

        // Contribute some funds.
        contribute(&friend1, tontine, 1000);

        destroy(&creator, tontine);
    }

    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_destroy_claimed(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        let tontine = create_tontine_only_one_remains(&creator, &friend1, &friend2, &aptos_framework);
        claim(&friend1, tontine);
        destroy(&creator, tontine);
    }

    #[test(creator = @0x123, friend1 = @0x456, friend2 = @0x789, aptos_framework = @aptos_framework)]
    fun test_destroy_fallback_executed(creator: signer, friend1: signer, friend2: signer, aptos_framework: signer) acquires Tontine {
        let tontine = create_tontine_no_one_remains(&creator, &friend1, &friend2, &aptos_framework);
        execute_fallback(tontine);
        destroy(&creator, tontine);
    }
}

