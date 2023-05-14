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

export function TontineActions({
  activeTontine,
}: {
  activeTontine: TontineMembership;
}) {
  const [state, _] = useGlobalState();

  const {
    isOpen: contributeIsOpen,
    onOpen: contributeOnOpen,
    onClose: contributeOnClose,
  } = useDisclosure();

  const {
    isOpen: withdrawIsOpen,
    onOpen: withdrawOnOpen,
    onClose: withdrawOnClose,
  } = useDisclosure();

  const { account, signAndSubmitTransaction } = useWallet();
  const toast = useToast();

  const moduleId = getModuleId(state);

  const [amountOctaFormField, setAmountOctaFormField] = useState(0);
  const [waitingForTransaction, updateWaitingForTransaction] = useState(false);

  const { isLoading, accountResource, error } = useGetAccountResource(
    activeTontine.tontine_address,
    `${moduleId}::Tontine`,
  );

  const tontineData = accountResource?.data as any;

  const {
    isLoading: memberStatusesIsLoading,
    data: memberStatusesRaw,
    error: memberStatusesError,
  } = useGetMemberStatuses(activeTontine.tontine_address, {
    enabled: accountResource !== undefined,
  });

  const {
    isLoading: overallStatusIsLoading,
    data: overallStatusRaw,
    error: overallStatusError,
  } = useGetOverallStatus(activeTontine.tontine_address, {
    enabled: accountResource !== undefined,
  });

  const memberStatusesData = memberStatusesRaw?.data
    ? simpleMapArrayToMap(memberStatusesRaw.data)
    : undefined;
  const memberStatus: number | undefined = memberStatusesData?.get(
    account!.address,
  );
  const overallStatus: number | undefined = overallStatusRaw;

  const contributionAmount = getContributionAmount(
    tontineData?.contributions,
    account!.address,
  );

  const remainingContribution = tontineData
    ? tontineData?.config.per_member_amount_octa - contributionAmount
    : 0;

  const handleContribute = async () => {
    updateWaitingForTransaction(true);

    try {
      // TODO: Make this configurable.
      await contribute(
        signAndSubmitTransaction,
        moduleId,
        state.network_value,
        activeTontine.tontine_address,
        amountOctaFormField,
      );
      // If we get here, the transaction was committed successfully on chain.
      toast({
        title: "Contributed funds to tontine",
        description: `Successfully contributed ${octaToAptNormal(
          amountOctaFormField,
        )} APT (${amountOctaFormField} OCTA)})`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (e) {
      toast({
        title: "Failed to contribute to tontine",
        description: "Error: " + e,
        status: "error",
        duration: 7000,
        isClosable: true,
      });
    } finally {
      setAmountOctaFormField(0);
      contributeOnClose();
      updateWaitingForTransaction(false);
    }
  };

  const handleWithdraw = async () => {
    updateWaitingForTransaction(true);

    try {
      // TODO: Make this configurable.
      await withdraw(
        signAndSubmitTransaction,
        moduleId,
        state.network_value,
        activeTontine.tontine_address,
        amountOctaFormField,
      );
      // If we get here, the transaction was committed successfully on chain.
      toast({
        title: "Withdrew funds from tontine",
        description: `Successfully withdrew ${octaToAptNormal(
          amountOctaFormField,
        )} APT (${amountOctaFormField} OCTA)})`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (e) {
      toast({
        title: "Failed to withdraw from tontine",
        description: "Error: " + e,
        status: "error",
        duration: 7000,
        isClosable: true,
      });
    } finally {
      setAmountOctaFormField(0);
      contributeOnClose();
      updateWaitingForTransaction(false);
    }
  };

  const baseDisabled =
    tontineData === undefined ||
    overallStatus === undefined ||
    memberStatus === undefined;
  const baseTooltip = baseDisabled ? "Loading..." : null;

  var contributeDisabled = baseDisabled;
  var contributeTooltip = baseTooltip;
  if (tontineData?.locked_time_secs > 0) {
    contributeDisabled = true;
    contributeTooltip = "Tontine is locked.";
  } else if (overallStatus === OVERALL_STATUS_CANCELLED) {
    contributeDisabled = true;
    contributeTooltip = "Tontine is cancelled.";
  }

  var withdrawDisabled = baseDisabled;
  var withdrawTooltip = baseTooltip;
  if (tontineData?.locked_time_secs > 0) {
    withdrawDisabled = true;
    withdrawTooltip = "Tontine is locked.";
  } else if (contributionAmount === 0) {
    withdrawDisabled = true;
    withdrawTooltip = "You have not contributed anything yet.";
  }

  var leaveDisabled = baseDisabled;
  var leaveTooltip = baseTooltip;
  if (tontineData?.locked_time_secs > 0) {
    leaveDisabled = true;
    leaveTooltip = "Tontine is locked.";
  } else if (activeTontine.is_creator) {
    leaveDisabled = false;
    leaveTooltip =
      "You are the creator of this tontine, leaving will cancel the tontine.";
  }

  var lockDisabled = baseDisabled;
  var lockTooltip = baseTooltip;
  if (overallStatus === OVERALL_STATUS_STAGING) {
    lockDisabled = true;
    lockTooltip = "Tontine is already locked.";
  } else if (overallStatus === OVERALL_STATUS_CANCELLED) {
    lockDisabled = true;
    lockTooltip = "Tontine is cancelled.";
  } else if (overallStatus === OVERALL_STATUS_STAGING) {
    lockDisabled = true;
    lockTooltip =
      "Some members must still contribute before you can lock the tontine.";
  }

  var checkInDisabled = baseDisabled;
  var checkInTooltip = baseTooltip;
  if (overallStatus === OVERALL_STATUS_STAGING) {
    checkInDisabled = true;
    checkInTooltip = "Tontine is not active yet, you must lock it.";
  } else if (memberStatus !== MEMBER_STATUS_STILL_ELIGIBLE) {
    checkInDisabled = true;
    checkInTooltip = "You are no longer eligible to check in.";
  }

  var claimDisabled = baseDisabled;
  var claimTooltip = baseTooltip;
  if (overallStatus === OVERALL_STATUS_STAGING) {
    claimDisabled = true;
    claimTooltip = "Tontine is not active yet.";
  } else if (memberStatus !== MEMBER_STATUS_CAN_CLAIM_FUNDS) {
    claimDisabled = true;
    claimTooltip = "Multiple members are still eligible for the funds";
  }

  var executeFallbackDisabled = baseDisabled;
  var executeFallbackTooltip = baseTooltip;
  if (overallStatus === OVERALL_STATUS_STAGING) {
    executeFallbackDisabled = true;
    executeFallbackTooltip = "Tontine is not active yet.";
  } else if (overallStatus === OVERALL_STATUS_LOCKED) {
    executeFallbackDisabled = true;
    executeFallbackTooltip = "Tontine is still active";
  } else if (overallStatus === OVERALL_STATUS_FUNDS_CLAIMABLE) {
    executeFallbackDisabled = true;
    executeFallbackTooltip = "Funds can still be claimed";
  }

  if (
    overallStatus === OVERALL_STATUS_FUNDS_CLAIMED ||
    overallStatus === OVERALL_STATUS_FALLBACK_EXECUTED
  ) {
    const message = "The tontine is finished.";
    contributeDisabled = true;
    contributeTooltip = message;
    withdrawDisabled = true;
    withdrawTooltip = message;
    leaveDisabled = true;
    leaveTooltip = message;
    lockDisabled = true;
    lockTooltip = message;
    checkInDisabled = true;
    checkInTooltip = message;
    claimDisabled = true;
    claimTooltip = message;
    executeFallbackDisabled = true;
    executeFallbackTooltip = message;
  }

  // TODO: If you're the creator of the tontine, you should be able to add / remove
  // people too.

  const contributeModal = (
    <Modal isOpen={contributeIsOpen} onClose={contributeOnClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Contribute</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl paddingBottom={5} isRequired>
            <FormLabel>Contribution amount (OCTA)</FormLabel>
            <NumberInput min={1} value={amountOctaFormField}>
              <NumberInputField
                onChange={(e) =>
                  setAmountOctaFormField(parseInt(e.target.value))
                }
              />
            </NumberInput>
            <Text paddingTop={2}>{`${octaToAptNormal(
              amountOctaFormField,
            ).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            })} APT`}</Text>
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Tooltip
            label={
              remainingContribution > 0
                ? "Contribute the required remaining amount."
                : "You have already contributed the required amount"
            }
          >
            <Button
              isDisabled={remainingContribution <= 0}
              onClick={() => setAmountOctaFormField(remainingContribution)}
            >
              Remaining
            </Button>
          </Tooltip>
          <Spacer />
          <Button
            colorScheme="blue"
            isDisabled={amountOctaFormField === 0}
            onClick={() => handleContribute()}
            mr={3}
          >
            {waitingForTransaction ? <Spinner /> : "Contribute"}
          </Button>
          <Button
            onClick={() => {
              setAmountOctaFormField(0);
              contributeOnClose();
            }}
          >
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  const withdrawModal = (
    <Modal isOpen={withdrawIsOpen} onClose={withdrawOnClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Withdraw</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl paddingBottom={5} isRequired>
            <FormLabel>Withdrawal amount (OCTA)</FormLabel>
            <NumberInput min={1} value={amountOctaFormField}>
              <NumberInputField
                onChange={(e) => {
                  var num = parseInt(e.target.value);
                  if (Number.isNaN(num)) {
                    num = 0;
                  }
                  setAmountOctaFormField(num);
                }}
              />
            </NumberInput>
            <Text paddingTop={2}>{`${octaToAptNormal(
              amountOctaFormField,
            ).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            })} APT`}</Text>
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setAmountOctaFormField(contributionAmount)}>
            Contributed
          </Button>
          <Spacer />
          <Button
            colorScheme="blue"
            isDisabled={amountOctaFormField === 0}
            onClick={() => handleWithdraw()}
            mr={3}
          >
            {waitingForTransaction ? <Spinner /> : "Withdraw"}
          </Button>
          <Button
            onClick={() => {
              setAmountOctaFormField(0);
              withdrawOnClose();
            }}
          >
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );

  return (
    <Box display="flex" flexDirection="column">
      <Box p={4}>
        <Flex alignItems="center" gap="4">
          <Heading size="sm">Actions:</Heading>
          <Tooltip label={contributeTooltip}>
            <Button
              colorScheme="blue"
              isDisabled={contributeDisabled}
              onClick={contributeOnOpen}
            >
              Contribute
            </Button>
          </Tooltip>
          <Tooltip label={withdrawTooltip}>
            <Button
              colorScheme="blue"
              isDisabled={withdrawDisabled}
              onClick={withdrawOnOpen}
            >
              Withdraw
            </Button>
          </Tooltip>
          <Tooltip label={leaveTooltip}>
            <Button
              colorScheme="blue"
              isDisabled={leaveDisabled}
              onClick={() =>
                leave(
                  signAndSubmitTransaction,
                  moduleId,
                  state.network_value,
                  activeTontine.tontine_address,
                )
              }
            >
              Leave
            </Button>
          </Tooltip>
          <Tooltip label={lockTooltip}>
            <Button
              colorScheme="blue"
              isDisabled={lockDisabled}
              onClick={() =>
                lock(
                  signAndSubmitTransaction,
                  moduleId,
                  state.network_value,
                  activeTontine.tontine_address,
                )
              }
            >
              Lock
            </Button>
          </Tooltip>
          <Tooltip label={checkInTooltip}>
            <Button
              colorScheme="blue"
              isDisabled={checkInDisabled}
              onClick={() =>
                checkIn(
                  signAndSubmitTransaction,
                  moduleId,
                  state.network_value,
                  activeTontine.tontine_address,
                )
              }
            >
              Check in
            </Button>
          </Tooltip>
          <Tooltip label={claimTooltip}>
            <Button
              colorScheme="blue"
              isDisabled={claimDisabled}
              onClick={() =>
                claim(
                  signAndSubmitTransaction,
                  moduleId,
                  state.network_value,
                  activeTontine.tontine_address,
                )
              }
            >
              Claim
            </Button>
          </Tooltip>
          <Tooltip label={executeFallbackTooltip}>
            <Button
              colorScheme="blue"
              isDisabled={executeFallbackDisabled}
              onClick={() =>
                claim(
                  signAndSubmitTransaction,
                  moduleId,
                  state.network_value,
                  activeTontine.tontine_address,
                )
              }
            >
              Execute Fallback
            </Button>
          </Tooltip>
        </Flex>
      </Box>
      {contributeModal}
      {withdrawModal}
    </Box>
  );
}
