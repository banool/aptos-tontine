import {
  Box,
  Text,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Tooltip,
} from "@chakra-ui/react";
import { TontineMembership } from "../api/hooks/useGetTontineMembership";
import { getShortAddress, interleave } from "../utils";
import { useGetAccountResource } from "../api/hooks/useGetAccountResource";
import { getModuleId, useGlobalState } from "../GlobalState";
import { getAnsName } from "../api";
import { useEffect, useState } from "react";

export function TontineListCard({
  tontine,
  active,
}: {
  tontine: TontineMembership;
  active: boolean;
}) {
  const [state, _] = useGlobalState();

  const moduleId = getModuleId(state);

  const { isLoading, accountResource, error } = useGetAccountResource(
    tontine.tontine_address,
    `${moduleId}::Tontine`,
  );

  const [names, setNames] = useState<
    { address: string; name: string | undefined }[]
  >([]);

  useEffect(() => {
    if (accountResource !== undefined) {
      const data = accountResource.data as any;

      Promise.all(
        data.config.members.map(async (address: any) => {
          return {
            address,
            name: await getAnsName(address, state.network_name),
          };
        }),
      )
        .then((result) => setNames(result))
        .catch((e) => console.error(`ANS lookup error: ${e}`));
    }
  }, [accountResource, state.network_name]);

  var title = "Loading...";
  var members = null;
  if (error) {
    title = `Error fetching tontine: ${error}`;
  } else if (names && accountResource) {
    title = (accountResource.data as any).config.name;
    var elements = [];
    for (var { address, name } of names) {
      var label;
      var text;
      if (name) {
        label = address;
        text = `${name}.apt`;
      } else {
        label = address;
        text = getShortAddress(address);
      }
      elements.push(
        <Tooltip label={label}>
          <Text as="span">{text}</Text>
        </Tooltip>,
      );
    }
    members = interleave(elements, <Text as="span">{", "}</Text>);
  }

  return (
    <Box p={2}>
      <Card
        bg={active ? "#172131" : undefined}
        borderWidth="1px"
        borderColor={active ? "white" : "transparent"}
      >
        <CardHeader>
          <Heading size="md">{title}</Heading>
        </CardHeader>
        <CardBody>
          <Text as="span">{"Address: "}</Text>
          <Tooltip label={tontine.tontine_address}>
            <Text as="span">{getShortAddress(tontine.tontine_address)}</Text>
          </Tooltip>
          <Text>{"\n"}</Text>
          <Text as="span">{"Members: "}</Text>
          {members}
        </CardBody>
      </Card>
    </Box>
  );
}
