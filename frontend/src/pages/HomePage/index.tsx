import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Box } from "@chakra-ui/react";
import { TontineList } from "../../components/TontineList";

export const HomePage = () => {
  const { connected } = useWallet();

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Box p={5}>
      <Box display="flex">
        <Box flex="3" bg="blue.500" height="100vh">
          <TontineList />
        </Box>
        <Box flex="7" bg="green.500" height="100vh">
          This is the 70% column
        </Box>
      </Box>
    </Box>
  );
};
