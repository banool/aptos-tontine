import { UseQueryResult, useQuery } from "react-query";
import { getMemberStatuses } from "..";
import { getModuleId, useGlobalState } from "../../GlobalState";

export function useGetMemberStatuses(
  tontineAddress: string,
  options: {
    enabled?: boolean;
    // If you want to refetch the query when some additional criteria changes,
    // pass those criteria here. The query will be refetched when the value of
    // the state value given as additionalQueryCriteria changes.
    additionalQueryCriteria?: any;
  } = {},
): UseQueryResult<any | undefined> {
  const [state, _setState] = useGlobalState();
  const moduleId = getModuleId(state);

  return useQuery<any | undefined>(
    [
      "memberStatuses",
      { tontineAddress },
      state.network_value,
      options.additionalQueryCriteria,
    ],
    () => getMemberStatuses(tontineAddress, moduleId, state.network_value),
    { refetchOnWindowFocus: false, enabled: options.enabled },
  );
}
