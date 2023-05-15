import { Box, CloseButton, Flex, Spacer, Text } from "@chakra-ui/react";
import { TontineMembership } from "../api/hooks/useGetTontineMembership";
import { useGetAccountResource } from "../api/hooks/useGetAccountResource";
import { getModuleId, useGlobalState } from "../GlobalState";
import { TontineActions } from "./TontineActions";
import { TontineInfo } from "./TontineInfo";

export function TontineDisplay({
  activeTontine,
  setActiveTontine,
}: {
  activeTontine: TontineMembership;
  setActiveTontine: (tontine: TontineMembership | null) => void;
}) {
  return (
    <Box>
      <Box>
        <Flex alignItems={"center"}>
          <TontineActions activeTontine={activeTontine} />
          <Spacer />
          <CloseButton
            size="md"
            bg="red.500"
            onClick={() => setActiveTontine(null)}
          />
        </Flex>
      </Box>
      <Box p={3}>
        <TontineInfo activeTontine={activeTontine} />
      </Box>
    </Box>
  );
}
