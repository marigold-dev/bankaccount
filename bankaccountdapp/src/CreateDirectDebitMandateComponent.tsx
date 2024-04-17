import { Option } from "@mui/base";
import { Select } from "@mui/base/Select";
import { AlertColor, TextField } from "@mui/material";
import BigNumber from "bignumber.js";
import { useContext, useState } from "react";
import { fetchContracts } from "./App";
import { BankAccountWalletType, FREQUENCY } from "./bank_account.types";
import { AppDispatchContext, AppStateContext } from "./state";
import { address, mutez, nat } from "./type-aliases";
type CreateDirectDebitMandateComponentProps = {
  enqueueSnackbar: (message: string, variant: AlertColor) => void;
  bankAccount: string;
};

export const CreateDirectDebitMandateComponent = ({
  enqueueSnackbar,
  bankAccount,
}: CreateDirectDebitMandateComponentProps): JSX.Element => {
  const state = useContext(AppStateContext)!;
  const dispatch = useContext(AppDispatchContext);

  const [beneficiaryAddress, setBeneficiaryAddress] = useState<string>("");
  const [frequency, setFrequency] = useState<string>("mONTH");
  const [frequencyCount, setFrequencyCount] = useState<number>(1);

  const [amount, setAmount] = useState<number>(0);

  const createDirectDebitMandate = async () => {
    try {
      const cc: BankAccountWalletType =
        await state.connection.wallet.at<BankAccountWalletType>(bankAccount);

      const op = await cc.methodsObject
        .add_direct_debit_mandate_XTZ({
          0: beneficiaryAddress as address,
          1: { [frequency]: new BigNumber(frequencyCount) as nat } as FREQUENCY,
          2: new BigNumber(amount * 1000000) as mutez,
        })
        .send();

      await op.confirmation(2);

      enqueueSnackbar(
        "New direct debit mandate has been added to bank account " +
          bankAccount,
        "success"
      );

      await fetchContracts(state);
    } catch (e) {
      console.log("Error", e);
      return;
    }
  };

  return (
    <>
      <TextField
        type="text"
        label="Beneficiary"
        variant="standard"
        value={beneficiaryAddress}
        onChange={(v) => setBeneficiaryAddress(v.target.value)}
      />
      <TextField
        type="number"
        label="amount (in tez)"
        variant="standard"
        value={amount}
        onChange={(v) => setAmount(Number(v.target.value))}
      />
      <TextField
        type="number"
        label="nb times per"
        variant="standard"
        value={frequencyCount}
        onChange={(v) => setFrequencyCount(Number(v.target.value))}
      />
      <Select
        title="Choose frequency"
        name="frequency"
        value={frequency}
        onChange={(_, newValue) => {
          if (newValue) setFrequency(newValue);
        }}
      >
        <Option value="sECOND">second</Option>
        <Option value="mINUTE">minute</Option>
        <Option value="hOUR">hour</Option>
        <Option value="dAY">day</Option>
        <Option value="wEEK">week</Option>
        <Option value="mONTH">month</Option>
        <Option value="yEAR">year</Option>
      </Select>
      <button onClick={createDirectDebitMandate}>Create mandate</button>{" "}
    </>
  );
};

export default CreateDirectDebitMandateComponent;
