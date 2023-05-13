import { UseQueryResult, useQuery } from "react-query";
import { useGlobalState } from "../../GlobalState";
import { getAnsName } from "..";
import { NetworkName } from "../../constants";

export type AnsLookup = {
  address: string;
  name: string | undefined;
};

const fetchNames = async (
  addresses: string[],
  network_name: NetworkName,
): Promise<AnsLookup[]> => {
  return await Promise.all(
    addresses.map(async (address: any) => {
      return {
        address,
        name: await getAnsName(address, network_name),
      };
    }),
  );
};

export function useGetAnsNames(
  addressesFn: () => string[],
  options: {
    enabled?: boolean;
  } = {},
): UseQueryResult<AnsLookup[]> {
  const [state, _setState] = useGlobalState();

  return useQuery(
    ["ansNames", { addressesFn }, state.network_value],
    async () => {
      return fetchNames(addressesFn(), state.network_name);
    },
    { refetchOnWindowFocus: false, enabled: options.enabled },
  );
}
