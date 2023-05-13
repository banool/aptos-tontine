import {
    Box,
    Text,
    Card,
    CardBody,
    CardHeader,
    Heading,
} from "@chakra-ui/react";
import { TontineMembership } from "../api/hooks/useGetTontineMembership";
import { getShortAddress } from "../utils";
import { useGetAccountResource } from "../api/hooks/useGetAccountResource";
import { getModuleId, useGlobalState } from "../GlobalState";

export function TontineListCard({ tontine }: { tontine: TontineMembership }) {
    const [state, _] = useGlobalState();

    const moduleId = getModuleId(state);

    const { isLoading, accountResource, error } = useGetAccountResource(
        tontine.tontine_address,
        `${moduleId}::Tontine`,
    );

    var title = "Loading...";
    var members = null;
    if (error) {
        title = `Error fetching tontine: ${error}`;
    } else if (accountResource !== undefined) {
        const data = (accountResource.data as any);
        title = (data.config.title);
        members = data.config.members.map((member: any) => getShortAddress(member)).join(", ");
    }

    return (
        <Box p={2}>
            <Card>
                <CardHeader>
                    <Heading size="md">{title}</Heading>
                </CardHeader>
                <CardBody>
                    <Text>{`Address: ${getShortAddress(tontine.tontine_address)}`}</Text>
                    <Text>{members}</Text>
                </CardBody>
            </Card>
        </Box>
    );
}
