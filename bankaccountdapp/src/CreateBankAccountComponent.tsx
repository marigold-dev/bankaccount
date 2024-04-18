import { TransactionInvalidBeaconError } from "@airgap/beacon-sdk";
import { AlertColor, TextField } from "@mui/material";
import { MichelsonMap } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { useContext, useState } from "react";
import { fetchContracts } from "./App";
import { STATUS, Storage } from "./bank_account.types";
import jsonContractTemplate from "./contractTemplate/bank_account.json";
import { AppDispatchContext, AppStateContext } from "./state";
import { address, mutez, nat } from "./type-aliases";
type CreateBankAccountComponentProps = {
  enqueueSnackbar: (message: string, variant: AlertColor) => void;
};

export const CreateBankAccountComponent = ({
  enqueueSnackbar,
}: CreateBankAccountComponentProps): JSX.Element => {
  const state = useContext(AppStateContext)!;
  const dispatch = useContext(AppDispatchContext);

  const [balanceForNewContract, setBalanceForNewContract] = useState<number>(0);
  const createBankAccountContract = async () => {
    try {
      const op = await state.connection.wallet
        .originate({
          code: jsonContractTemplate,
          storage: {
            owners: [state.address as address],
            inheritors: [],
            status: { aCTIVE: true } as STATUS,
            direct_debit_mandates: new MichelsonMap(),
            direct_debit_mandates_history: new MichelsonMap(),
            quick_recovery_period: new BigNumber(0) as nat,
            quick_recovery_stake: new BigNumber(1) as mutez,
          } as Storage,
          balance: balanceForNewContract,
        })
        .send();

      await op.confirmation(2);

      enqueueSnackbar(
        `Origination completed for ${(await op.contract()).address}.`,
        "success"
      );

      dispatch!({
        type: "refreshContracts",
        payload: {
          contracts: { ...(await fetchContracts(state)) },
        },
      });
    } catch (error) {
      console.table(`Error: ${JSON.stringify(error, null, 2)}`);
      let tibe: TransactionInvalidBeaconError =
        new TransactionInvalidBeaconError(error);
      enqueueSnackbar(tibe.message, "error");
    }
  };

  return (
    <>
      <button onClick={createBankAccountContract}>Create Bank account</button>{" "}
      <TextField
        type="number"
        label="deposit (in tez)"
        variant="standard"
        value={balanceForNewContract}
        onChange={(v) => setBalanceForNewContract(Number(v.target.value))}
      />
    </>
  );
};

export default CreateBankAccountComponent;
