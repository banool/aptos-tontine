import {
  Box,
  Text,
  Spinner,
  Heading,
  Tooltip,
  useToast,
} from "@chakra-ui/react";
import {
  BASIC_TONTINE_STATE_COMPLETE,
  BASIC_TONTINE_STATE_LOCKED,
  BASIC_TONTINE_STATE_STAGING,
  TontineMembership,
  useGetTontineMembership,
} from "../api/hooks/useGetTontineMembership";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { TontineListCard } from "./TontineListCard";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export function TontineList({
  activeTontine,
  setActiveTontine,
}: {
  activeTontine: TontineMembership | null;
  setActiveTontine: (a: TontineMembership | null) => void;
}) {
  const { connected } = useWallet();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const {
    data: tontineMembershipData,
    isLoading: tontineMembershipIsLoading,
    error: tontineMembershipError,
  } = useGetTontineMembership();

  const [hasSetTontineOnFirstLoad, setHasSetTontineOnFirstLoad] =
    useState(false);

  // This hook manages keeping the tontine and URL state in sync.
  useEffect(() => {
    const params: any = [];
    searchParams.forEach((value, key) => {
      params.push([key, value]);
    });

    // Don't do anything until we've loaded up the list of tontines.
    if (tontineMembershipData === undefined) {
      return;
    }

    if (!hasSetTontineOnFirstLoad) {
      // There is a tontine in the URL and we haven't done the initial load, load up
      // a tontine if possible based on the url.
      setHasSetTontineOnFirstLoad(true);
      const urlTontineAddress = searchParams.get("tontine");
      if (urlTontineAddress === null) {
        // There is no tontine in the URL. Do nothing.
        return;
      }
      // Try to load up the tontine from the URL.
      const tontine = tontineMembershipData.find(
        (t) => t.tontine_address === urlTontineAddress,
      );
      if (tontine !== undefined) {
        setActiveTontine(tontine);
      } else {
        console.log("Failed to find tontine ", urlTontineAddress);
        toast({
          title: "Error loading tontine",
          description: `You are not a creator / member / invitee of tontine ${urlTontineAddress} or it does not exist`,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        setActiveTontine(null);
      }
    } else {
      // We've already done the initial load. From this point on we update the URL
      // based on activeTontine and not vice versa.
      if (activeTontine === null) {
        // There is no active tontine, remove the tontine from the URL.
        searchParams.delete("tontine");
        setSearchParams(searchParams);
      } else {
        // There is an active tontine, update the URL.
        searchParams.set("tontine", activeTontine.tontine_address);
        setSearchParams(searchParams);
      }
    }
  }, [
    tontineMembershipData,
    hasSetTontineOnFirstLoad,
    activeTontine,
    setActiveTontine,
    searchParams,
    setSearchParams,
    toast,
  ]);

  var body;
  if (!connected) {
    body = (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <Text>Connect your wallet</Text>
      </Box>
    );
  } else if (tontineMembershipIsLoading) {
    body = (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <Spinner />
      </Box>
    );
  } else if (tontineMembershipError) {
    body = <Text>{`Error fetching tontines: ${tontineMembershipError}`}</Text>;
  } else {
    var stagingCreatorCards = [];
    var stagingJoinedCards = [];
    var stagingInvitedCards = [];
    var lockedCreatorCards = [];
    var lockedJoinedCards = [];
    var completeCreatorCards = [];
    var completeJoinedCards = [];

    // Loop through tontineMembershipData and create cards for each tontine. Put each
    // card in each list based on is_creator.
    for (let i = 0; i < tontineMembershipData!.length; i++) {
      const tontine = tontineMembershipData![i];
      const card = (
        <Box key={i} onClick={() => setActiveTontine(tontine)}>
          <TontineListCard
            tontine={tontine}
            active={
              activeTontine !== null &&
              activeTontine.tontine_address === tontine.tontine_address
            }
          />
        </Box>
      );
      if (tontine.state === BASIC_TONTINE_STATE_STAGING) {
        if (tontine.is_creator) {
          stagingCreatorCards.push(card);
        } else if (tontine.has_ever_contributed) {
          stagingJoinedCards.push(card);
        } else {
          stagingInvitedCards.push(card);
        }
      } else if (tontine.state === BASIC_TONTINE_STATE_LOCKED) {
        if (tontine.is_creator) {
          lockedCreatorCards.push(card);
        } else {
          lockedJoinedCards.push(card);
        }
      } else if (tontine.state === BASIC_TONTINE_STATE_COMPLETE) {
        if (tontine.is_creator) {
          completeCreatorCards.push(card);
        } else {
          completeJoinedCards.push(card);
        }
      } else {
        throw `Unexpected tontine state ${tontine.state}`;
      }
    }

    body = (
      <Box paddingTop={2} paddingRight={2} paddingBottom={2}>
        <Heading
          paddingTop={6}
          paddingLeft={4}
          paddingRight={4}
          paddingBottom={3}
          size="md"
        >
          New Tontines{" "}
          <sup>
            <Tooltip label="Tontines that haven't been locked yet.">ⓘ</Tooltip>
          </sup>
        </Heading>
        {stagingCreatorCards.length > 0 ? (
          <Heading
            paddingTop={6}
            paddingLeft={4}
            paddingRight={4}
            paddingBottom={3}
            size="sm"
          >
            {`Yours (${stagingCreatorCards.length})`}
          </Heading>
        ) : null}
        <Box>{stagingCreatorCards}</Box>
        {stagingJoinedCards.length > 0 ? (
          <Heading
            paddingTop={6}
            paddingLeft={4}
            paddingRight={4}
            paddingBottom={3}
            size="sm"
          >
            {`Joined (${stagingJoinedCards.length})`}
          </Heading>
        ) : null}
        <Box>{stagingJoinedCards}</Box>
        {stagingInvitedCards.length > 0 ? (
          <Heading
            paddingTop={6}
            paddingLeft={4}
            paddingRight={4}
            paddingBottom={3}
            size="sm"
          >
            {`Invited (${stagingInvitedCards.length})`}
          </Heading>
        ) : null}
        <Box>{stagingInvitedCards}</Box>
        <Heading
          paddingTop={6}
          paddingLeft={4}
          paddingRight={4}
          paddingBottom={3}
          size="md"
        >
          Locked Tontines{" "}
          <sup>
            <Tooltip label="Tontines that have been locked.">ⓘ</Tooltip>
          </sup>
        </Heading>
        {lockedCreatorCards.length > 0 ? (
          <Heading
            paddingTop={6}
            paddingLeft={4}
            paddingRight={4}
            paddingBottom={3}
            size="sm"
          >
            {`Yours (${lockedCreatorCards.length})`}
          </Heading>
        ) : null}
        <Box>{lockedCreatorCards}</Box>
        {lockedJoinedCards.length > 0 ? (
          <Heading
            paddingTop={6}
            paddingLeft={4}
            paddingRight={4}
            paddingBottom={3}
            size="sm"
          >
            {`Joined (${lockedJoinedCards.length})`}
          </Heading>
        ) : null}
        <Box>{lockedJoinedCards}</Box>
        <Heading
          paddingTop={6}
          paddingLeft={4}
          paddingRight={4}
          paddingBottom={3}
          size="md"
        >
          Concluded Tontines{" "}
          <sup>
            <Tooltip label="Tontines for which the funds have been claimed / the fallback executed.">
              ⓘ
            </Tooltip>
          </sup>
        </Heading>
        {completeCreatorCards.length > 0 ? (
          <Heading
            paddingTop={6}
            paddingLeft={4}
            paddingRight={4}
            paddingBottom={3}
            size="sm"
          >
            {`Yours (${completeCreatorCards.length})`}
          </Heading>
        ) : null}
        <Box>{completeCreatorCards}</Box>
        {completeJoinedCards.length > 0 ? (
          <Heading
            paddingTop={6}
            paddingLeft={4}
            paddingRight={4}
            paddingBottom={3}
            size="sm"
          >
            {`Joined (${completeJoinedCards.length})`}
          </Heading>
        ) : null}
        <Box>{completeJoinedCards}</Box>
      </Box>
    );
  }

  return body;
}
