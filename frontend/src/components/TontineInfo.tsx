import { Box, Switch, Text, Flex, Heading } from "@chakra-ui/react";
import { TontineMembership } from "../api/hooks/useGetTontineMembership";
import { getModuleId, useGlobalState } from "../GlobalState";
import { useState } from "react";
import { simpleMapArrayToMap } from "../utils";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useGetAccountResources } from "../api/hooks/useGetAccountResources";
import { useGetMemberStatuses } from "../api/hooks/useGetMemberStatuses";
import { useGetOverallStatus } from "../api/hooks/useGetOverallStatus";
import { ContributionTable } from "./ContributionTable";
import { ConfigTable } from "./ConfigTable";
import { ActiveTontine } from "../pages/HomePage";

export function TontineInfo({
  activeTontine,
}: {
  activeTontine: ActiveTontine;
}) {
  const [state, _] = useGlobalState();
  const [showRaw, setShowRaw] = useState(false);

  const { account } = useWallet();

  const moduleId = getModuleId(state);

  const { data } = useGetAccountResources(activeTontine.address);

  const tontineResource = data?.find(
    (resource) => resource.type === `${moduleId}::Tontine`,
  );

  const objectResource = data?.find(
    (resource) => resource.type === "0x1::object::ObjectCore",
  );

  const resourcesLoaded =
    tontineResource !== undefined && objectResource !== undefined;

  const tontineData = tontineResource?.data as any;
  const objectData = objectResource?.data as any;

  const {
    isLoading: memberStatusesIsLoading,
    data: memberStatusesRaw,
    error: memberStatusesError,
  } = useGetMemberStatuses(activeTontine.address, {
    additionalQueryCriteria: tontineResource,
  });

  const {
    isLoading: overallStatusIsLoading,
    data: overallStatusRaw,
    error: overallStatusError,
  } = useGetOverallStatus(activeTontine.address, {
    additionalQueryCriteria: tontineResource,
  });
  const overallStatus: number | undefined = overallStatusRaw;

  const memberStatusesData = memberStatusesRaw?.data
    ? simpleMapArrayToMap(memberStatusesRaw.data)
    : undefined;

  const isLocked = tontineData?.locked_time_secs > 0;

  var body;
  if (!resourcesLoaded) {
    body = (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <Text>Loading...</Text>
      </Box>
    );
  } else if (showRaw) {
    body = (
      <Text>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </Text>
    );
  } else {
    body = (
      <Box p={5}>
        <Heading size="md">Member Info</Heading>
        <Box p={6} paddingLeft={3} paddingRight={3}>
          <ContributionTable
            tontineData={tontineData}
            objectData={objectData}
            overallStatus={overallStatus}
            memberStatusesData={memberStatusesData}
            isLocked={isLocked}
            userAddress={account?.address}
          />
        </Box>
        // todo show add / remove members
        <Heading size="md">Config</Heading>
        <Box p={6} paddingLeft={3} paddingRight={3}>
          <ConfigTable
            tontineData={tontineData}
            objectData={objectData}
            activeTontine={activeTontine}
            overallStatus={overallStatus}
            memberStatusesData={memberStatusesData}
            isLocked={isLocked}
            userAddress={account?.address}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box paddingLeft={3} paddingRight={3}>
      <Flex justifyContent="end" alignItems="center" paddingBottom={3}>
        <Text paddingEnd={2}>Raw</Text>
        <Switch
          size="lg"
          colorScheme="blue"
          isChecked={showRaw}
          onChange={() => setShowRaw((before) => !before)}
        />
      </Flex>
      {body}
    </Box>
  );
}
