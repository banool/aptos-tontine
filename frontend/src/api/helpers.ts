import { CreateToastFnReturn } from "@chakra-ui/react";
import { ActiveTontine } from "../pages/HomePage";
import { QueryClient } from "react-query";
import { TONTINE_MEMBERSHIP_QUERY_KEY } from "./hooks/useGetTontineMembership";

export const onTxnSuccess = async ({
  toast,
  queryClient,
  activeTontine,
  title,
  description,
}: {
  toast: CreateToastFnReturn;
  queryClient: QueryClient;
  activeTontine: ActiveTontine;
  title: string;
  description: string;
}) => {
  // Indicate that the transaction was successful.
  toast({
    title,
    description,
    status: "success",
    duration: 4000,
    isClosable: true,
  });
  // Invalidate the account resource query so it will be refetched.
  // Also invalidate the tontine membership query so the sidebar will be reloaded.
  // https://tanstack.com/query/v4/docs/react/guides/query-invalidation
  // We wait 1.5 seconds for the indexer processor to pick up the transaction.
  await new Promise((r) => setTimeout(r, 2000));
  queryClient.invalidateQueries({ queryKey: activeTontine.address });
  queryClient.invalidateQueries({ queryKey: TONTINE_MEMBERSHIP_QUERY_KEY });
};

export const onTxnFailure = ({
  toast,
  title,
  description,
}: {
  toast: CreateToastFnReturn;
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
