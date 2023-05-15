import {
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Heading,
  Tooltip,
  Flex,
  Button,
  useDisclosure,
  FormControl,
  FormLabel,
  NumberInput,
  Spinner,
  useToast,
  Text,
  NumberInputField,
  Spacer,
  Link,
} from "@chakra-ui/react";
import { TontineMembership } from "../api/hooks/useGetTontineMembership";
import {
  aptToOcta,
  getContributionAmount,
  getShortAddress,
  interleave,
  octaToApt,
  octaToAptNormal,
  simpleMapArrayToMap,
} from "../utils";
import { useGetAccountResource } from "../api/hooks/useGetAccountResource";
import { getModuleId, useGlobalState } from "../GlobalState";
import { getAnsName } from "../api";
import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  checkIn,
  claim,
  contribute,
  leave,
  lock,
  withdraw,
} from "../api/transactions";
import { useGetMemberStatuses } from "../api/hooks/useGetMemberStatuses";
import { useGetOverallStatus } from "../api/hooks/useGetOverallStatus";
import {
  MEMBER_STATUS_CAN_CLAIM_FUNDS,
  MEMBER_STATUS_STILL_ELIGIBLE,
  OVERALL_STATUS_CANCELLED,
  OVERALL_STATUS_FALLBACK_EXECUTED,
  OVERALL_STATUS_FUNDS_CLAIMABLE,
  OVERALL_STATUS_FUNDS_CLAIMED,
  OVERALL_STATUS_LOCKED,
  OVERALL_STATUS_STAGING,
} from "../constants";

export function HomeActions({}: {}) {
  const { connected } = useWallet();

  var createDisabled = !connected;
  var createTooltip = connected ? null : "Please connect your wallet.";

  return (
    <Box display="flex" flexDirection="column">
      <Box p={7}>
        <Flex alignItems="center" gap="4">
          <Heading size="sm">Actions:</Heading>
          <Tooltip label={createTooltip}>
            <Button
              colorScheme="blue"
              isDisabled={createDisabled}
              //onClick={}
            >
              Create a Tontine
            </Button>
          </Tooltip>
          <Link href="https://github.com/banool/aptos-tontine" target="_blank">
            <Button colorScheme="blue">Learn More</Button>
          </Link>
        </Flex>
      </Box>
    </Box>
  );
}
