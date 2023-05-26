spec addr::tontine07 {
    spec module {
        pragma verify = true;
        // pragma aborts_if_is_strict;
    }

    // The best approach is to specify all the ways stuff _can_ abort and then the
    // prover will assert that those are indeed the only abort cases.

    /*
    spec schema TimeExists {
        aborts_if !exists<std::timestamp::CurrentTimeMicroseconds>(@aptos_framework);
    }

    // Verify that a tontine exists.
    spec schema TontineExists {
        addr: address;
        //aborts_if !exists<object::ObjectCore>(addr);
        aborts_if !exists<Tontine>(addr);
    }

    // Verify that get_member_statuses is always of the same length as members.
    spec get_member_statuses {
        let tontine_addr = object::object_address(tontine);
        include TontineExists {addr: tontine_addr};
        include TimeExists;
        // This function should never abort if the above invariants hold.
        aborts_if false;
    }
    */

    /*
    // From simple_map::add in get_member_statuses
    // Calling impure function not allowed?
    spec {
        assert !simple_map::contains_key(statuses, member);
    };
    */

    // How do I verify the return value of view functions?

    /*
    spec create {
        aborts_if vector::length(invitees) == 0;
    }
    */
}
