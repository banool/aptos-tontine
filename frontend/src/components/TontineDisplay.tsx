import { Box, Text } from "@chakra-ui/react";
import { TontineMembership } from "../api/hooks/useGetTontineMembership";
import { useGetAccountResource } from "../api/hooks/useGetAccountResource";
import { getModuleId, useGlobalState } from "../GlobalState";
import { TontineActions } from "./TontineActions";
import { TontineInfo } from "./TontineInfo";

export function TontineDisplay({
  activeTontine,
}: {
  activeTontine: TontineMembership;
}) {
  const [state, _] = useGlobalState();

  const moduleId = getModuleId(state);

  const { isLoading, accountResource, error } = useGetAccountResource(
    activeTontine.tontine_address,
    `${moduleId}::Tontine`,
  );

  return (
    <Box>
      <Box p={3}>
        <TontineActions activeTontine={activeTontine} />
      </Box>
      <Box p={3}>
        <TontineInfo activeTontine={activeTontine} />
      </Box>
    </Box>
  );
}
