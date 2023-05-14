import { UseQueryResult, useQuery } from "react-query";
import { getMemberStatuses } from "..";
import { getModuleId, useGlobalState } from "../../GlobalState";

export function useGetMemberStatuses(
  tontineAddress: string,
  options: { enabled?: boolean } = {},
): UseQueryResult<any | undefined> {
  const [state, _setState] = useGlobalState();
  const moduleId = getModuleId(state);

  return useQuery<any | undefined>(
    ["memberStatuses", { tontineAddress }, state.network_value],
    () => getMemberStatuses(tontineAddress, moduleId, state.network_value),
    { refetchOnWindowFocus: false, enabled: options.enabled },
  );
}
