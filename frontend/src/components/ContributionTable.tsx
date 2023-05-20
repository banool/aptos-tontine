import {
  Text,
  TableContainer,
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  Tooltip,
} from "@chakra-ui/react";
import {
  getShortAddress,
  octaToAptNormal,
  simpleMapArrayToMap,
} from "../utils";
import { useGetAnsNames } from "../api/hooks/useGetAnsName";
import {
  MEMBER_STATUS_CAN_CLAIM_FUNDS,
  MEMBER_STATUS_CLAIMED_FUNDS,
  MEMBER_STATUS_INELIGIBLE,
  MEMBER_STATUS_READY,
  MEMBER_STATUS_STILL_ELIGIBLE,
  OVERALL_STATUS_FALLBACK_EXECUTED,
  OVERALL_STATUS_FUNDS_CLAIMED,
  OVERALL_STATUS_FUNDS_NEVER_CLAIMED,
} from "../constants";
import { SelectableTooltip } from "./SelectableTooltip";

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
  userAddress: string | undefined;
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
  const isTerminal =
    overallStatus === OVERALL_STATUS_FUNDS_CLAIMED ||
    overallStatus === OVERALL_STATUS_FUNDS_NEVER_CLAIMED ||
    overallStatus === OVERALL_STATUS_FALLBACK_EXECUTED;

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
    } else if (isTerminal) {
      fourthColumnComponent = <Text>N/A</Text>;
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
        text = "Funds claimed";
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
