import { Types } from "aptos";
import { useQuery, UseQueryResult } from "react-query";
import { getAccountResources } from "../../api";
import { ResponseError } from "../../api/client";
import { useGlobalState } from "../../GlobalState";

export function useGetAccountResources(
  address: string,
  options: {
    enabled?: boolean;
    // If you want to refetch the query when some additional criteria changes,
    // pass those criteria here. The query will be refetched when the value of
    // the state value given as additionalQueryCriteria changes.
    additionalQueryCriteria?: any;
  } = {},
): UseQueryResult<Types.MoveResource[], ResponseError> {
  const [state, _setState] = useGlobalState();

  const accountResourcesResult = useQuery<
    Array<Types.MoveResource>,
    ResponseError
  >(
    ["accountResources", { address }, state.network_value],
    () => getAccountResources({ address }, state.network_value),
    { refetchOnWindowFocus: false, enabled: options.enabled },
  );

  return accountResourcesResult;
}
