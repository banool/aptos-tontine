import { UseQueryResult, useQuery } from "react-query";
import { useGlobalState } from "../../GlobalState";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

export type TontineMembership = {
  tontine_address: string;
  is_creator: boolean;
  has_ever_contributed: boolean;
};

export function useGetTontineMembership(): UseQueryResult<TontineMembership[]> {
  const [state, _setState] = useGlobalState();
  const { account } = useWallet();

  return useQuery<TontineMembership[]>(
    ["tontineMembership", { account }, state.network_value],
    async () => {
      const res = await fetch(
        `https://tontine-processor.dport.me/tontines/${account!.address}`,
      );
      const data = await res.json();
      return data;
    },
    { refetchOnWindowFocus: false, enabled: account !== null },
  );
}
