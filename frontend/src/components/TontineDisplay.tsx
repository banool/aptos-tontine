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
