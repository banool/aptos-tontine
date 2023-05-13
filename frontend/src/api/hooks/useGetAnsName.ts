import { UseQueryResult, useQuery } from "react-query";
import { useGlobalState } from "../../GlobalState";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getAnsName } from "..";
import { getShortAddress } from "../../utils";

export type TontineMembership = {
  tontine_address: string;
  is_creator: boolean;
};

export function useGetAnsName(
  address: string,
  options: {
    enabled?: boolean;
    // If true, return a shortened version of the address
    // if there is no name after the lookup.
    shorten?: boolean;
  } = {},
): string {
  const [state, _setState] = useGlobalState();

  const result = useQuery(
    ["tontineMembership", { address }, state.network_value],
    async () => {
      return getAnsName(address, state.network_name);
    },
    { refetchOnWindowFocus: false, enabled: options.enabled },
  );

  if (result.data) {
    return result.data;
  }

  if (options.shorten) {
    return getShortAddress(address);
  }

  return address;
}
