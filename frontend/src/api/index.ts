import { AptosClient, Provider, Types } from "aptos";
import { withResponseError } from "./client";
import { Network } from "aptos";
import { NetworkName } from "../constants";
import { getShortAddress } from "../utils";

export function getLedgerInfoWithoutResponseError(
  nodeUrl: string,
): Promise<Types.IndexResponse> {
  const client = new AptosClient(nodeUrl);
  return client.getLedgerInfo();
}

export function getAccountResources(
  requestParameters: { address: string; ledgerVersion?: number },
  nodeUrl: string,
): Promise<Types.MoveResource[]> {
  const client = new AptosClient(nodeUrl);
  const { address, ledgerVersion } = requestParameters;
  let ledgerVersionBig;
  if (ledgerVersion !== undefined) {
    ledgerVersionBig = BigInt(ledgerVersion);
  }
  return withResponseError(
    client.getAccountResources(address, { ledgerVersion: ledgerVersionBig }),
  );
}

export function getAccountResource(
  requestParameters: {
    address: string;
    resourceType: string;
    ledgerVersion?: number;
  },
  nodeUrl: string,
): Promise<Types.MoveResource> {
  const client = new AptosClient(nodeUrl);
  const { address, resourceType, ledgerVersion } = requestParameters;
  let ledgerVersionBig;
  if (ledgerVersion !== undefined) {
    ledgerVersionBig = BigInt(ledgerVersion);
  }
  return withResponseError(
    client.getAccountResource(address, resourceType, {
      ledgerVersion: ledgerVersionBig,
    }),
  );
}

export async function getUpcomingReward(
  vestingContractAddress: string,
  beneficiaryAddress: string,
  nodeUrl: string,
): Promise<number> {
  const client = new AptosClient(nodeUrl);
  const payload: Types.ViewRequest = {
    function: "0x1::vesting::accumulated_rewards",
    type_arguments: [],
    arguments: [vestingContractAddress, beneficiaryAddress],
  };
  const response = await client.view(payload);
  console.log(`response baby: ${response}`);
  return parseInt(response[0] as any);
}

export async function getAnsName(
  address: string,
  network: NetworkName,
): Promise<string | undefined> {
  /* use this once the AnsClient is exposed
  // https://stackoverflow.com/a/42623905/3846032
  const s = network as string;
  const key = s as keyof typeof Network;
  const providerNetwork = Network[key];
  const provider = new Provider(providerNetwork);
  const ansClient = new AnsClient(provider);
  client.getPrimaryNameByAddress
  */
  const response = await fetch(
    `https://www.aptosnames.com/api/${network}/v1/primary-name/${address}`,
  );
  const data = await response.json();
  return data.name;
}
