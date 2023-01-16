// Copyright (c) Daniel Porteous
// SPDX-License-Identifier: Apache-2.0

//! See the README for more information about how this tontine module works.

module addr::tontine {
    use std::string;
    use std::error;
    use std::signer;
    use std::vector;
    use aptos_std::simple_map::SimpleMap;

    const E_NOT_INITIALIZED: u64 = 1;

    /// Used for assertions in tests.
    #[test_only]
    const E_TEST_FAILURE: u64 = 100;

    /// todo
    struct Tontine has key {
        /// The parameters used to configure initial creation of the tontine.
        config: TontineConfig,

        /// The time (unixtime in secs) at which the tontine was created.
        creation_time_secs: u64,

        /// The coins from each member.
        coins: SimpleMap<address, AptosCoin>,

        /// The time (unixtime in secs) at which the tontine was locked. This will be
        /// zero until the tontine is locked.
        locked_time_secs: u64,

        /// The time (unixtime in secs) at which the assets in the tontine were claimed.
        /// This will be zero until that happens.
        locked_time_secs: u64,

        /// The last time (unixtime in secs) each member of the tontine checked in.
        last_check_in_times_secs: SimpleMap<address, u64>,
    }

    struct TontineConfig {
        /// Who (where identity is defined by account address) is party to the tontine.
        participants: vector<address>,

        /// How much each participant must contribute to the tontine.
        per_participant_amount_octa: u64,

        /// How often, in seconds, each participant must check-in to prove that they're
        /// still in control of their account.
        check_in_frequency_secs: u64,

        /// How long, in seconds, the window is where the last-standing member is able
        /// to claim the funds.
        claim_window_secs: u64,

        /// What happens if the last-standing member of the tontine fails to claim the
        /// funds within the claim window.
        fallback_policy: TontineFallbackPolicy
    }

    struct TontineFallbackPolicy has key {

    }

    struct TontineStore has key {
        tontines: SimpleMap<vector<u8>, Tontine>,
    }

    /// Initialize the list to the caller's account.
    public entry fun initialize_list(account: &signer) {
        let inner = Inner {
            links: simple_map::create(),
            secret_links: simple_map::create(),
            archived_links: simple_map::create(),
            archived_secret_links: simple_map::create(),
        };
        move_to(account, Root{inner: inner });
    }

    /*
    /// Delete everything, even there are still items. Use with extreme caution.
    public entry fun obliterate(account: &signer) acquires Root {
        let addr = signer::address_of(account);
        assert!(exists<Root>(addr), error::invalid_state(E_NOT_INITIALIZED));

        let root = move_from<Root>(addr);
        let Root { inner } = root;
        let Inner { links, secret_links, archived_links, archived_secret_links } = inner;
        dump_list(links);
        dump_list(secret_links);
        dump_list(archived_links);
        dump_list(archived_secret_links);
    }

    fun dump_list<K: copy + store + drop, V: drop + store>(list: simple_map::SimpleMap<K, V>) {
        let key = simple_map::head_key(&list);
        loop {
            if (option::is_none(&key)) {
                break
            };
            let (_v, _prev, next) = simple_map::remove_iter(&mut list, option::extract(&mut key));
            key = next;
        };
        simple_map::destroy_empty(list);
    }
    */

    /// Add a link to links. We don't bother handling collisions, we would just
    /// make it throw an error anyway.
    public entry fun add(account: &signer, url_raw: vector<u8>, tags_raw: vector<vector<u8>>, add_to_archive: bool) acquires Root {
        let addr = signer::address_of(account);
        assert!(exists<Root>(addr), error::invalid_state(E_NOT_INITIALIZED));

        let tags = vector::empty();

        let i = 0;
        while (i < vector::length(&tags_raw)) {
            vector::push_back(&mut tags, string::utf8(vector::pop_back(&mut tags_raw)));
            i = i + 1;
        };

        let link_data = LinkData {tags: tags};

        let inner = &mut borrow_global_mut<Root>(addr).inner;

        if (add_to_archive) {
            simple_map::add(&mut inner.archived_links, string::utf8(url_raw), link_data);
        } else {
            simple_map::add(&mut inner.links, string::utf8(url_raw), link_data);
        };
    }

    /// This is just a helper for testing mostly.
    public entry fun add_simple(account: &signer, url_raw: vector<u8>) acquires Root {
        add(account, url_raw, vector::empty(), false);
    }

    /// Add a link to secret_links. As above, we don't bother with collisions.
    public entry fun add_secret(account: &signer, url: vector<u8>, link_data: vector<u8>, add_to_archive: bool) acquires Root {
        let addr = signer::address_of(account);
        assert!(exists<Root>(addr), error::invalid_state(E_NOT_INITIALIZED));

        let addr = signer::address_of(account);
        let inner = &mut borrow_global_mut<Root>(addr).inner;

        if (add_to_archive) {
            simple_map::add(&mut inner.archived_secret_links, url, link_data);
        } else {
            simple_map::add(&mut inner.secret_links, url, link_data);
        };
    }

    /// Remove an item with the given key. We trust the user isn't trying to remove
    /// a key that isn't in their list. We opt to be cheeky here and use this function
    /// for all 4 different lists.
    public entry fun remove(account: &signer, url_raw: vector<u8>, from_archive: bool, from_secrets: bool) acquires Root {
        let addr = signer::address_of(account);
        assert!(exists<Root>(addr), error::invalid_state(E_NOT_INITIALIZED));

        let inner = &mut borrow_global_mut<Root>(addr).inner;

        if (from_secrets) {
            if (from_archive) {
                simple_map::remove(&mut inner.archived_secret_links, &url_raw);
            } else {
                simple_map::remove(&mut inner.secret_links, &url_raw);
            }
        } else {
            let url = string::utf8(url_raw);
            if (from_archive) {
                simple_map::remove(&mut inner.archived_links, &url);
            } else {
                simple_map::remove(&mut inner.links, &url);
            }
        };
    }

    /// Move an item to / from the archived version of that list.
    public entry fun set_archived(account: &signer, url_raw: vector<u8>, make_archived: bool, is_secret: bool) acquires Root {
        let addr = signer::address_of(account);
        assert!(exists<Root>(addr), error::invalid_state(E_NOT_INITIALIZED));

        let inner = &mut borrow_global_mut<Root>(addr).inner;

        if (is_secret) {
            if (make_archived) {
                let (key, item) = simple_map::remove(&mut inner.secret_links, &url_raw);
                simple_map::add(&mut inner.archived_secret_links, key, item);
            } else {
                let (key, item) = simple_map::remove(&mut inner.archived_secret_links, &url_raw);
                simple_map::add(&mut inner.secret_links, key, item);
            }
        } else {
            let url = string::utf8(url_raw);
            if (make_archived) {
                let (key, item) = simple_map::remove(&mut inner.links, &url);
                simple_map::add(&mut inner.archived_links, key, item);
            } else {
                let (key, item) = simple_map::remove(&mut inner.archived_links, &url);
                simple_map::add(&mut inner.links, key, item);
            }
        };
    }

    #[test(account = @0x123)]
    public entry fun test_add_remove_archive(account: signer) acquires Root {
        let addr = signer::address_of(&account);

        // Initialize a list on account.
        initialize_list(&account);
        assert!(exists<Root>(addr), error::internal(E_TEST_FAILURE));

        // Add a link.
        let url1 = b"https://google.com";
        add(&account, url1, vector::empty(), false);

        // Confirm that the link was added.
        let inner = &borrow_global<Root>(addr).inner;
        assert!(simple_map::length(&inner.links) == 1, error::internal(E_TEST_FAILURE));

        // Add another link.
        let url2 = b"https://yahoo.com";
        add(&account, url2, vector::empty(), false);

        // Confirm that there are two links now.
        let inner = &borrow_global<Root>(addr).inner;
        assert!(simple_map::length(&inner.links) == 2, error::internal(E_TEST_FAILURE));

        // Mark the second link as archived.
        set_archived(&account, url2, true, false);

        // Remove the link we added.
        remove(&account, url1, false, false);

        // Confirm that the standard list of links is now empty.
        let inner = &borrow_global<Root>(addr).inner;
        assert!(simple_map::length(&inner.links) == 0, error::internal(E_TEST_FAILURE));

        // Confirm that the other link is still there in the archived list.
        let inner = &borrow_global<Root>(addr).inner;
        assert!(simple_map::contains(&inner.archived_links, string::utf8(url2)), error::internal(E_TEST_FAILURE));

        // Confirm that even if there are items, we can destroy everything.
        obliterate(&account);
    }
}
