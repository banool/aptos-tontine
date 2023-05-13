import {
  Box,
  Text,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Tooltip,
  useColorMode,
} from "@chakra-ui/react";
import { TontineMembership } from "../api/hooks/useGetTontineMembership";
import { getShortAddress, interleave } from "../utils";
import { useGetAccountResource } from "../api/hooks/useGetAccountResource";
import { getModuleId, useGlobalState } from "../GlobalState";
import { getAnsName } from "../api";
import { useEffect, useState } from "react";
import { useGetAnsNames } from "../api/hooks/useGetAnsName";

export function TontineListCard({
  tontine,
  active,
}: {
  tontine: TontineMembership;
  active: boolean;
}) {
  const [state, _] = useGlobalState();
  const colorMode = useColorMode();

  const moduleId = getModuleId(state);

  const { isLoading, accountResource, error } = useGetAccountResource(
    tontine.tontine_address,
    `${moduleId}::Tontine`,
  );

  console.log(accountResource);

  const { data: names } = useGetAnsNames(
    () => (accountResource!.data as any).config.members,
    {
      enabled: accountResource !== undefined,
    },
  );

  var title = "Loading...";
  var members = null;
  if (error) {
    title = `Error fetching tontine: ${error}`;
  } else if (accountResource && names) {
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

  const selectedColor = colorMode.colorMode == "dark" ? "#172131" : "gray.300";

  return (
    <Box p={2}>
      <Card
        bg={active ? selectedColor : undefined}
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
