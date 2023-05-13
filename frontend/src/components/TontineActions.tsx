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
  Input,
  NumberInputField,
} from "@chakra-ui/react";
import { TontineMembership } from "../api/hooks/useGetTontineMembership";
import {
  aptToOcta,
  getContributionAmount,
  getShortAddress,
  interleave,
} from "../utils";
import { useGetAccountResource } from "../api/hooks/useGetAccountResource";
import { getModuleId, useGlobalState } from "../GlobalState";
import { getAnsName } from "../api";
import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { contribute } from "../api/transactions";

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

  const { account, signAndSubmitTransaction } = useWallet();
  const toast = useToast();

  const moduleId = getModuleId(state);

  const [formIntendedContribution, setFormIntendedContribution] = useState(0);
  const [contributing, updateContributing] = useState(false);

  const { isLoading, accountResource, error } = useGetAccountResource(
    activeTontine.tontine_address,
    `${moduleId}::Tontine`,
  );

  const data = accountResource?.data as any;

  const contributionAmount = getContributionAmount(
    data?.contributions,
    account!.address,
  );

  const handleContribute = async () => {
    updateContributing(true);

    console.log(formIntendedContribution);
    console.log(formIntendedContribution);
    console.log(formIntendedContribution);
    console.log(formIntendedContribution);

    try {
      // TODO: Make this configurable.
      await contribute(
        signAndSubmitTransaction,
        moduleId,
        state.network_value,
        activeTontine.tontine_address,
        aptToOcta(formIntendedContribution),
      );
      // If we get here, the transaction was committed successfully on chain.
      toast({
        title: "Created new chat room!",
        description: `Successfully contributed ${formIntendedContribution} APT`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (e) {
      toast({
        title: "Failed to create new chat room.",
        description: "Error: " + e,
        status: "error",
        duration: 7000,
        isClosable: true,
      });
    } finally {
      contributeOnClose();
      updateContributing(false);
    }
  };

  const contributeDisabled = data?.locked_time_secs > 0;
  const contributeTooltip = contributeDisabled ? "Tontine is locked" : null;

  var withdrawDisabled = false;
  var withdrawTooltip = null;
  if (data?.locked_time_secs > 0) {
    withdrawDisabled = true;
    withdrawTooltip = "Tontine is locked.";
  } else if (contributionAmount === 0) {
    withdrawDisabled = true;
    withdrawTooltip = "You have not contributed anything yet.";
  }

  const leaveDisabled = data?.locked_time_secs > 0;
  var leaveTooltip = null;
  if (data?.locked_time_secs > 0) {
    leaveTooltip = "Tontine is locked.";
  } else if (activeTontine.is_creator) {
    leaveTooltip =
      "You are the creator of this tontine, leaving will cancel the tontine.";
  }

  // TODO: If you're the creator of the tontine, you should be able to add / remove
  // people too.

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
            <Button colorScheme="blue" isDisabled={withdrawDisabled}>
              Withdraw
            </Button>
          </Tooltip>
          <Tooltip label={leaveTooltip}>
            <Button colorScheme="blue" isDisabled={leaveDisabled}>
              Leave
            </Button>
          </Tooltip>
        </Flex>
      </Box>
      <Modal isOpen={contributeIsOpen} onClose={contributeOnClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Send Gift 🧧</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl paddingBottom={5} isRequired>
              <FormLabel>Contribution amount (APT)</FormLabel>
              <NumberInput min={1}>
                <NumberInputField
                  value={formIntendedContribution}
                  onChange={(e) =>
                    setFormIntendedContribution(parseInt(e.target.value))
                  }
                />
              </NumberInput>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button
              colorScheme="blue"
              isDisabled={formIntendedContribution == 0}
              onClick={() => handleContribute()}
              mr={3}
            >
              {contributing ? <Spinner /> : "Contribute"}
            </Button>
            <Button onClick={contributeOnClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
