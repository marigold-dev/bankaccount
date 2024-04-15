import {
  AccountInfo,
  NetworkType,
  TezosOperationType,
} from "@airgap/beacon-types";
import { TezosToolkit } from "@taquito/taquito";
import * as api from "@tzkt/sdk-api";
import { useCallback, useEffect, useState } from "react";
import "./App.css";
import ConnectButton from "./ConnectWallet";
import DisconnectButton from "./DisconnectWallet";

import { stringToBytes } from "@taquito/utils";
import { BeaconWallet } from "./taquitoWallet";

import BigNumber from "bignumber.js";
import { BankAccountWalletType } from "./bank_account.types";
import { address, mutez } from "./type-aliases";
import { omit } from "./utils";

function App() {
  api.defaults.baseUrl = "https://api.ghostnet.tzkt.io";

  const [Tezos, setTezos] = useState<TezosToolkit>(
    new TezosToolkit("https://ghostnet.tezos.marigold.dev")
  );
  const [wallet, setWallet] = useState<BeaconWallet>(
    new BeaconWallet({
      name: "Demo DAPP",
      preferredNetwork: NetworkType.GHOSTNET,
    })
  );

  const [userAddress, setUserAddress] = useState<string>("");
  const [userBalance, setUserBalance] = useState<number>(0);
  const [walletInfo, setWalletInfo] = useState<undefined | AccountInfo>();
  const [waitingId, setWaitingId] = useState<undefined | string>();
  const [waitingChallenges, setWaitingChallenges] = useState<
    Record<string, string>
  >({});
  const [claimed, setClaimed] = useState(false);

  const storeWaitingChallenge = (payloadHash: string, payload: string) => {
    const payloadEncoded = stringToBytes(payload);
    setWaitingChallenges((old) => ({ ...old, [payloadHash]: payloadEncoded }));
  };

  const removeWaitingChallenge = useCallback(
    (payloadHash: string) => {
      setWaitingChallenges(omit(payloadHash, waitingChallenges));
    },
    [waitingChallenges]
  );

  useEffect(() => {
    (async () => {
      const activeAccount = await wallet.client.getActiveAccount();
      if (activeAccount) {
        setUserAddress(activeAccount.address);
        const balance = await Tezos.tz.getBalance(activeAccount.address);
        setUserBalance(balance.toNumber());
      }
    })();
  }, []);

  useEffect(() => {
    const listenerActiveAccount = (accountInfo: AccountInfo | undefined) => {
      setWalletInfo(accountInfo);
      if (accountInfo) {
        Tezos.setWalletProvider(wallet);
        setWalletInfo(accountInfo);
      }
    };
    wallet.subscribeToActiveAccount(listenerActiveAccount);
    wallet.client.getActiveAccount().then(setWalletInfo);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      Object.keys(waitingChallenges).forEach((payloadHash) => {
        return fetch(
          `https://api.ghostnet.tzkt.io/v1/contracts/events?contract=${walletInfo?.address}&tag=proof_of_event&payload=${waitingChallenges[payloadHash]}`
        )
          .then((r) => r.json())
          .then((eventChallenges) => {
            if (eventChallenges.length !== 0) {
              return removeWaitingChallenge(payloadHash);
            }
          });
      });
    }, 5000);

    return () => {
      clearInterval(id);
    };
  }, [waitingChallenges, walletInfo?.address, removeWaitingChallenge]);

  useEffect(() => {
    if (!waitingId) return;
    const id = setInterval(() => {
      fetch(
        `https://api.ghostnet.tzkt.io/v1/contracts/events?contract=${walletInfo?.address}&tag=resolve_proposal&payload.proposal_id=${waitingId}`
      )
        .then((r) => r.json())
        .then((v) => {
          const events = [...v];
          console.log(events);
          if (events.length === 0) return;

          if (events[0].payload.proposal_state.executed) {
            setClaimed(true);
          }

          clearInterval(id);
        });
    }, 5000);

    return () => {
      clearInterval(id);
    };
  }, [waitingId]);

  const transfertToBob = async () => {
    /* OLD WAY without AA */
    /*
    const op = await Tezos.contract.transfer({
      to: "tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6",
      amount: 1,
      mutez: true,
    });
    await op.confirmation(2);
    alert("1 mutez to bob => https://ghostnet.tzkt.io/" + op.hash);
    */

    /* NEW WAY WITH AA */

    /*
    const operationList = await wallet.requestSimulatedProofOfEvent();

    console.log("Operations:", atob(operationList));

    const preapply = await Tezos.rpc.preapplyOperations(
      JSON.parse(atob(operationList))
    );

    console.log("Preapply response:", preapply);

    if (
      preapply[0].contents.every(
        (transaction) =>
          // @ts-expect-error - We know the type that'll be returned
          transaction.metadata.internal_operation_results[0].result.status ===
          "applied"
      )
    ) {
      console.log(
        "The emitted proof of event:",
        // @ts-expect-error - We know the type that'll be returned
        preapply[0].contents[2].metadata.internal_operation_results[2]
      );
      alert("Simulated Proof Of Event succeeded");
    } else {
      alert("Simulated Proof Of Event failed");
    }
  };
*/

    let c: BankAccountWalletType = await Tezos.wallet.at<BankAccountWalletType>(
      "" + userAddress
    );

    try {
      let params = {
        ...{
          kind: TezosOperationType.TRANSACTION,
          destination: userAddress,
        },
        ...(
          await c.methodsObject.transfer_XTZ({
            0: "tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6" as address,
            1: BigNumber(1) as mutez,
          })
        ).toTransferParams(),
      };
      //FIXME bug parameters / parameter

      let result = await wallet.sendOperations(
        [{ ...params, parameters: params.parameter }]

        /*
        [
        {
          kind: TezosOperationType.TRANSACTION,
          destination: "tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6",
          amount: 1,
          mutez: true,
        },
      ]*/
      );

      /*
      const op = await c.methodsObject
        .transfer_XTZ({
          0: "tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6" as address,
          1: BigNumber(1) as mutez,
        })
        .send();
      await op.confirmation(2);*/
    } catch (error: any) {
      console.table(`Error: ${JSON.stringify(error, null, 2)}`);
    }
  };

  return (
    <div className="App">
      <h1>My Demo dapp</h1>

      <header className="App-header">
        <ConnectButton
          setTezos={setTezos}
          Tezos={Tezos}
          setUserAddress={setUserAddress}
          setUserBalance={setUserBalance}
          wallet={wallet}
          setWallet={setWallet}
          setWalletInfo={setWalletInfo}
        />

        <DisconnectButton
          wallet={wallet}
          setUserAddress={setUserAddress}
          setUserBalance={setUserBalance}
        />

        <div>
          I am {userAddress} with {userBalance} mutez
        </div>
      </header>

      {userAddress ? (
        <button onClick={transfertToBob}>Send 1 mutez to BOB</button>
      ) : (
        ""
      )}
    </div>
  );
}

export default App;
