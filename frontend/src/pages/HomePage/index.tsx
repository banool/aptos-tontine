import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Box } from "@chakra-ui/react";
import { TontineList } from "../../components/TontineList";
import { useState } from "react";

export const HomePage = () => {
  const { connected } = useWallet();

  const [activeAddress, setActiveAddress] = useState<string | null>(null);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Box p={5}>
      <Box display="flex">
        <Box flex="3" bg="blue.500" height="100vh">
          <TontineList
            activeAddress={activeAddress}
            setActiveAddress={setActiveAddress}
          />
        </Box>
        <Box flex="7" bg="green.500" height="100vh">
          This is the 70% column
        </Box>
      </Box>
    </Box>
  );
};
