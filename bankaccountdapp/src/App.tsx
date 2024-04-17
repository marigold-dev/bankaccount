import { LocalStorage } from "@airgap/beacon-sdk";
import { NetworkType } from "@airgap/beacon-types";
import { Snackbar } from "@mui/base/Snackbar";
import DeleteIcon from "@mui/icons-material/Delete";
import { Alert, AlertColor, Chip, IconButton, TextField } from "@mui/material";
import { BeaconWallet } from "@taquito/beacon-wallet";
import * as api from "@tzkt/sdk-api";
import BigNumber from "bignumber.js";
import { useEffect, useReducer, useState } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import "./App.css";
import ConnectButton from "./ConnectWallet";
import CreateBankAccountComponent from "./CreateBankAccountComponent";
import CreateDirectDebitMandateComponent from "./CreateDirectDebitMandateComponent";
import DisconnectButton from "./DisconnectWallet";
import LoginModal from "./LoginModal";
import P2PClient from "./P2PClient";
import PoeModal from "./PoeModal";
import {
  BankAccountWalletType,
  FREQUENCY,
  Storage,
} from "./bank_account.types";
import {
  AppDispatchContext,
  AppStateContext,
  action,
  emptyState,
  reducer,
  tezosState,
} from "./state";
import { address, mutez } from "./type-aliases";

export const fetchContracts = async (
  state: tezosState,
  userAddress?: string
): Promise<{ [address: string]: [Storage, number] }> => {
  const contractsTZKT = (
    await api.contractsGetSimilar(import.meta.env.VITE_CONTRACT_ADDRESS, {
      includeStorage: true,
      sort: { desc: "id" },
    })
  ).filter(
    (c) =>
      (c.storage.owners as string[]).findIndex((owner) =>
        userAddress ? userAddress == owner : state.address == owner
      ) >= 0
  );

  // console.log("fetchContracts contractsTZKT", contractsTZKT);

  let contractsWithStorage = {} as { [address: string]: [Storage, number] };

  await Promise.all(
    contractsTZKT.map(async (tzktContract) => {
      contractsWithStorage[tzktContract.address as string] = [
        await (
          await state.connection.wallet.at<BankAccountWalletType>(
            "" + tzktContract.address
          )
        ).storage(),
        tzktContract.balance!,
      ];
    })
  );

  console.log("fetchContracts results", contractsWithStorage);

  return contractsWithStorage;
};

function App() {
  api.defaults.baseUrl = "https://api.ghostnet.tzkt.io";

  const [state, dispatch]: [tezosState, React.Dispatch<action>] = useReducer(
    reducer,
    emptyState()
  );

  const [openModal, setOpenModal] = useState(false);
  const [openPoeModal, setOpenPoeModal] = useState(false);

  //snackbar
  const [open, setOpen] = useState(false);
  const [exited, _setExited] = useState(true);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<AlertColor>("info");

  const enqueueSnackbar = (message: string, variant: AlertColor) => {
    setMessage(message);
    setStatus(variant);
    setOpen(true);
  };

  const [contracts, setContracts] = useState<{
    [address: string]: [Storage, number];
  }>({});

  const [data, setData] = useState<undefined | string>();

  const [direct_debit_mandates, setDirect_debit_mandates] = useState<
    Map<
      address,
      Map<
        {
          0: address;
          1: FREQUENCY;
        },
        mutez
      >
    >
  >(new Map());

  useEffect(() => {
    //IF DATA ON URL IT IS A PAIRING REQUEST FROM A DAPP
    const queryParams = new URLSearchParams(window.location.search);
    console.log("queryParams", queryParams);
    const isPairing = queryParams.has("type") && queryParams.has("data");

    if (isPairing) {
      setData(queryParams.get("data")!);
      setOpenModal(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (state!.beaconWallet === null) {
        let a = emptyState();

        const p2pClient = new P2PClient({
          name: "Bank Account",
          storage: new LocalStorage("P2P"),
        });

        await p2pClient.init();
        await p2pClient.connect(p2pClient.handleMessages);
        // Connect stored peers
        Object.entries(a.connectedDapps).forEach(async ([_address, dapps]) => {
          Object.values(dapps).forEach((data) => {
            p2pClient
              .addPeer(data)
              .catch((_) => console.log("Failed to connect to peer", data));
          });
        });

        const wallet = new BeaconWallet({
          name: "Bank Account",
          preferredNetwork: NetworkType.GHOSTNET,
          storage: new LocalStorage("WALLET"),
        });

        dispatch!({ type: "beaconConnect", payload: wallet });
        dispatch!({ type: "p2pConnect", payload: p2pClient });

        //if (state.attemptedInitialLogin) return;

        const activeAccount = await wallet.client.getActiveAccount();
        if (activeAccount && state?.accountInfo == null) {
          const userAddress = await wallet.getPKH();
          const balance = await state?.connection.tz.getBalance(userAddress);

          const contracts = await fetchContracts(state, userAddress);
          setContracts(contracts);

          dispatch({
            type: "login",
            accountInfo: activeAccount!,
            address: userAddress,
            balance: balance!.toString(),
            contracts: contracts,
          });
        }
      }
    })();
  }, [state.beaconWallet]);

  useEffect(() => {
    (async () => {
      if (state.contracts && Object.keys(state.contracts).length > 0) {
        console.log(
          "************Refreshing the mandates for the contracts ..."
        );

        //fetch also the mandates
        Promise.all(
          //fetch all keys from indexer

          Object.keys(state.contracts).map(async (contractAddress) => {
            //init map for this contract
            const currentContractdirect_debit_mandates = new Map<
              { 0: address; 1: FREQUENCY },
              mutez
            >();
            direct_debit_mandates.set(
              contractAddress as address,
              currentContractdirect_debit_mandates
            );

            //fetch info from indexer
            const contractStorage = state.contracts[contractAddress][0];
            const direct_debit_mandatesBigMapId = (
              contractStorage.direct_debit_mandates as unknown as {
                id: BigNumber;
              }
            ).id.toNumber();

            console.log(
              "************contractStorage.direct_debit_mandates",
              direct_debit_mandatesBigMapId
            );

            const direct_debit_mandatesBigMapKeys = await api.bigMapsGetKeys(
              direct_debit_mandatesBigMapId,
              {
                micheline: "Json",
                active: true,
              }
            );

            console.log(
              "************direct_debit_mandatesBigMapKeys",
              direct_debit_mandatesBigMapKeys
            );

            //for each key
            for (const direct_debit_mandatesBigMapKey of direct_debit_mandatesBigMapKeys) {
              const amount = await contractStorage.direct_debit_mandates.get({
                "0": direct_debit_mandatesBigMapKey.key.address,
                "1": direct_debit_mandatesBigMapKey.key.or,
              });

              console.log("************amount", amount);

              currentContractdirect_debit_mandates.set(
                {
                  "0": direct_debit_mandatesBigMapKey.key.address,
                  "1": direct_debit_mandatesBigMapKey.key.or,
                },
                amount
              );
              direct_debit_mandates.set(
                contractAddress as address,
                currentContractdirect_debit_mandates
              );
              setDirect_debit_mandates(new Map(direct_debit_mandates));
              console.log("direct_debit_mandates", direct_debit_mandates);
            }
          })
        );
      }
    })();
  }, [state.contracts]);

  const [claimedBankAccount, setClaimedBankAccount] = useState<
    string | undefined
  >();

  const start_recover = async () => {
    try {
      const cc: BankAccountWalletType =
        await state.connection.wallet.at<BankAccountWalletType>(
          claimedBankAccount!
        );

      const op = await cc.methodsObject
        .start_recover(state.address! as address)
        .send({
          amount: (await cc.storage()).quick_recovery_stake.toNumber(),
          mutez: true,
        });

      await op.confirmation(2);

      enqueueSnackbar(
        state.address +
          " has claimed recovery on bank account " +
          claimedBankAccount,
        "success"
      );
    } catch (e) {
      console.log("Error", e);
      return;
    }
  };

  const claim_recovery = async () => {
    try {
      const cc: BankAccountWalletType =
        await state.connection.wallet.at<BankAccountWalletType>(
          claimedBankAccount!
        );

      const op = await cc.methodsObject.claim_recovery().send();

      await op.confirmation(2);

      enqueueSnackbar(
        state.address + " has recovered bank account " + claimedBankAccount,
        "success"
      );
    } catch (e) {
      console.log("Error", e);
      return;
    }
  };

  const stop_recovery = async () => {
    try {
      const cc: BankAccountWalletType =
        await state.connection.wallet.at<BankAccountWalletType>(
          claimedBankAccount!
        );

      const op = await cc.methodsObject.stop_recovery().send();

      await op.confirmation(2);

      enqueueSnackbar(
        state.address +
          " has stopped bank account " +
          claimedBankAccount +
          " recovery",
        "success"
      );
    } catch (e) {
      console.log("Error", e);
      return;
    }
  };

  const revoke = async (bankAccount: string, ownerToRevoke: string) => {
    console.log("************" + ownerToRevoke + "****************");

    try {
      const cc: BankAccountWalletType =
        await state.connection.wallet.at<BankAccountWalletType>(bankAccount);

      const op = await cc.methodsObject.revoke(ownerToRevoke as address).send();

      await op.confirmation(2);

      enqueueSnackbar(
        ownerToRevoke + " has been revoked from bank account " + bankAccount,
        "success"
      );
    } catch (e) {
      console.log("Error", e);
      return;
    }
  };

  const revoke_direct_debit_mandate_XTZ = async (
    bankAccount: string,
    mandateKey: {
      0: address;
      1: FREQUENCY;
    }
  ) => {
    try {
      const cc: BankAccountWalletType =
        await state.connection.wallet.at<BankAccountWalletType>(bankAccount);

      const op = await cc.methodsObject
        .revoke_direct_debit_mandate_XTZ({
          "0": mandateKey[0],
          "1": mandateKey[1],
        })
        .send();

      await op.confirmation(2);

      await fetchContracts(state);

      enqueueSnackbar(
        "Mandate has been revoked from bank account " + bankAccount,
        "success"
      );
    } catch (e) {
      console.log("Error", e);
      return;
    }
  };

  const router = createBrowserRouter([
    {
      path: "/",
      element: (
        <div className="App">
          <LoginModal
            openModal={openModal}
            setOpenModal={setOpenModal}
            data={data}
            onEnd={() => {
              setData(undefined);
              setOpenModal(false);
            }}
            enqueueSnackbar={enqueueSnackbar}
          />

          <PoeModal
            openPoeModal={openPoeModal}
            setOpenPoeModal={setOpenPoeModal}
            enqueueSnackbar={enqueueSnackbar}
          />

          <Snackbar
            open={open}
            onClose={(_, reason) => {
              if (reason === "clickaway") {
                return;
              }
              setOpen(false);
              setOpenPoeModal(false);
              setMessage("");
            }}
            exited={exited}
            autoHideDuration={status == "error" ? 20000 : 5000}
          >
            <Alert variant="filled" severity={status}>
              {message}
            </Alert>
          </Snackbar>
          <h1>Bank Account Management</h1>
          <hr />
          <h2>Connection</h2>
          {state.address ? (
            <>
              <div>
                I am {state.address} with {state.balance} mutez
              </div>
              <DisconnectButton />
            </>
          ) : (
            <ConnectButton />
          )}
          <hr />
          <CreateBankAccountComponent enqueueSnackbar={enqueueSnackbar} />
          <hr />
          <h2>Bank accounts</h2>

          <button
            onClick={async () => setContracts(await fetchContracts(state))}
          >
            Refresh bank accounts
          </button>
          <table>
            <thead>
              <tr>
                <th>address</th>
                <th>owners</th>
                <th>balance</th>
                <th>status</th>
                <th>selected</th>
                <th>direct debit mandates </th>
              </tr>
            </thead>
            <tbody>
              {Array.from(Object.entries(contracts)).map(
                ([contractAddress, [contractStorage, contractBalance]]) => (
                  <tr key={contractAddress}>
                    <td style={{ borderStyle: "dotted" }}>{contractAddress}</td>
                    <td style={{ borderStyle: "dotted" }}>
                      {contractStorage !== null &&
                      contractStorage.owners !== null
                        ? contractStorage.owners.map((owner) => (
                            <Chip
                              onMouseDown={(event) => {
                                event.stopPropagation();
                              }}
                              key={owner}
                              variant="outlined"
                              color="primary"
                              label={owner}
                              onDelete={() => revoke(contractAddress, owner)}
                            />
                          ))
                        : ""}
                    </td>
                    <td style={{ borderStyle: "dotted" }}>
                      {" "}
                      {(contractBalance ?? 0) / 1000000} tez
                    </td>

                    <td style={{ borderStyle: "dotted" }}>
                      {"aCTIVE" in contractStorage.status
                        ? "ACTIVE"
                        : "dEAD" in contractStorage.status
                        ? "DEAD"
                        : "RECOVERING(" +
                          contractStorage.status.rECOVERING[3] +
                          "," +
                          contractStorage.status.rECOVERING[4] +
                          ")"}
                    </td>

                    <td style={{ borderStyle: "dotted" }}>
                      {state.currentContract == contractAddress ? "X" : ""}
                    </td>
                    <td style={{ borderStyle: "dotted" }}>
                      <>
                        <CreateDirectDebitMandateComponent
                          bankAccount={contractAddress}
                          enqueueSnackbar={enqueueSnackbar}
                        />

                        <table border={1}>
                          <thead>
                            <tr>
                              <th>beneficiary</th>
                              <th>frequency</th>
                              <th>amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {direct_debit_mandates &&
                            direct_debit_mandates.size > 0
                              ? [
                                  ...direct_debit_mandates.get(
                                    contractAddress as address
                                  )!,
                                ].map((directDebitMandateEntry) => (
                                  <tr
                                    key={
                                      directDebitMandateEntry[0][0] +
                                      "-" +
                                      directDebitMandateEntry[0][1]
                                    }
                                  >
                                    <td>{directDebitMandateEntry[0][0]}</td>
                                    <td>
                                      {JSON.stringify(
                                        directDebitMandateEntry[0][1]
                                      )}
                                    </td>
                                    <td style={{ borderStyle: "dotted" }}>
                                      {directDebitMandateEntry[1].toNumber()}
                                    </td>
                                    <td>
                                      <IconButton
                                        onClick={() =>
                                          revoke_direct_debit_mandate_XTZ(
                                            contractAddress,
                                            directDebitMandateEntry[0]
                                          )
                                        }
                                      >
                                        <DeleteIcon color="error" />
                                      </IconButton>
                                    </td>
                                  </tr>
                                ))
                              : ""}
                          </tbody>
                        </table>
                      </>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>

          <hr />

          <h2>Recovery process </h2>

          <TextField
            type="text"
            label="KT1 to claim"
            variant="standard"
            value={claimedBankAccount}
            onChange={(v) => setClaimedBankAccount(v.target.value)}
          />
          <button onClick={start_recover}>Recover bank account</button>
          <button onClick={claim_recovery}>Claim bank account</button>
          <button onClick={stop_recovery}>Stop bank account recovery</button>
        </div>
      ),
    },
  ]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        <RouterProvider router={router}></RouterProvider>
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export default App;
