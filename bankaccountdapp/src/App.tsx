import { TransactionInvalidBeaconError } from "@airgap/beacon-sdk";
import { NetworkType } from "@airgap/beacon-types";
import { Snackbar } from "@mui/base/Snackbar";
import { Alert, AlertColor, TextField } from "@mui/material";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { TezosToolkit } from "@taquito/taquito";
import * as api from "@tzkt/sdk-api";
import { useEffect, useState } from "react";
import "./App.css";
import ConnectButton from "./ConnectWallet";
import DisconnectButton from "./DisconnectWallet";
import { STATUS } from "./bank_account.types";
import jsonContractTemplate from "./contractTemplate/bank_account.json";
import { address } from "./type-aliases";

function App() {
  api.defaults.baseUrl = "https://api.ghostnet.tzkt.io";

  //snackbar
  const [open, setOpen] = useState(false);
  const [exited, setExited] = useState(true);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<AlertColor>("info");

  const enqueueSnackbar = (message: string, variant: AlertColor) => {
    setMessage(message);
    setStatus(variant);
    setOpen(true);
  };

  const Tezos = new TezosToolkit("https://ghostnet.tezos.marigold.dev");
  const wallet = new BeaconWallet({
    name: "Training",
    preferredNetwork: NetworkType.GHOSTNET,
  });
  Tezos.setWalletProvider(wallet);

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

  const [userAddress, setUserAddress] = useState<string>("");
  const [userBalance, setUserBalance] = useState<number>(0);

  const [balanceForNewContract, setBalanceForNewContract] = useState<number>(0);

  const [contracts, setContracts] = useState<Array<api.Contract>>([]);
  const fetchContracts = () => {
    (async () => {
      setContracts(
        (
          await api.contractsGetSimilar(import.meta.env.VITE_CONTRACT_ADDRESS, {
            includeStorage: true,
            sort: { desc: "id" },
          })
        ).filter(
          (c) =>
            (c.storage.owners as string[]).findIndex(
              (owner) => owner === userAddress
            ) >= 0
        )
      );
    })();
  };

  const createBankAccountContract = async () => {
    try {
      const op = await Tezos.wallet
        .originate({
          code: jsonContractTemplate,
          storage: {
            owners: [userAddress as address],
            inheritors: [],
            status: { aCTIVE: true } as STATUS,
          },
          balance: balanceForNewContract,
        })
        .send();

      await op.confirmation(2);

      enqueueSnackbar(
        `Origination completed for ${(await op.contract()).address}.`,
        "success"
      );

      await fetchContracts();
    } catch (error) {
      console.table(`Error: ${JSON.stringify(error, null, 2)}`);
      let tibe: TransactionInvalidBeaconError =
        new TransactionInvalidBeaconError(error);
      enqueueSnackbar(tibe.message, "error");
    }
  };

  return (
    <div className="App">
      <Snackbar
        open={open}
        onClose={(_, reason) => {
          if (reason === "clickaway") {
            return;
          }
          setOpen(false);
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
      <ConnectButton
        Tezos={Tezos}
        setUserAddress={setUserAddress}
        setUserBalance={setUserBalance}
        wallet={wallet}
      />
      <DisconnectButton
        wallet={wallet}
        setUserAddress={setUserAddress}
        setUserBalance={setUserBalance}
      />
      <div>
        I am {userAddress} with {userBalance} mutez
      </div>
      <hr />
      <button onClick={createBankAccountContract}>
        Create Bank account
      </button>{" "}
      <TextField
        type="number"
        label="deposit (in tez)"
        variant="standard"
        value={balanceForNewContract}
        onChange={(v) => setBalanceForNewContract(Number(v.target.value))}
      />
      <hr />
      <button onClick={fetchContracts}>List of bank accounts</button>
      <table>
        <thead>
          <tr>
            <th>address</th>
            <th>owners</th>
            <th>balance</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr key={contract.address}>
              <td style={{ borderStyle: "dotted" }}>{contract.address}</td>
              <td style={{ borderStyle: "dotted" }}>
                {contract.storage !== null && contract.storage.owners !== null
                  ? (contract.storage.owners as string[]).join(",")
                  : ""}
              </td>
              <td style={{ borderStyle: "dotted" }}>
                {" "}
                {(contract.balance ?? 0) / 1000000} tez
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
