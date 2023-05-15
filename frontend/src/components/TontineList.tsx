import {
  Box,
  Text,
  Spinner,
  Heading,
  Tooltip,
  useToast,
} from "@chakra-ui/react";
import {
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
    console.log("tontineMembershipData", tontineMembershipData);
    const params: any = [];
    searchParams.forEach((value, key) => {
      params.push([key, value]);
    });
    console.log("searchParams", params);

    // Don't do anything until we've loaded up the list of tontines.
    if (tontineMembershipData === undefined) {
      return;
    }

    if (!hasSetTontineOnFirstLoad) {
      // There is a tontine in the URL and we haven't done the initial load, load up
      // a tontine if possible based on the url.
      setHasSetTontineOnFirstLoad(true);
      const urlTontineAddress = searchParams.get("tontine");
      console.log("urlTontineAddress", urlTontineAddress);
      if (urlTontineAddress === null) {
        // There is no tontine in the URL. Do nothing.
        return;
      }
      // Try to load up the tontine from the URL.
      const tontine = tontineMembershipData.find(
        (t) => t.tontine_address === urlTontineAddress,
      );
      console.log("tontine", tontine);
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
    var creatorCards = [];
    var joinedCards = [];
    var invitedCards = [];
    // Loop through tontineMembershipData and create cards for each tontine. Put each
    // card in each list based on is_creator.
    for (let i = 0; i < tontineMembershipData!.length; i++) {
      const tontine = tontineMembershipData![i];
      const address = tontine.tontine_address;
      const card = (
        <Box key={i} onClick={() => setActiveTontine(tontine)}>
          <TontineListCard
            tontine={tontine}
            active={
              activeTontine !== null &&
              activeTontine.tontine_address === address
            }
          />
        </Box>
      );
      if (tontine.is_creator) {
        creatorCards.push(card);
      } else if (tontine.has_ever_contributed) {
        joinedCards.push(card);
      } else {
        invitedCards.push(card);
      }
    }

    body = (
      <Box paddingTop={2} paddingRight={3} paddingBottom={2}>
        <Heading
          paddingTop={6}
          paddingLeft={4}
          paddingRight={4}
          paddingBottom={3}
          size="md"
        >
          Your tontines
        </Heading>
        <Box>{creatorCards}</Box>
        <Heading
          paddingTop={6}
          paddingLeft={4}
          paddingRight={4}
          paddingBottom={3}
          size="md"
        >
          Tontines you've joined{" "}
          <sup>
            <Tooltip label="Tontines you have ever contributed to.">ⓘ</Tooltip>
          </sup>
        </Heading>
        <Box>{joinedCards}</Box>
        <Heading
          paddingTop={6}
          paddingLeft={4}
          paddingRight={4}
          paddingBottom={3}
          size="md"
        >
          Tontine invitations{" "}
          <sup>
            <Tooltip label="Tontines other people have added you to but you've never contributed to yet.">
              ⓘ
            </Tooltip>
          </sup>
        </Heading>
        <Box>{invitedCards}</Box>
      </Box>
    );
  }

  return body;
}
