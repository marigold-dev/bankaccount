import { useContext } from "react";
import { AppDispatchContext, AppStateContext } from "./state";

const DisconnectButton = (): JSX.Element => {
  const state = useContext(AppStateContext)!;
  const dispatch = useContext(AppDispatchContext);

  const disconnectWallet = async (): Promise<void> => {
    if (state?.beaconWallet) {
      await state.beaconWallet.clearActiveAccount();
    }
    dispatch!({ type: "logout" });
  };

  return (
    <div className="buttons">
      <button className="button" onClick={disconnectWallet}>
        <i className="fas fa-times"></i>&nbsp; Disconnect wallet
      </button>
    </div>
  );
};

export default DisconnectButton;
