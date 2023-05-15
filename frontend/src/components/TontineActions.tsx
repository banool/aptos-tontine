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
  executeFallback,
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
  OVERALL_STATUS_CAN_BE_LOCKED,
  OVERALL_STATUS_FALLBACK_EXECUTED,
  OVERALL_STATUS_FUNDS_CLAIMABLE,
  OVERALL_STATUS_FUNDS_CLAIMED,
  OVERALL_STATUS_LOCKED,
  OVERALL_STATUS_STAGING,
} from "../constants";
import { useQueryClient } from "react-query";

export function TontineActions({
  activeTontine,
}: {
  activeTontine: TontineMembership;
}) {
  const [state, _] = useGlobalState();
  const queryClient = useQueryClient();

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
  const [waitingForTransaction, setWaitingForTransaction] = useState(false);

  const { isLoading, accountResource, error } = useGetAccountResource(
    activeTontine.tontine_address,
    `${moduleId}::Tontine`,
    { additionalQueryCriteria: waitingForTransaction },
  );

  const tontineData = accountResource?.data as any;

  const {
    isLoading: memberStatusesIsLoading,
    data: memberStatusesRaw,
    error: memberStatusesError,
  } = useGetMemberStatuses(activeTontine.tontine_address, {
    enabled: accountResource !== undefined,
    additionalQueryCriteria: accountResource,
  });

  const {
    isLoading: overallStatusIsLoading,
    data: overallStatusRaw,
    error: overallStatusError,
  } = useGetOverallStatus(activeTontine.tontine_address, {
    enabled: accountResource !== undefined,
    additionalQueryCriteria: accountResource,
  });

  const memberStatusesData = memberStatusesRaw?.data
    ? simpleMapArrayToMap(memberStatusesRaw.data)
    : undefined;
  const memberStatus: number | undefined = memberStatusesData?.get(
    account!.address,
  );
  const overallStatus: number | undefined = overallStatusRaw;

  const contributionAmount = tontineData
    ? getContributionAmount(tontineData.contributions, account!.address)
    : 0;

  const remainingContribution = tontineData
    ? tontineData?.config.per_member_amount_octa - contributionAmount
    : 0;

  const onTxnSuccess = ({
    title,
    description,
  }: {
    title: string;
    description: string;
  }) => {
    // Indicate that the transaction was successful.
    toast({
      title,
      description,
      status: "success",
      duration: 5000,
      isClosable: true,
    });
    // Invalidate the account resource query so it will be refetched.
    // https://tanstack.com/query/v4/docs/react/guides/query-invalidation
    queryClient.invalidateQueries({ queryKey: activeTontine.tontine_address });
  };

  const onTxnFailure = ({
    title,
    description,
  }: {
    title: string;
    description: string;
  }) => {
    // Indicate that the transaction failed.
    toast({
      title,
      description,
      status: "error",
      duration: 7000,
      isClosable: true,
    });
  };

  const handleContribute = async () => {
    setWaitingForTransaction(true);

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
      onTxnSuccess({
        title: "Contributed funds to tontine",
        description: `Successfully contributed ${octaToAptNormal(
          amountOctaFormField,
        )} APT (${amountOctaFormField} OCTA)`,
      });
    } catch (e) {
      onTxnFailure({
        title: "Failed to contribute to tontine",
        description: "Error: " + e,
      });
    } finally {
      setAmountOctaFormField(0);
      contributeOnClose();
      setWaitingForTransaction(false);
    }
  };

  const handleWithdraw = async () => {
    setWaitingForTransaction(true);

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
      onTxnSuccess({
        title: "Withdrew funds from tontine",
        description: `Successfully withdrew ${octaToAptNormal(
          amountOctaFormField,
        )} APT (${amountOctaFormField} OCTA)`,
      });
    } catch (e) {
      onTxnFailure({
        title: "Failed to withdraw from tontine",
        description: "Error: " + e,
      });
    } finally {
      setAmountOctaFormField(0);
      withdrawOnClose();
      setWaitingForTransaction(false);
    }
  };

  var baseDisabled =
    tontineData === undefined ||
    overallStatus === undefined ||
    memberStatus === undefined;
  var baseTooltip = baseDisabled ? "Loading..." : null;

  if (overallStatus === OVERALL_STATUS_CANCELLED) {
    baseDisabled = true;
    baseTooltip = "Tontine is cancelled.";
  }

  var contributeDisabled = baseDisabled;
  var contributeTooltip = baseTooltip;
  if (tontineData?.locked_time_secs > 0) {
    contributeDisabled = true;
    contributeTooltip = "Tontine is locked.";
  } else if (overallStatus === OVERALL_STATUS_CANCELLED) {
    contributeDisabled = true;
    contributeTooltip = "The tontine is cancelled.";
  }

  var withdrawDisabled = baseDisabled;
  var withdrawTooltip = baseTooltip;
  if (tontineData?.locked_time_secs > 0) {
    withdrawDisabled = true;
    withdrawTooltip = "Tontine is locked.";
  } else if (contributionAmount === 0) {
    withdrawDisabled = true;
    withdrawTooltip = "You have not contributed anything yet.";
  } else if (overallStatus === OVERALL_STATUS_CANCELLED) {
    withdrawDisabled = false;
    withdrawTooltip = null;
  }

  var leaveDisabled = baseDisabled;
  var leaveTooltip = baseTooltip;
  if (tontineData?.locked_time_secs > 0) {
    leaveDisabled = true;
    leaveTooltip = "Tontine is locked.";
  } else if (memberStatus === undefined) {
    leaveDisabled = true;
    leaveTooltip = "You are not a member of this tontine.";
  } else if (activeTontine.is_creator) {
    leaveDisabled = false;
    leaveTooltip =
      "You are the creator of this tontine, leaving will cancel the tontine.";
  } else if (overallStatus === OVERALL_STATUS_CANCELLED) {
    withdrawDisabled = false;
    withdrawTooltip = null;
  }

  var lockDisabled = baseDisabled;
  var lockTooltip = baseTooltip;
  if (overallStatus === OVERALL_STATUS_STAGING) {
    lockDisabled = true;
    lockTooltip =
      "Some members must still contribute before you can lock the tontine.";
  } else if (tontineData?.locked_time_secs > 0) {
    lockDisabled = true;
    lockTooltip = "Tontine is already locked.";
  }

  var checkInDisabled = baseDisabled;
  var checkInTooltip = baseTooltip;
  if (
    overallStatus === OVERALL_STATUS_STAGING ||
    overallStatus === OVERALL_STATUS_CAN_BE_LOCKED
  ) {
    checkInDisabled = true;
    checkInTooltip = "Tontine is not active yet, you must lock it.";
  } else if (
    memberStatus !== MEMBER_STATUS_STILL_ELIGIBLE &&
    memberStatus !== MEMBER_STATUS_CAN_CLAIM_FUNDS
  ) {
    checkInDisabled = true;
    checkInTooltip = "You are no longer eligible to check in.";
  }

  var claimDisabled = baseDisabled;
  var claimTooltip = baseTooltip;
  if (
    overallStatus === OVERALL_STATUS_STAGING ||
    overallStatus === OVERALL_STATUS_CAN_BE_LOCKED
  ) {
    claimDisabled = true;
    claimTooltip = "Tontine is not active yet.";
  } else if (memberStatus !== MEMBER_STATUS_CAN_CLAIM_FUNDS) {
    claimDisabled = true;
    claimTooltip = "Multiple members are still eligible for the funds";
  }

  var executeFallbackDisabled = baseDisabled;
  var executeFallbackTooltip = baseTooltip;
  if (
    overallStatus === OVERALL_STATUS_STAGING ||
    overallStatus === OVERALL_STATUS_CAN_BE_LOCKED
  ) {
    executeFallbackDisabled = true;
    executeFallbackTooltip = "Tontine is not active yet.";
  } else if (overallStatus === OVERALL_STATUS_LOCKED) {
    executeFallbackDisabled = true;
    executeFallbackTooltip = "Tontine is still active";
  } else if (overallStatus === OVERALL_STATUS_FUNDS_CLAIMABLE) {
    executeFallbackDisabled = true;
    executeFallbackTooltip = "Funds can still be claimed";
  } else if (overallStatus === OVERALL_STATUS_FUNDS_CLAIMED) {
    executeFallbackDisabled = true;
    executeFallbackTooltip = "Funds have already been claimed";
  } else if (overallStatus === OVERALL_STATUS_FALLBACK_EXECUTED) {
    executeFallbackDisabled = true;
    executeFallbackTooltip = "Fallback has already been executed";
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
      <Box p={7}>
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
              onClick={async () => {
                setWaitingForTransaction(true);
                try {
                  await leave(
                    signAndSubmitTransaction,
                    moduleId,
                    state.network_value,
                    activeTontine.tontine_address,
                  );
                  onTxnSuccess({
                    title: "Left the tontine",
                    description: "You have successfully left the tontine.",
                  });
                } catch (e) {
                  onTxnFailure({
                    title: "Failed to leave the tontine",
                    description: `Failed to leave the tontine: ${e}`,
                  });
                } finally {
                  setWaitingForTransaction(false);
                }
              }}
            >
              Leave
            </Button>
          </Tooltip>
          <Tooltip label={lockTooltip}>
            <Button
              colorScheme="blue"
              isDisabled={lockDisabled}
              onClick={async () => {
                setWaitingForTransaction(true);
                try {
                  await lock(
                    signAndSubmitTransaction,
                    moduleId,
                    state.network_value,
                    activeTontine.tontine_address,
                  );
                  onTxnSuccess({
                    title: "Locked the tontine",
                    description: "You have successfully locked the tontine.",
                  });
                } catch (e) {
                  onTxnFailure({
                    title: "Failed to lock the tontine",
                    description: `Failed to lock the tontine: ${e}`,
                  });
                } finally {
                  setWaitingForTransaction(false);
                }
              }}
            >
              Lock
            </Button>
          </Tooltip>
          <Tooltip label={checkInTooltip}>
            <Button
              colorScheme="blue"
              isDisabled={checkInDisabled}
              onClick={async () => {
                setWaitingForTransaction(true);
                try {
                  await checkIn(
                    signAndSubmitTransaction,
                    moduleId,
                    state.network_value,
                    activeTontine.tontine_address,
                  );
                  onTxnSuccess({
                    title: "Checked in",
                    description: "You have successfully checked in.",
                  });
                } catch (e) {
                  onTxnFailure({
                    title: "Failed to check in",
                    description: `Failed to check in: ${e}`,
                  });
                } finally {
                  setWaitingForTransaction(false);
                }
              }}
            >
              Check in
            </Button>
          </Tooltip>
          <Tooltip label={claimTooltip}>
            <Button
              colorScheme="blue"
              isDisabled={claimDisabled}
              onClick={async () => {
                setWaitingForTransaction(true);
                try {
                  await claim(
                    signAndSubmitTransaction,
                    moduleId,
                    state.network_value,
                    activeTontine.tontine_address,
                  );
                  onTxnSuccess({
                    title: "Claimed funds",
                    description:
                      "You have successfully claimed the funds of the tontine.",
                  });
                } catch (e) {
                  onTxnFailure({
                    title: "Failed to claim funds",
                    description: `Failed to claim the funds of the tontine: ${e}`,
                  });
                } finally {
                  setWaitingForTransaction(false);
                }
              }}
            >
              Claim
            </Button>
          </Tooltip>
          <Tooltip label={executeFallbackTooltip}>
            <Button
              colorScheme="blue"
              isDisabled={executeFallbackDisabled}
              onClick={async () => {
                setWaitingForTransaction(true);
                try {
                  await executeFallback(
                    signAndSubmitTransaction,
                    moduleId,
                    state.network_value,
                    activeTontine.tontine_address,
                  );
                  onTxnSuccess({
                    title: "Executed fallback",
                    description:
                      "Successfully executed the fallback of the tontine.",
                  });
                } catch (e) {
                  onTxnFailure({
                    title: "Failed to execute fallback",
                    description: `Failed to execute the fallback of the tontine: ${e}`,
                  });
                } finally {
                  setWaitingForTransaction(false);
                }
              }}
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
