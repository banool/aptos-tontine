import { Box, Text, Spinner, Heading, Tooltip } from "@chakra-ui/react";
import {
  TontineMembership,
  useGetTontineMembership,
} from "../api/hooks/useGetTontineMembership";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { TontineListCard } from "./TontineListCard";

export function TontineList({
  activeTontine,
  setActiveTontine,
}: {
  activeTontine: TontineMembership | null;
  setActiveTontine: (a: TontineMembership | null) => void;
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
    var joinedCards = [];
    var invitedCards = [];
    // Loop through tontineMembershipData and create cards for each tontine. Put each
    // card in each list based on is_creator.
    for (let i = 0; i < tontineMembershipData!.length; i++) {
      const tontine = tontineMembershipData![i];
      const address = tontine.tontine_address;
      const card = (
        <Box key={i} onClick={() => setActiveTontine(tontine)}>
          <TontineListCard
            tontine={tontine}
            active={
              activeTontine !== null &&
              activeTontine.tontine_address === address
            }
          />
        </Box>
      );
      if (tontine.is_creator) {
        creatorCards.push(card);
      } else if (tontine.has_ever_contributed) {
        joinedCards.push(card);
      } else {
        invitedCards.push(card);
      }
    }

    body = (
      <Box paddingTop={2} paddingRight={3} paddingBottom={2}>
        <Heading
          paddingTop={6}
          paddingLeft={4}
          paddingRight={4}
          paddingBottom={3}
          size="md"
        >
          Your tontines
        </Heading>
        <Box>{creatorCards}</Box>
        <Heading
          paddingTop={6}
          paddingLeft={4}
          paddingRight={4}
          paddingBottom={3}
          size="md"
        >
          Tontines you've joined{" "}
          <sup>
            <Tooltip label="Tontines you have ever contributed to.">ⓘ</Tooltip>
          </sup>
        </Heading>
        <Box>{joinedCards}</Box>
        <Heading
          paddingTop={6}
          paddingLeft={4}
          paddingRight={4}
          paddingBottom={3}
          size="md"
        >
          Tontine invitations{" "}
          <sup>
            <Tooltip label="Tontines other people have added you to but you've never contributed to yet.">
              ⓘ
            </Tooltip>
          </sup>
        </Heading>
        <Box>{invitedCards}</Box>
      </Box>
    );
  }

  return body;
}
