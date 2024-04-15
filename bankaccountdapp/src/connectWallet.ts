import { NetworkType } from "@airgap/beacon-types";
import { Dispatch } from "react";
import { fetchContracts } from "./App";
import { action, tezosState } from "./state";

const RPC_URL = "https://ghostnet.tezos.marigold.dev";

export const connectWallet = async (
  state: tezosState,
  dispatch: Dispatch<action>
): Promise<void> => {
  if (!state.beaconWallet) return;

  await state?.beaconWallet!.requestPermissions({
    network: {
      type: NetworkType.GHOSTNET,
      rpcUrl: RPC_URL,
    },
  });

  const userAddress: string = await state?.beaconWallet!.getPKH()!;
  const balance = await state?.connection.tz.getBalance(userAddress);
  let s = await state?.beaconWallet!.client.getActiveAccount();

  dispatch!({
    type: "login",
    accountInfo: s!,
    address: userAddress,
    balance: balance!.toString(),
    contracts: await fetchContracts(state, userAddress),
  });
};
