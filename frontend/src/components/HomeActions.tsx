import {
  Box,
  Heading,
  Tooltip,
  Flex,
  Button,
  Spacer,
  Link,
  CloseButton,
} from "@chakra-ui/react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

export function HomeActions({
  showingCreateComponent,
  setShowingCreateComponent,
}: {
  showingCreateComponent: boolean;
  setShowingCreateComponent: (b: boolean) => void;
}) {
  const { connected } = useWallet();

  var createDisabled = !connected || showingCreateComponent;
  var createTooltip = connected ? null : "Please connect your wallet.";

  var closeButtonComponent = (
    <>
      <Spacer />
      <Box paddingRight={5}>
        <CloseButton
          size="md"
          bg="red.500"
          onClick={() => setShowingCreateComponent(false)}
        />
      </Box>
    </>
  );

  return (
    <Box display="flex" flexDirection="column">
      <Box p={7}>
        <Flex alignItems="center" gap="4">
          <Heading size="sm">Actions:</Heading>
          <Tooltip label={createTooltip}>
            <Button
              colorScheme="blue"
              isDisabled={createDisabled}
              onClick={() => setShowingCreateComponent(true)}
            >
              Create a Tontine
            </Button>
          </Tooltip>
          <Link href="https://github.com/banool/aptos-tontine" target="_blank">
            <Button colorScheme="blue">Learn More</Button>
          </Link>
          {showingCreateComponent ? closeButtonComponent : null}
        </Flex>
      </Box>
    </Box>
  );
}
