import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  Box,
  Center,
  Flex,
  Image,
  Link,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { TontineList } from "../../components/TontineList";
import { useEffect, useState } from "react";
import { TontineMembership } from "../../api/hooks/useGetTontineMembership";
import { TontineDisplay } from "../../components/TontineDisplay";
import { useGlobalState } from "../../GlobalState";
import simpsonsImage from "../../images/simpsons_tontine.png";
import { HomeActions } from "../../components/HomeActions";

export const HomePage = () => {
  const { connected, network } = useWallet();
  const [state, _] = useGlobalState();

  const [activeTontine, setActiveTontine] = useState<TontineMembership | null>(
    null,
  );

  console.log("active", activeTontine);

  const linkColor = useColorModeValue("blue.500", "blue.300");

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

  const infoComponent = (
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
    </Box>
  );

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
            <HomeActions />
            <Box
              p={7}
              paddingTop={0}
              display="flex"
              justifyContent="center"
              height="100%"
            >
              {infoComponent}
            </Box>
          </Box>
        )}
      </Box>
    </Flex>
  );
};
