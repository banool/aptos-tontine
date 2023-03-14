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

- People (addresses) to be included in the tontine.
- How much each person should contribute to the tontine.
- How often people must check in to prove they're still in control of their account (see below).
- What happens if no one checks in within an interval. Options include:
    - All funds get returned to the original accounts.
    - Funds go to a preconfigured arbitrary account.

### Everyone commits funds to the tontine
Once the staging tontine has been created, people commit funds to it. So long as the tontine is in the staging period, people may withdraw their funds again if they want.

### A member locks the tontine
Once everyone has committed their funds to the tontine (and only then), any party to the tontine can lock it (not just the original creator).

### Members check in with the tontine
To prove that you're still in control of your account / alive, users must check in periodically with the tontine. Given this costs gas, ideally this is infrequent, e.g. every 3 months.

### The last member standing claims the funds
Over time, people will cease checking in and become ineligible to claim the tontine. Once only one eligible individual remains, they may redeem the total value of the tontine to their account.

## Irregular lifecycle events
Above describes the standard flow, there are other lifecycle events that may occur.

### Someone leaves a staging tontine
If someone decides part way through the establishment of a tontine that they don't want to participate in the tontine, they may withdraw. This will revoke their ability to re-enter the tontine.

### The creator cancels a staging tontine
If the creator decides part way through the establishment of a tontine that they don't want to proceed with the tontine, they may cancel it. Anyone who contributed their share will have that share returned to them.

### Someone new is added to a staging tontine
When you first add funds, you can clearly see who else was invited to the tontine. If someone new is added after this point (which is only possible prior to locking the tontine), you must confirm again that you wish to take part in the tontine. This mechanism exists to ensure that someone else isn't added without your knowledge, and gives you the opportunity to leave if you don't want to participate in the tontine given the new set of members.

### Someone is removed from a staging tontine
The creator may choose to remove someone from a staging tontine. If that person already contributed their share, it will be returned to them.

### No one claims the funds
Normally, once only one person remains who has checked in recently, they will claim the funds. However, there is a chance that they don't claim the funds within this window. In this case, the tontine will transition into fallback mode, in which case anyone (not just those in the tontine) may execute the fallback policy.

## FAQ
Q: Can I make the tontine with assets besides APT?
A: For now, no, but I'm considering how you might do this: https://github.com/banool/aptos-tontine/issues/3.

Q: Is there a way to direct the account holding the tontine funds to take investment actions, such as using liquid staking or purchasing NFTs?
A: Not right now, but it's on the roadmap: https://github.com/banool/aptos-tontine/issues/1, https://github.com/banool/aptos-tontine/issues/2.

Q: In real life / fictional tontines, it is generally a rule that attempting to "take out" a member of the tontine would get you kicked out of the tontine, so as to discourage people on forcibly making themselves the last member standing. How is this enforced with the Aptos tontine?
A: Currently, it is not. Theoretically a tontine could be created with a DAO attached, in which, if every other remaining member votes to do so, they could kick a member out of the DAO (except in the 2 people remaining case). This could obviously lead to all kinds of off chain collusion / corruption however, so for now I've chosen to leave this is an unsolved problem.
