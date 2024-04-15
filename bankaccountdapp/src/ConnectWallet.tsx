import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { connectWallet } from "./connectWallet";
import { AppDispatchContext, AppStateContext } from "./state";

const ConnectButton = (): JSX.Element => {
  const state = useContext(AppStateContext)!;
  const dispatch = useContext(AppDispatchContext);

  const navigate = useNavigate();

  return (
    <div className="buttons">
      <button
        className="button"
        onClick={() => {
          connectWallet(state, dispatch!); //remove url params
          navigate("/");
        }}
      >
        <i className="fas fa-times"></i>&nbsp; Connect wallet
      </button>
    </div>
  );
};

export default ConnectButton;
