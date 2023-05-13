# Aptos Tontine
> Works of fiction ... often feature a variant model of the tontine in which the capital devolves upon the last surviving nominee, thereby dissolving the trust and potentially making the survivor very wealthy. It is unclear whether this model ever existed in the real world.

&mdash; _Tontine_, [Wikipedia](https://en.wikipedia.org/wiki/Tontine#In_popular_culture)

<p align="center">
  <img src="misc/simpsons_tontine.png?raw=true" width="60%" alt="Simpsons Tontine">
</p>

&mdash; _Raging Abe Simpson and His Grumbling Grandson in 'The Curse of the Flying Hellfish'_, [Wikipedia](https://en.wikipedia.org/wiki/Raging_Abe_Simpson_and_His_Grumbling_Grandson_in_%27The_Curse_of_the_Flying_Hellfish%27)


## Summary
The tontine described here is a variant of the standard tontine that works as described above. In this scheme, people invest funds into a shared fund. It remains locked in the fund until only one member of the tontine remains.

Organizing a tontine on-chain has a variety of interesting properties, be them advantages or disadvantages:
- In traditional tontines it is difficult to devise a mechanism where the funds can only be retrieved once one member remains. This is easily enforced on chain.
- Aptos accounts need not necessarily be owned by a single individual. To avoid [wrench attacks](https://www.explainxkcd.com/wiki/index.php/538:_Security) they may use a multisigner account, either shared with other individuals, or just sharded in a way that makes it hard for another party to get the full key.
- Aptos accounts do not strictly map to a single indvidiual (though a custodial [DID](https://www.w3.org/TR/did-core/) + KYC solution might). This has interesting implications. For example, a tontine could theoretically outlast generations, with accounts being handed down throughout time.

Make sure you understand these properties before taking part in a tontine organized through this Move module.

## Standard tontine lifecycle
A tontine using this Move module proceeds through the following lifecycle.

### Creator establishes a "staging" tontine
Alice creates a "staging" tontine. In this she specifies:

- Members (addresses) to be included in the tontine.
- How much each member should contribute to the tontine.
- How often each member must check in to prove they're still in control of their account (see below).
- What happens if no one checks in within an interval. Options include:
  - All funds get returned to the original accounts.
  - Funds go to a preconfigured arbitrary account.
  - Funds are burned (or locked up forever).

This corresponds to `OVERALL_STATUS_STAGING`.

### Everyone commits funds to the tontine
Once the staging tontine has been created, each member commits funds to it.

Once this is complete, this corresponds to `OVERALL_STATUS_CAN_BE_LOCKED`.

### A member locks the tontine
Once all members have committed their funds to the tontine (and only then), any member of the tontine can lock it (not just the original creator).

This corresponds to `OVERALL_STATUS_LOCKED`.

### Members check in with the tontine
To prove that a member is still in control of their account / alive, they must check in periodically with the tontine. Given this costs gas, ideally this is infrequent, e.g. once every few months.

### All members but one fail to check in
Over time, members will cease checking in and eventually all but one will become ineligible to claim the funds. From this point, the last member standing is able to claim the funds up until their next latest check in time + the grace period.

This corresponds to `OVERALL_STATUS_FUNDS_CLAIMABLE`.

### The last member standing claims the funds
The last standing member claims the funds.

This corresponds to `OVERALL_STATUS_FUNDS_CLAIMED`.

## Irregular lifecycle events
Above describes the standard flow, there are other lifecycle events that may occur.

### The creator adds a new member to a staging tontine
While a tontine is in the staging state, the creator may choose to add a new member to the tontine. This will trigger a "reconfirmation" (see below).

### The creator removes a member from a staging tontine
While a tontine is in the staging state, the creator may choose to remove a new member from the tontine. If they have contributed funds, this will return their funds to them. This will trigger a "reconfirmation" (see below).

### A member chooses to leave a staging tontine
While a tontine is in the staging state, any member may choose to withdraw from the tontine. If they have contributed funds, this will return their funds to them. This will revoke their ability to re-enter the tontine and trigger a "reconfirmation" (see below).

If the creator leaves a staging tontine, this will cancel the tontine completely and return any funds to the members, which corresponds to `OVERALL_STATUS_CANCELLED`.

### The creator alters a configuration value
It is possible to change some configuration values (anything in `TontineConfig`) while the tontine is in the staging state. If this happens it triggers a "reconfirmation" (see below).

### Reconfirmation
If a member is added or leaves a staging tontine, a reconfirmation is triggered. If this happens, all members must call `reconfirm` to indicate that they still want to be part of the tontine given the recent changes. This mechanism exists to ensure that a tontine isn't changed and then locked at the final hour under the noses of the members.

### No one claims the funds
Throughout the course of the tontine eventually one member will be the last one who checked in during the check in window. However, if that member fails to claim the funds after this point + the grace period, the tontine will transition into fallback mode, in which case anyone (not just those in the tontine) may execute the fallback policy.

This initially corresponds to `OVERALL_STATUS_FUNDS_NEVER_CLAIMED` and then `OVERALL_STATUS_FALLBACK_EXECUTED`

## FAQ
Q: Can I make the tontine with assets besides APT?
A: For now, no, but I'm considering how you might do this: https://github.com/banool/aptos-tontine/issues/3.

Q: Is there a way to direct the account holding the tontine funds to take investment actions, such as using liquid staking or purchasing NFTs?
A: Not right now, but it's on the roadmap: https://github.com/banool/aptos-tontine/issues/1, https://github.com/banool/aptos-tontine/issues/2.

Q: In real life / fictional tontines, it is generally a rule that attempting to "take out" a member of the tontine would get you kicked out of the tontine, so as to discourage people forcibly making themselves the last member standing. How is this enforced with the Aptos tontine?
A: It is not. Theoretically a tontine could be created with governance attached, in which, if every other remaining member votes to do so, they could kick a member out of the tontine (except in the case where only 2 members remain remaining case). This could obviously lead to all kinds of off chain collusion / corruption however, so for now I've chosen to leave this is an unsolved problem.
