import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { TontineList } from "../../components/TontineList";
import { useEffect, useState } from "react";
import { TontineMembership } from "../../api/hooks/useGetTontineMembership";
import { TontineDisplay } from "../../components/TontineDisplay";
import { useGlobalState } from "../../GlobalState";

export const HomePage = () => {
  const { connected, network } = useWallet();
  const [state, _] = useGlobalState();

  const [activeTontine, setActiveTontine] = useState<TontineMembership | null>(
    null,
  );

  // TODO: This never gets triggered.
  useEffect(() => {
    console.log("blahhhhhhhh");
    if (!connected) {
      setActiveTontine(null);
    }
  }, [connected]);

  console.log("connected: ", connected);
  console.log("activeTontine: ", activeTontine);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (
    network &&
    network.name.toLowerCase() !== state.network_name.toLowerCase()
  ) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <Text>Please switch your wallet to {state.network_name}</Text>
      </Box>
    );
  }

  // Note: If there are more tontines than fit in a single screen, they overflow
  // beyond the end of the sidebar box downward. I have not been able to fix it.
  return (
    <Flex p={5} height="100%" flex="1" overflow="auto">
      <Box flex="25" borderRight="1px">
        <TontineList
          activeTontine={activeTontine}
          setActiveTontine={setActiveTontine}
        />
      </Box>
      <Box flex="75">
        {activeTontine ? (
          <TontineDisplay activeTontine={activeTontine} />
        ) : (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="100%"
          >
            <Text>{connected ? "Select a tontine to view" : ""}</Text>
          </Box>
        )}
      </Box>
    </Flex>
  );
};
