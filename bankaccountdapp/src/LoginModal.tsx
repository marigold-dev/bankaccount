import { AlertColor, Box, MenuItem, Modal } from "@mui/material";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import bs58check from "bs58check";
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import CreateBankAccountComponent from "./CreateBankAccountComponent";
import { Event } from "./P2PClient";
import { connectWallet } from "./connectWallet";
import { p2pData } from "./interface";
import { AppDispatchContext, AppStateContext } from "./state";
import { hasTzip27Support } from "./util";
enum State {
  INITIAL,
  LOADING,
  AUTHORIZED,
  REFUSED,
  LOGIN,
  ERROR,
}

export function decodeData(data: string): p2pData {
  try {
    const decoded = JSON.parse(
      new TextDecoder().decode(bs58check.decode(data))
    );

    if ("name" in decoded && "id" in decoded && "relayServer" in decoded)
      return decoded as p2pData;
  } catch {}

  throw new Error("The code is not valid");
}

type LoginModalProps = {
  openModal: boolean;
  setOpenModal: Dispatch<SetStateAction<boolean>>;
  data: string | undefined;
  onEnd: () => void;
  enqueueSnackbar: (message: string, variant: AlertColor) => void;
};

const LoginModal = ({
  data,
  onEnd,
  openModal,
  setOpenModal,
  enqueueSnackbar,
}: LoginModalProps) => {
  const navigate = useNavigate();

  const state = useContext(AppStateContext)!;
  const dispatch = useContext(AppDispatchContext)!;

  const [parsedData, setParsedData] = useState<undefined | p2pData>();
  const [error, setError] = useState<undefined | string>();

  type WalletConf = { id: string; value: string; label: string };

  const options = useMemo(() => {
    if (
      !state.address &&
      (!state.contracts || Object.keys(state.contracts).length == 0)
    ) {
      return [];
    }

    return Object.keys(state.contracts).flatMap((address) => {
      if (!hasTzip27Support("0.3.4")) return [];

      return JSON.stringify({
        id: address,
        value: address,
        label: state.aliases[address],
      });
    }) as string[];
  }, [state.contracts, state.address]);

  const [selectedWallet, setSelectedWallet] = useState<string | undefined>(); //stringified object of WalletConf

  const [currentState, setCurrentState] = useState(() => State.LOADING);

  useEffect(() => {
    if (!state.p2pClient) return;

    try {
      const decoded = decodeData(data!);

      setParsedData(decoded);

      state.p2pClient!.on(Event.PERMISSION_REQUEST, () => {
        if (!state.address) {
          setCurrentState(State.LOGIN);
        } else if (
          decoded.name.toLowerCase().includes("bankaccount") ||
          decoded.appUrl.toLowerCase().includes("bankaccount")
        ) {
          setError("TzSafe can't pair with itself for now");
          setCurrentState(State.ERROR);
        } else {
          setCurrentState(State.INITIAL);
        }
      });

      state.p2pClient!.addPeer(decoded);
    } catch (e) {
      setError((e as Error).message);
      setCurrentState(State.ERROR);
    }
  }, [data, state.p2pClient]);

  useEffect(() => {
    if (currentState === State.LOGIN && state.address) {
      console.log("Let's start the flow now as user is logged ...", options);
      setCurrentState(State.INITIAL);
    }
  }, [state.address]);

  const style = {
    position: "absolute" as "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "50vw",
    bgcolor: "background.paper",
    color: "black",
    border: "2px solid #000",
    boxShadow: 24,
    p: 4,
  };

  const handleClose = () => setOpenModal(false);
  return (
    <Modal open={openModal} onClose={handleClose}>
      <Box sx={style}>
        {(() => {
          switch (currentState) {
            case State.LOADING:
              return (
                <div className="flex  flex-col items-center justify-center space-y-4">
                  <p>Waiting for Beacon connection</p>

                  <div className="mt-4">
                    <button
                      className="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-red-500 hover:outline-none focus:bg-red-500"
                      onClick={async () => {
                        try {
                          await state.p2pClient?.refusePermission();
                        } catch (error) {
                          console.error("Error refusePermission", error);
                        }
                        handleClose();
                        onEnd();
                      }}
                    >
                      Reset connection
                    </button>
                  </div>
                </div>
              );

            case State.INITIAL:
              if (options.length === 0) {
                return (
                  <>
                    <h1 className="text-center text-lg font-medium">
                      You don't have a bank account yet
                    </h1>

                    <CreateBankAccountComponent
                      enqueueSnackbar={enqueueSnackbar}
                    />

                    <div className="mt-4 flex justify-center">
                      <button
                        className="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-red-500 hover:outline-none focus:bg-red-500"
                        onClick={() => {
                          state.p2pClient?.refusePermission();
                          onEnd();
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </>
                );
              } else {
                return (
                  <>
                    <div className="w-full">
                      <Select
                        label="Wallet to connect"
                        value={selectedWallet}
                        onChange={(event: SelectChangeEvent) => {
                          const selectedWallet = JSON.parse(
                            event.target.value as string
                          ) as WalletConf;
                          console.log("selectedWallet", selectedWallet);

                          setSelectedWallet(event.target.value);
                        }}
                        renderValue={(stringified: string) => {
                          const o = JSON.parse(stringified) as WalletConf;
                          return (
                            <div className="flex flex-col items-start overflow-hidden">
                              <span>{o.label}</span>
                              <span className="text-zinc-400">{o.value}</span>
                            </div>
                          );
                        }}
                      >
                        {options.map((o) => (
                          <MenuItem
                            key={(JSON.parse(o) as WalletConf).value}
                            value={o}
                          >
                            <div className="flex flex-col items-start overflow-hidden">
                              <span>{(JSON.parse(o) as WalletConf).label}</span>
                              <span className="text-zinc-400">
                                {(JSON.parse(o) as WalletConf).value}
                              </span>
                            </div>
                          </MenuItem>
                        ))}
                      </Select>
                    </div>
                    <div className="mt-4 flex items-center justify-center space-x-4">
                      <button
                        type="button"
                        className="rounded border-2 bg-transparent px-3 py-1 font-medium text-white hover:outline-none"
                        onClick={async (e) => {
                          e.preventDefault();

                          if (!state.p2pClient!.hasReceivedPermissionRequest())
                            return;

                          await state.p2pClient!.refusePermission();
                          setCurrentState(State.REFUSED);
                        }}
                      >
                        Refuse
                      </button>
                      <button
                        type="button"
                        className={
                          "rounded border-2 border-primary bg-primary px-3 py-1 font-medium text-white hover:border-red-500 hover:bg-red-500 hover:outline-none focus:border-red-500 focus:bg-red-500"
                        }
                        onClick={async (e) => {
                          console.log(
                            "Authorize",
                            parsedData,
                            state.p2pClient!.hasReceivedPermissionRequest(),
                            selectedWallet
                          );

                          e.preventDefault();

                          if (
                            !parsedData ||
                            !state.p2pClient!.hasReceivedPermissionRequest() ||
                            !selectedWallet
                          )
                            return;

                          setCurrentState(State.LOADING);

                          await state.p2pClient!.approvePermission(
                            (JSON.parse(selectedWallet) as WalletConf).value
                          );
                          setCurrentState(State.AUTHORIZED);
                          dispatch({
                            type: "addDapp",
                            payload: {
                              data: parsedData,
                              address: (
                                JSON.parse(selectedWallet) as WalletConf
                              ).value,
                            },
                          });
                        }}
                      >
                        Authorize
                      </button>
                    </div>
                  </>
                );
              }
            case State.REFUSED:
              return (
                <>
                  <h1 className="text-center text-lg font-medium">
                    You have refused the connection to{" "}
                    {parsedData?.name ?? "Dapp"}{" "}
                  </h1>
                  <div className="mt-4 flex justify-center">
                    <button
                      className="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-red-500 hover:outline-none focus:bg-red-500"
                      onClick={onEnd}
                    >
                      Close
                    </button>
                  </div>
                </>
              );
            case State.AUTHORIZED:
              return (
                <>
                  <h1 className="text-center text-lg font-medium">
                    Successfully connected to {parsedData?.name ?? "Dapp"}
                  </h1>
                  <div className="mt-4 flex justify-center">
                    <button
                      className="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-red-500 hover:outline-none focus:bg-red-500"
                      onClick={onEnd}
                    >
                      Close
                    </button>
                  </div>
                </>
              );

            case State.LOGIN:
              return (
                <>
                  <h1 className="text-center text-lg font-medium">
                    Owner not logged
                  </h1>
                  <p className="mt-2 text-center text-sm text-zinc-400">
                    To establish a connection with a DApp using Bank Account,
                    log with a classic Tezos account{" "}
                  </p>
                  <div className="mt-4 flex w-full items-center justify-center space-x-4">
                    <button
                      className="rounded border bg-transparent px-4 py-2 font-medium text-white "
                      onClick={() => {
                        state.p2pClient?.refusePermission();
                        onEnd();
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        await connectWallet(state, dispatch);
                        //remove url params
                        navigate("/");
                      }}
                      type="button"
                      className={`rounded bg-primary px-4 py-2 font-medium text-white hover:bg-red-500 hover:outline-none focus:bg-red-500 ${
                        !state.beaconWallet
                          ? "pointer-events-none opacity-50"
                          : ""
                      }`}
                    >
                      Connect{" "}
                    </button>
                  </div>
                </>
              );
            case State.ERROR:
              return (
                <>
                  <h1 className="text-lg font-medium">An error occured</h1>
                  <p>{error}</p>
                  <div className="mt-4">
                    <button
                      className="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-red-500 hover:outline-none focus:bg-red-500"
                      onClick={async () => {
                        try {
                          await state.p2pClient?.refusePermission();
                        } catch (error) {
                          console.error("Error refusePermission", error);
                        }
                        handleClose();
                        onEnd();
                      }}
                    >
                      Close
                    </button>
                  </div>
                </>
              );
          }
        })()}
      </Box>
    </Modal>
  );
};

export default LoginModal;
