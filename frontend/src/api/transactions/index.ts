import { AptosClient } from "aptos";

async function submitTransaction(
  signAndSubmitTransaction: (txn: any) => Promise<any>,
  fullnodeUrl: string,
  transaction: any,
) {
  const pendingTransaction = await signAndSubmitTransaction(transaction);
  const client = new AptosClient(fullnodeUrl);
  await client.waitForTransactionWithResult(pendingTransaction.hash, {
    checkSuccess: true,
  });
}

export async function contribute(
  signAndSubmitTransaction: (txn: any) => Promise<any>,
  moduleId: string,
  fullnodeUrl: string,
  tontineAddress: string,
  amountInOcta: number,
) {
  const transaction = {
    type: "entry_function_payload",
    function: `${moduleId}::contribute`,
    type_arguments: [],
    arguments: [tontineAddress, amountInOcta],
  };
  console.log(transaction);
  await submitTransaction(signAndSubmitTransaction, fullnodeUrl, transaction);
}
