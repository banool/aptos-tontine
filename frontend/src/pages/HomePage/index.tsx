import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { TontineList } from "../../components/TontineList";
import { useState } from "react";
import { TontineMembership } from "../../api/hooks/useGetTontineMembership";
import { TontineDisplay } from "../../components/TontineDisplay";

export const HomePage = () => {
  const { connected } = useWallet();

  const [activeTontine, setActiveTontine] = useState<TontineMembership | null>(
    null,
  );

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Note: If there are more tontines than fit in a single screen, they overflow
  // beyond the end of the sidebar box downward. I have not been able to fix it.
  return (
    <Flex p={5} height="100%" flex="1" overflow="auto">
      <Box flex="3" bg="blue.500">
        <TontineList
          activeTontine={activeTontine}
          setActiveTontine={setActiveTontine}
        />
      </Box>
      <Box flex="7" bg="green.500">
        {activeTontine ? (
          <TontineDisplay activeTontine={activeTontine} />
        ) : (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="100%"
          >
            <Text>Select a tontine to view</Text>
          </Box>
        )}
      </Box>
    </Flex>
  );
};
