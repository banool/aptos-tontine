import {
  Box,
  Switch,
  Text,
  Flex,
  TableContainer,
  Table,
  TableCaption,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  Tooltip,
  Heading,
} from "@chakra-ui/react";
import { TontineMembership } from "../api/hooks/useGetTontineMembership";
import { useGetAccountResource } from "../api/hooks/useGetAccountResource";
import { getModuleId, useGlobalState } from "../GlobalState";
import { useState } from "react";
import {
  getContributionAmount,
  getShortAddress,
  octaToAptNormal,
  simpleMapArrayToMap,
} from "../utils";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useGetAnsNames } from "../api/hooks/useGetAnsName";
import { useGetAccountResources } from "../api/hooks/useGetAccountResources";
import { useGetMemberStatuses } from "../api/hooks/useGetMemberStatuses";
import { useGetOverallStatus } from "../api/hooks/useGetOverallStatus";
import {
  MEMBER_STATUS_CAN_CLAIM_FUNDS,
  MEMBER_STATUS_CLAIMED_FUNDS,
  MEMBER_STATUS_INELIGIBLE,
  MEMBER_STATUS_READY,
  MEMBER_STATUS_STILL_ELIGIBLE,
} from "../constants";
import { SelectableTooltip } from "./SelectableTooltip";

export function TontineInfo({
  activeTontine,
}: {
  activeTontine: TontineMembership;
}) {
  const [state, _] = useGlobalState();
  const [showRaw, setShowRaw] = useState(false);

  const { account } = useWallet();

  const moduleId = getModuleId(state);

  const { data } = useGetAccountResources(activeTontine.tontine_address);

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
  } = useGetMemberStatuses(activeTontine.tontine_address, {
    additionalQueryCriteria: tontineResource,
  });

  const {
    isLoading: overallStatusIsLoading,
    data: overallStatusRaw,
    error: overallStatusError,
  } = useGetOverallStatus(activeTontine.tontine_address, {
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
            userAddress={account!.address}
          />
        </Box>
        <Heading size="md">Config</Heading>
        <Box p={6} paddingLeft={3} paddingRight={3}>
          <ConfigTable
            tontineData={tontineData}
            objectData={objectData}
            overallStatus={overallStatus}
            memberStatusesData={memberStatusesData}
            isLocked={isLocked}
            userAddress={account!.address}
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

export function ContributionTable({
  tontineData,
  objectData,
  overallStatus,
  memberStatusesData,
  isLocked,
  userAddress,
}: {
  tontineData: any;
  objectData: any;
  overallStatus: number | undefined;
  memberStatusesData: Map<string, number> | undefined;
  isLocked: boolean;
  userAddress: string;
}) {
  const members = tontineData.config.members;
  const { data: names } = useGetAnsNames(() => members);
  const contributions: Map<string, any> = simpleMapArrayToMap(
    tontineData.contributions.data,
  );
  const lastCheckIns: Map<string, any> = simpleMapArrayToMap(
    tontineData.last_check_in_times_secs.data,
  );
  const reconfirmationRequiredAddresses: string[] =
    tontineData.reconfirmation_required;
  const createdAt: number = parseInt(tontineData.creation_time_secs);
  const checkInFrequencySecs: number = parseInt(
    tontineData.config.check_in_frequency_secs,
  );

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  var thirdColumnHeader = isLocked ? (
    <Text>
      {"Last check in "}
      <sup>
        <Tooltip label={`Using timezone ${tz}`}>ⓘ</Tooltip>
      </sup>
    </Text>
  ) : (
    <Text>
      {"Reconfirmation required "}
      <sup>
        <Tooltip label="If the tontine creator invites / removes a member or changes the config in some way, all members must reconfirm their intent to be in the tontine.">
          ⓘ
        </Tooltip>
      </sup>
    </Text>
  );
  var fourthColumnHeader = isLocked ? (
    <Text>
      {"Must check in by "}
      <sup>
        <Tooltip label={`Using timezone ${tz}`}>ⓘ</Tooltip>
      </sup>
    </Text>
  ) : (
    <Text>Ready</Text>
  );
  var fifthColumnHeader = isLocked ? <Text>Still eligible</Text> : null;

  var rows = [];
  for (var i = 0; i < members.length; i++) {
    const memberAddress = members[i];
    const ansLookup = names?.find((lookup) => lookup.address === memberAddress);
    const lastCheckInRaw = lastCheckIns.get(memberAddress);
    const lastCheckIn = lastCheckInRaw ? parseInt(lastCheckInRaw) : undefined;
    const isUser = memberAddress === userAddress;
    const memberStatus = memberStatusesData?.get(memberAddress);
    var nameText;
    var label;

    // First column.
    if (ansLookup?.name) {
      nameText = `${ansLookup.name}.apt`;
      label = memberAddress;
    } else {
      nameText = getShortAddress(memberAddress);
      label = memberAddress;
    }
    var memberText = nameText;
    if (isUser) {
      memberText += " (you)";
    }
    /*
    if (isCreator) {
      memberText += " (creator)";
    }
    */

    // Second column.
    const contribution = contributions.get(memberAddress)?.value ?? 0;

    // Third column.
    const lastCheckInText =
      lastCheckIn === undefined
        ? "Never"
        : new Date(lastCheckIn * 1000).toLocaleString();
    const reconfirmationRequired =
      reconfirmationRequiredAddresses.includes(memberAddress);
    const reconfirmationRequiredText = reconfirmationRequired ? "Yes" : "No";
    var thirdColumnText;
    if (isLocked) {
      thirdColumnText = lastCheckInText;
    } else {
      thirdColumnText = reconfirmationRequiredText;
    }
    const thirdColumnComponent = <Text>{thirdColumnText}</Text>;

    // Fourth column.
    var fourthColumnComponent;
    if (!isLocked) {
      var isReadyText;
      if (memberStatus === undefined) {
        isReadyText = "Loading...";
      } else if (memberStatus === MEMBER_STATUS_READY) {
        isReadyText = "Yes";
      } else {
        isReadyText = "No";
      }
      fourthColumnComponent = <Text>{isReadyText}</Text>;
    } else {
      const nextCheckIn = (lastCheckIn ?? createdAt) + checkInFrequencySecs;
      console.log("nextCheckIn", nextCheckIn);
      const nextCheckInText = new Date(nextCheckIn * 1000).toLocaleString();
      fourthColumnComponent = <Text>{nextCheckInText}</Text>;
    }

    // Fifth column.
    var fifthColumnComponent = null;
    if (isLocked) {
      var text;
      if (memberStatus === undefined) {
        text = "Loading...";
      } else if (memberStatus === MEMBER_STATUS_STILL_ELIGIBLE) {
        text = "Yes";
      } else if (memberStatus === MEMBER_STATUS_INELIGIBLE) {
        text = "No";
      } else if (memberStatus === MEMBER_STATUS_CAN_CLAIM_FUNDS) {
        text = "Can claim";
      } else if (memberStatus === MEMBER_STATUS_CLAIMED_FUNDS) {
        text = "Claimed funds";
      } else {
        text = "Failed to claim";
      }
      fifthColumnComponent = <Text>{text}</Text>;
    }

    const row = (
      <Tr key={memberAddress}>
        <Td>
          <SelectableTooltip
            label={label}
            textComponent={<Text>{memberText}</Text>}
          />
        </Td>
        <Td isNumeric>{`${octaToAptNormal(contribution)} APT`}</Td>
        <Td>{thirdColumnComponent}</Td>
        <Td>{fourthColumnComponent}</Td>
        {fifthColumnComponent ? <Td>{fifthColumnComponent}</Td> : null}
      </Tr>
    );
    rows.push(row);
  }

  return (
    <TableContainer>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Member</Th>
            <Th isNumeric>Contribution</Th>
            <Th>{thirdColumnHeader}</Th>
            <Th>{fourthColumnHeader}</Th>
            {fifthColumnHeader ? <Th>{fifthColumnHeader}</Th> : null}
          </Tr>
        </Thead>
        <Tbody>{rows}</Tbody>
      </Table>
    </TableContainer>
  );
}

export function ConfigTable({
  tontineData,
  objectData,
  overallStatus,
  memberStatusesData,
  isLocked,
  userAddress,
}: {
  tontineData: any;
  objectData: any;
  overallStatus: number | undefined;
  memberStatusesData: Map<string, number> | undefined;
  isLocked: boolean;
  userAddress: string;
}) {
  const creatorAddress = objectData.owner;
  const { data: names } = useGetAnsNames(() => [creatorAddress]);
  const ansLookup = names?.find((lookup) => lookup.address === creatorAddress);
  var text;
  var label;
  if (ansLookup?.name) {
    text = `${ansLookup.name}.apt`;
    label = creatorAddress;
  } else {
    text = getShortAddress(creatorAddress);
    label = creatorAddress;
  }

  return (
    <Table variant="simple">
      <Tbody>
        <Tr>
          <Th>Creator</Th>
          <Td>
            <SelectableTooltip
              textComponent={<Text>{text}</Text>}
              label={label}
            />
          </Td>
        </Tr>
        <Tr>
          <Th>Description</Th>
          <Td>{tontineData.config.description}</Td>
        </Tr>
        <Tr>
          <Th>Required check in frequency</Th>
          <Td>{`Every ${tontineData.config.check_in_frequency_secs} secs`}</Td>
        </Tr>
        <Tr>
          <Th>Required contribution per member</Th>
          <Td>{`${octaToAptNormal(
            tontineData.config.per_member_amount_octa,
          )} APT`}</Td>
        </Tr>
        {/* Add more rows as needed */}
      </Tbody>
    </Table>
  );
}
