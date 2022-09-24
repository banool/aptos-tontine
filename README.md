# Aptos Tontine
> Works of fiction ... often feature a variant model of the tontine in which the capital devolves upon the last surviving nominee, thereby dissolving the trust and potentially making the survivor very wealthy. It is unclear whether this model ever existed in the real world.

- [Tontine](https://en.wikipedia.org/wiki/Tontine#In_popular_culture), _Wikipedia_

## Summary

The tontine described here is a variant of the standard tontine that works as described above. In this scheme, people invest funds into a shared fund. It remains locked in the fund until only one member of the tontine remains.

Organizing a tontine on-chain has a variety of interesting properties, be them advantages or disadvantages:
- In traditional tontines it is difficult to devise a mechanism where the funds can only be retrieved once one member remains. This is easily enforced on chain.
- Aptos accounts need not necessarily be owned by a single individual. To avoid [wrench attacks](https://www.explainxkcd.com/wiki/index.php/538:_Security) they may use a multisigner account, either shared with other individuals, or just sharded in a way that makes it hard for another party to get the full key.
- Aptos accounts do not strictly map to a single indvidiual (though a custodial [DID](https://www.w3.org/TR/did-core/) solution might). This has interesting implications. For example, a tontine could theoretically outlast generations, with accounts being handed down throughout time.

## Tontine lifecycle
A tontine using this Move module works like this.

### Create a "staging" tontine
Alice creates a "staging" tontine. In this she specifies:

- People (addresses) to be included in the tontine.
- How often people must check in to prove they're still in control of their account (e.g. every 3 months).
- What happens if no one checks in within an interval. Options include:
    - All funds get returned to the original accounts.
    - Funds go to the person who checked in most recently.
    - Funds go to a preconfigured arbitrary account.

### Commit funds to the tontine
Once the staging tontine has been created, people commit funds to it. So long as the tontine is in the staging period, people may withdraw their funds again if they want.

### Lock the tontine
Once everyone has committed their funds to the tontine (and only then), Alice can lock it.

### Check in with the tontine
To prove that you're still in control of your account / alive, users must check in periodically with the tontine. Given this costs gas, ideally this is infrequent, e.g. every 3-12 months.

### Claim the funds
Over time, people will cease checking in and become ineligible to claim the tontine. Once only one eligible individual remains, they may redeem the total value of the tontine to their account. If it gets to this point, but the final person fails to claim the tontine within the window, the tontine will move into fallback mode, in which anyone (not just those in the tontine) may execute the fallback policy.

## FAQ
Q: Why can't I change the set of people after creating the tontine, even while staging?
A: If you could, you could wait for one person to add their funds, remove everyone else, and then lock the tontine, sealing away their funds against their original intentions.

