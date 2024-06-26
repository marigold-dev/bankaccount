import { AccountInfo, NetworkType } from "@airgap/beacon-sdk";
import { TezosToolkit } from "@taquito/taquito";
import { Dispatch, SetStateAction } from "react";
import { BeaconSigner } from "./signer";
import { BeaconWallet } from "./taquitoWallet";

type ButtonProps = {
  Tezos: TezosToolkit;
  setTezos: Dispatch<SetStateAction<TezosToolkit>>;
  setWallet: Dispatch<SetStateAction<BeaconWallet>>;
  setUserAddress: Dispatch<SetStateAction<string>>;
  setUserBalance: Dispatch<SetStateAction<number>>;
  setWalletInfo: Dispatch<SetStateAction<AccountInfo | undefined>>;
  wallet: BeaconWallet;
};

const ConnectButton = ({
  Tezos,
  setUserAddress,
  setUserBalance,
  wallet,
  setWallet,
  setWalletInfo,
  setTezos,
}: ButtonProps): JSX.Element => {
  const connectWallet = async (): Promise<void> => {
    try {
      await wallet.requestPermissions({
        network: {
          type: NetworkType.GHOSTNET,
          rpcUrl: "https://ghostnet.tezos.marigold.dev",
        },
      });
      // gets user's address
      const userAddress = await wallet.getPKH();
      const balance = await Tezos.tz.getBalance(userAddress);
      setUserBalance(balance.toNumber());
      setUserAddress(userAddress);
      setWalletInfo((await wallet.client.getActiveAccount())!);

      Tezos.setSignerProvider(new BeaconSigner(wallet));
      setWallet(wallet);
      setTezos(Tezos);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="buttons">
      <button className="button" onClick={connectWallet}>
        <span>
          <i className="fas fa-wallet"></i>&nbsp; Connect with wallet
        </span>
      </button>
    </div>
  );
};

export default ConnectButton;
