import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  Box,
  Center,
  Divider,
  Flex,
  Image,
  Link,
  List,
  ListItem,
  Text,
  UnorderedList,
  useColorModeValue,
} from "@chakra-ui/react";
import { TontineList } from "../../components/TontineList";
import { useEffect, useState } from "react";
import { TontineMembership } from "../../api/hooks/useGetTontineMembership";
import { TontineDisplay } from "../../components/TontineDisplay";
import { useGlobalState } from "../../GlobalState";
import simpsonsImage from "../../images/simpsons_tontine.png";
import { HomeActions } from "../../components/HomeActions";
import { CreateTontine } from "../../components/CreateTontine";

export const HomePage = () => {
  const { connected, network } = useWallet();
  const [state, _] = useGlobalState();

  const [activeTontine, setActiveTontine] = useState<TontineMembership | null>(
    null,
  );

  const [showingCreateComponent, setShowingCreateComponent] = useState(false);

  if (
    network &&
    network.name.toLowerCase() !== state.network_name.toLowerCase()
  ) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <Text>
          Your wallet network is {network.name.toLowerCase()} but you've
          selected {state.network_name} in the site, please make sure they
          match.
        </Text>
      </Box>
    );
  }

  // Note: If there are more tontines than fit in a single screen, they overflow
  // beyond the end of the sidebar box downward. I have not been able to fix it.
  return (
    <Flex p={3} height="100%" flex="1" overflow="auto">
      <Box width="21%" borderRight="1px">
        <TontineList
          activeTontine={activeTontine}
          setActiveTontine={setActiveTontine}
        />
      </Box>
      <Box width="79%">
        {connected && activeTontine ? (
          <TontineDisplay
            activeTontine={activeTontine}
            setActiveTontine={setActiveTontine}
          />
        ) : (
          <Box>
            <HomeActions
              showingCreateComponent={showingCreateComponent}
              setShowingCreateComponent={setShowingCreateComponent}
            />
            {showingCreateComponent ? <CreateTontine /> : <InfoComponent />}
          </Box>
        )}
      </Box>
    </Flex>
  );
};

export const InfoComponent = () => {
  const linkColor = useColorModeValue("blue.500", "blue.300");
  return (
    <Box
      p={7}
      paddingTop={0}
      display="flex"
      justifyContent="center"
      height="100%"
    >
      <Box>
        <Box
          borderLeftWidth="3px"
          borderLeftColor="blue.500"
          pl={4}
          py={2}
          mt={4}
          fontStyle="italic"
        >
          Works of fiction ... often feature a variant model of the tontine in
          which the capital devolves upon the last surviving nominee, thereby
          dissolving the trust and potentially making the survivor very wealthy.
          It is unclear whether this model ever existed in the real world.
        </Box>
        <Box p={3}>
          &mdash; <i>Tontine</i>,{" "}
          <Link
            color={linkColor}
            href="https://en.wikipedia.org/wiki/Tontine#In_popular_culture"
          >
            Wikipedia
          </Link>
        </Box>
        <Center>
          <Image src={simpsonsImage} width="55%" alt="Simpsons Tontine" />
        </Center>
        <Box p={3}>
          &mdash;{" "}
          <i>
            Raging Abe Simpson and His Grumbling Grandson in 'The Curse of the
            Flying Hellfish'
          </i>
          ,{" "}
          <Link
            color={linkColor}
            href="https://en.wikipedia.org/wiki/Raging_Abe_Simpson_and_His_Grumbling_Grandson_in_%27The_Curse_of_the_Flying_Hellfish%27"
          >
            Wikipedia
          </Link>
        </Box>
        <Box paddingTop={3} paddingBottom={5}>
          <Divider />
        </Box>
        <Text>
          The tontine described here is a variant of the standard tontine that
          works as described above. In this scheme, people invest funds into a
          shared fund. It remains locked in the fund until only one member of
          the tontine remains, at which point they may claim the full sum of the
          invested funds.
        </Text>
        <Box p={2} />
        <Text paddingBottom={1}>
          Organizing a tontine on-chain has a variety of interesting properties,
          be them advantages or disadvantages:
        </Text>
        <UnorderedList spacing={2}>
          <ListItem>
            In traditional tontines it is difficult to devise a mechanism where
            the funds can only be retrieved once one member remains. This is
            easily enforced on chain.
          </ListItem>
          <ListItem>
            Aptos accounts need not necessarily be owned by a single individual.
            To avoid{" "}
            <Link
              color={linkColor}
              href="https://www.explainxkcd.com/wiki/index.php/538:_Security"
            >
              wrench attacks
            </Link>{" "}
            they may use a multisigner account, either shared with other
            individuals, or just sharded in a way that makes it hard for another
            party to get the full key.
          </ListItem>
          <ListItem>
            Aptos accounts do not strictly map to a single indvidiual. This has
            interesting implications. For example, a tontine could theoretically
            outlast generations, with accounts being handed down throughout
            time.
          </ListItem>
        </UnorderedList>
        <Text paddingTop={3}>
          Make sure you understand these properties before taking part in a
          tontine organized through this Move module.
        </Text>
        <Text paddingTop={3}>
          Learn more about the tontine lifecycle{" "}
          <Link
            color={linkColor}
            href="https://github.com/banool/aptos-tontine#standard-tontine-lifecycle"
          >
            here
          </Link>
          .
        </Text>
      </Box>
    </Box>
  );
};
