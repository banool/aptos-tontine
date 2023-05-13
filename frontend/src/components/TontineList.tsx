import { Box, Text, Spinner, Heading } from "@chakra-ui/react";
import { useGetTontineMembership } from "../api/hooks/useGetTontineMembership";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { TontineListCard } from "./TontineListCard";

export function TontineList({
  activeAddress,
  setActiveAddress,
}: {
  activeAddress: string | null;
  setActiveAddress: (i: string | null) => void;
}) {
  const { connected } = useWallet();

  const {
    data: tontineMembershipData,
    isLoading: tontineMembershipIsLoading,
    error: tontineMembershipError,
  } = useGetTontineMembership();

  var body;
  if (!connected) {
    body = (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <Text>Connect your wallet</Text>
      </Box>
    );
  } else if (tontineMembershipIsLoading) {
    body = (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <Spinner />
      </Box>
    );
  } else if (tontineMembershipError) {
    body = <Text>{`Error fetching tontines: ${tontineMembershipError}`}</Text>;
  } else {
    var creatorCards = [];
    var otherCards = [];
    // Loop through tontineMembershipData and create cards for each tontine. Put each
    // card in each list based on is_creator.
    for (let i = 0; i < tontineMembershipData!.length; i++) {
      const tontine = tontineMembershipData![i];
      const address = tontine.tontine_address;
      const card = (
        <Box key={i} onClick={() => setActiveAddress(address)}>
          <TontineListCard
            tontine={tontine}
            active={activeAddress !== null && activeAddress === address}
          />
        </Box>
      );
      if (tontine.is_creator) {
        creatorCards.push(card);
      } else {
        otherCards.push(card);
      }
    }

    if (creatorCards.length > 0 && otherCards.length > 0) {
      body = (
        <Box>
          <Heading size="md">Tontines you created</Heading>
          <Box>{creatorCards}</Box>
          <Heading size="md">Tontines you're a member of</Heading>
          <Box>{otherCards}</Box>
        </Box>
      );
    } else {
      body = <Box>{creatorCards.concat(otherCards)}</Box>;
    }
  }

  return body;
}
