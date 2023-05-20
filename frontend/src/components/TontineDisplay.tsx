import { Box, CloseButton, Flex, Spacer, Text } from "@chakra-ui/react";
import { TopLevelActions } from "./TopLevelActions";
import { TontineInfo } from "./TontineInfo";
import { ActiveTontine } from "../pages/HomePage";

export function TontineDisplay({
  activeTontine,
  setActiveTontine,
}: {
  activeTontine: ActiveTontine;
  setActiveTontine: (tontine: ActiveTontine | null) => void;
}) {
  return (
    <Box>
      <Box>
        <Flex alignItems={"center"}>
          <TopLevelActions activeTontine={activeTontine} />
          <Spacer />
          <Box paddingRight={5}>
            <CloseButton
              size="md"
              bg="red.500"
              onClick={() => setActiveTontine(null)}
            />
          </Box>
        </Flex>
      </Box>
      <Box p={3}>
        <TontineInfo activeTontine={activeTontine} />
      </Box>
    </Box>
  );
}
