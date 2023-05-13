import {
  Box,
  Text,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Tooltip,
} from "@chakra-ui/react";
import { TontineMembership } from "../api/hooks/useGetTontineMembership";
import { getShortAddress, interleave } from "../utils";
import { useGetAccountResource } from "../api/hooks/useGetAccountResource";
import { getModuleId, useGlobalState } from "../GlobalState";
import { getAnsName } from "../api";
import { useEffect, useState } from "react";
import { TontineActions } from "./TontineActions";

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
      <TontineActions activeTontine={activeTontine} />
      <Text>{JSON.stringify(accountResource)}</Text>
    </Box>
  );
}
