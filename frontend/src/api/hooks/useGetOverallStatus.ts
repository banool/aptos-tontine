import { UseQueryResult, useQuery } from "react-query";
import { getOverallStatus } from "..";
import { getModuleId, useGlobalState } from "../../GlobalState";

export function useGetOverallStatus(
  tontineAddress: string,
  options: { enabled?: boolean } = {},
): UseQueryResult<any | undefined> {
  const [state, _setState] = useGlobalState();
  const moduleId = getModuleId(state);

  return useQuery(
    ["overallStatus", { tontineAddress }, state.network_value],
    () => getOverallStatus(tontineAddress, moduleId, state.network_value),
    { refetchOnWindowFocus: false, enabled: options.enabled },
  );
}
