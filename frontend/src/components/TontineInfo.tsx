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
  MEMBER_STATUS_INELIGIBLE,
  MEMBER_STATUS_STILL_ELIGIBLE,
} from "../constants";

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
  } = useGetMemberStatuses(activeTontine.tontine_address);

  const {
    isLoading: overallStatusIsLoading,
    data: overallStatusRaw,
    error: overallStatusError,
  } = useGetOverallStatus(activeTontine.tontine_address);
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
  var finalRow = isLocked ? "Last check in" : "Reconfirmation required";

  console.log("object data", objectData);

  const members = tontineData.config.members;

  const { data: names } = useGetAnsNames(() => members);

  const contributions: Map<string, any> = simpleMapArrayToMap(
    tontineData.contributions.data,
  );
  const lastCheckIns: Map<string, any> = simpleMapArrayToMap(
    tontineData.last_check_in_times_secs.data,
  );
  const reconfirmationRequiredAddresses = tontineData.reconfirmation_required;

  var rows = [];
  for (var i = 0; i < members.length; i++) {
    const memberAddress = members[i];
    const ansLookup = names?.find((lookup) => lookup.address === memberAddress);
    const contribution = contributions.get(memberAddress)?.value ?? 0;
    const lastCheckIn = lastCheckIns.get(memberAddress)?.value;
    const isUser = memberAddress === userAddress;
    const isCreator = memberAddress === objectData.owner;
    const memberStatus = memberStatusesData?.get(memberAddress);
    var nameText;
    var label;
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
    if (isCreator) {
      memberText += " (creator)";
    }
    const lastCheckInText =
      lastCheckIn === undefined
        ? "Never"
        : new Date(lastCheckIn * 1000).toLocaleString();
    const reconfirmationRequired =
        reconfirmationRequiredAddresses.includes(memberAddress),
      isFinalRow = i === members.length - 1;
    const reconfirmationRequiredText = reconfirmationRequired ? "Yes" : "No";
    var finalRowText;
    if (isLocked) {
      finalRowText = lastCheckInText;
    } else {
      finalRowText = reconfirmationRequiredText;
    }

    var additionalRow = null;
    if (isLocked) {
      var text;
      if (memberStatus === MEMBER_STATUS_STILL_ELIGIBLE) {
        text = "Yes";
      } else if (memberStatus === MEMBER_STATUS_INELIGIBLE) {
        text = "No";
      } else if (memberStatus === MEMBER_STATUS_CAN_CLAIM_FUNDS) {
        text = "Can claim";
      } else {
        text = "Failed to claim";
      }
      additionalRow = <Td>{text}</Td>;
    }

    const row = (
      <Tr key={memberAddress}>
        <Td>
          <Tooltip label={label}>{memberText}</Tooltip>
        </Td>
        <Td isNumeric>{octaToAptNormal(contribution)}</Td>
        <Td>{finalRowText}</Td>
        {additionalRow}
      </Tr>
    );
    rows.push(row);
  }

  const additionalRowHeader = isLocked ? <Th>Still elgible</Th> : null;

  return (
    <TableContainer>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Member</Th>
            <Th isNumeric>Contribution (APT)</Th>
            <Th>{finalRow}</Th>
            {additionalRowHeader}
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
            <Tooltip label={label}>{text}</Tooltip>
          </Td>
        </Tr>
        <Tr>
          <Th>Description</Th>
          <Td>{tontineData.config.name}</Td>
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
