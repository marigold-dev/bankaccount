import {
  AppMetadata,
  BeaconErrorType,
  OperationRequestOutput,
  ProofOfEventChallengeRequestOutput,
  SignPayloadRequest,
  SimulatedProofOfEventChallengeRequest,
  TezosOperationType,
} from "@airgap/beacon-sdk";
import { AlertColor, Box, Modal } from "@mui/material";
import BigNumber from "bignumber.js";
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
  version,
} from "react";

import { Event } from "./P2PClient";

import { VersionedApi, signers } from "./apis";
import { BankAccountWalletType } from "./bank_account.types";
import { CustomView } from "./dapps";
import { transfer } from "./interface";
import { AppDispatchContext, AppStateContext } from "./state";
import { address, mutez } from "./type-aliases";
import { hasTzip27SupportWithPoEChallenge } from "./util";

export enum State {
  LOADING = -10,
  IDLE = -1,
  CODE = 0,
  AUTHORIZE = 10,
  AUTHORIZED = 20,
  REFUSED = 30,
  TRANSACTION = 40,
}

type PoeModalProps = {
  openPoeModal: boolean;
  setOpenPoeModal: Dispatch<SetStateAction<boolean>>;
  enqueueSnackbar: (message: string, variant: AlertColor) => void;
};

const PoeModal = ({
  openPoeModal,
  setOpenPoeModal,
  enqueueSnackbar,
}: PoeModalProps) => {
  const state = useContext(AppStateContext)!;
  const dispatch = useContext(AppDispatchContext)!;

  const [currentMetadata, setCurrentMetadata] = useState<
    undefined | [string, AppMetadata]
  >();
  const [address, setAddress] = useState<undefined | string>();
  const [message, setMessage] = useState<
    undefined | ProofOfEventChallengeRequestOutput
  >();
  const [transfers, setTransfers] = useState<transfer[] | undefined>();
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionError, setTransactionError] = useState<undefined | string>(
    undefined
  );
  const [timeoutAndHash, setTimeoutAndHash] = useState([false, ""]);
  const [hasDefaultView, setHasDefaultView] = useState(false);
  const [currentState, setCurrentState] = useState(State.IDLE);

  const [signImmediatelyFlag, setSignImmediatelyFlag] = useState(true);
  const [resolveImmediatelyFlag, setResolveImmediatelyFlag] = useState(false);

  const { dapp } = useMemo(() => {
    if (transfers && transfers.length > 0) setOpenPoeModal(true);

    let dapp: CustomView;
    return { dapp };
  }, [transfers]);

  useEffect(() => {
    if (!state.p2pClient) return;

    const challengeCb = (message: ProofOfEventChallengeRequestOutput) => {
      setMessage(message);
      setAddress(message.contractAddress);
    };

    const transactionCb = async (message: OperationRequestOutput) => {


      if (!state.contracts[message.sourceAddress]) {
        state.p2pClient?.abortRequest(
          message.id,
          "The contract is not an imported TzSafe one"
        );
        console.log(" The contract is not an imported TzSafe one");
        return;
      }

      if (!!currentMetadata) {
        state.p2pClient?.abortRequest(
          message.id,
          "There's already a pending request"
        );
        console.log("There's already a pending request");

        return;
      }
      setAddress(message.sourceAddress);
      setCurrentMetadata([message.id, message.appMetadata]);

      if (message.operationDetails.length === 0) {
        await state.p2pClient?.sendError(
          message.id,
          "Request was empty",
          BeaconErrorType.TRANSACTION_INVALID_ERROR
        );
        setTransactionError("Operations were empty");

        console.log("Operations were empty");

        return;
      }

      const transfers: transfer[] = message.operationDetails.map((detail) => {
        console.log("Operation details", detail);

        return {
          type: "transfer",
          values: {
            to:
              detail.kind == TezosOperationType.TRANSACTION
                ? detail.destination
                : "",
            amount:
              detail.kind == TezosOperationType.TRANSACTION
                ? detail.amount
                : "",
            parameters:
              detail.kind == TezosOperationType.TRANSACTION
                ? detail.parameters
                : {},
          },
        };
      });

      // Even if there's an error, setting transfers is a requirement to show the modal
      setTransfers(transfers.filter((v) => !!v));

      setCurrentState(State.TRANSACTION);
    };

    const signPayloadCb = async (message: SignPayloadRequest) => {
      try {
        const contract = await state.connection.wallet.at(
          message.sourceAddress
        );

        const storage: any = await contract.storage();
        let version = "0.3.4";

        if (version === "unknown version") {
          state.p2pClient?.abortRequest(
            message.id,
            "Current user isn't a signer"
          );

          throw new Error("The contract is not a TzSafe contract");
        }

        if (!signers(storage).includes(state.address ?? "")) {
          state.p2pClient?.abortRequest(
            message.id,
            "Current user isn't a signer"
          );
          return;
        }

        const signed =
          //@ts-expect-error For a reason I don't know I can't access client like in taquito documentation
          // See: https://tezostaquito.io/docs/signing/#generating-a-signature-with-beacon-sdk
          await state.connection.wallet.walletProvider.client.requestSignPayload(
            {
              signingType: message.signingType,
              payload: message.payload,
              sourceAddress: state.address,
            }
          );
        await state.p2pClient?.signResponse(
          message.id,
          message.signingType,
          signed.signature
        );
      } catch (e) {
        state.p2pClient?.sendError(
          message.id,
          `Failed to sign the payload: ${(e as Error).message}`,
          BeaconErrorType.SIGNATURE_TYPE_NOT_SUPPORTED
        );
      }
    };

    const simulatedProofOfEventCb = async (
      message: SimulatedProofOfEventChallengeRequest
    ) => {
      const contract = state.contracts[message.contractAddress];

      if (!contract) {
        state.p2pClient?.sendError(
          message.id,
          "The address is not a TzSafe one",
          BeaconErrorType.UNKNOWN_ERROR
        );
        return;
      }

      const api = VersionedApi("0.3.4", message.contractAddress);

      try {
        const ops = await api.generateSpoeOps(
          message.payload,
          await state.connection.wallet.at(message.contractAddress),
          state.connection
        );

        await state.p2pClient?.spoeResponse(message.id, ops);
      } catch (e) {
        await state.p2pClient?.spoeResponse(
          message.id,
          [],
          (e as Error).message
        );
      }
    };

    const tinyEmitter = state.p2pClient.on(
      Event.PROOF_OF_EVENT_CHALLENGE_REQUEST,
      challengeCb
    );

    state.p2pClient.on(Event.INCOMING_OPERATION, transactionCb);
    state.p2pClient.on(Event.SIGN_PAYLOAD, signPayloadCb);
    state.p2pClient.on(
      Event.SIMULATED_PROOF_OF_EVENT_CHALLENGE_REQUEST,
      simulatedProofOfEventCb
    );

    return () => {
      tinyEmitter.off(Event.PROOF_OF_EVENT_CHALLENGE_REQUEST, challengeCb);
      tinyEmitter.off(Event.INCOMING_OPERATION, transactionCb);
      tinyEmitter.off(Event.SIGN_PAYLOAD, signPayloadCb);
      tinyEmitter.off(
        Event.SIMULATED_PROOF_OF_EVENT_CHALLENGE_REQUEST,
        simulatedProofOfEventCb
      );
    };
  }, [state.p2pClient, state.address]);

  if (!message && !transfers) return null;

  const reset = () => {
    setTransfers(undefined);
    setCurrentMetadata(undefined);
    setTimeoutAndHash([false, ""]);
    setTransactionError(undefined);
    setMessage(undefined);
    setCurrentState(State.IDLE);
    setAddress(undefined);
  };

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

  const handleClose = () => setOpenPoeModal(false);

  return (
    <Modal open={openPoeModal} onClose={handleClose}>
      <Box sx={style}>
        {(() => {
          switch (currentState) {
            case State.LOADING:
              return (
                <div className="flex items-center justify-center">
                  Loading ...
                </div>
              );

            case State.TRANSACTION:
              if (transactionLoading)
                return (
                  <div className="flex w-full flex-col items-center justify-center">
                    <span className="mt-4 text-center text-zinc-400">
                      Sending and waiting for transaction confirmation (It may
                      take a few minutes)
                    </span>
                  </div>
                );

              if (timeoutAndHash[0])
                return (
                  <div className="col-span-2 flex w-full flex-col items-center justify-center">
                    <div className="mb-2 mt-4 self-start text-2xl font-medium text-white">
                      The wallet {"can't"} confirm that the transaction has been
                      validated. You can check it in{" "}
                      <a
                        className="text-zinc-200 hover:text-zinc-300"
                        href={`https://ghostnet.tzkt.io/${timeoutAndHash[1]}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        the explorer
                      </a>
                      , and if it is, {"it'll"} appear in the proposals
                    </div>
                    <button
                      className="mt-6 rounded border-2 bg-transparent p-2 font-medium text-white hover:outline-none"
                      onClick={reset}
                    >
                      Close
                    </button>
                  </div>
                );

              if (!!transactionError)
                return (
                  <div className="col-span-2 flex w-full flex-col items-center justify-center">
                    <div className="mb-2 mt-4 w-full text-center text-xl font-medium text-white">
                      {transactionError}
                    </div>
                    <button
                      className="mt-6 rounded border-2 bg-transparent p-2 font-medium text-white hover:outline-none"
                      onClick={reset}
                    >
                      Close
                    </button>
                  </div>
                );

              if (!timeoutAndHash[0] && !!timeoutAndHash[1])
                return (
                  <div className="col-span-2 flex w-full flex-col items-center justify-center text-center">
                    <p>Transfer done!</p>
                    <button
                      className="mt-6 rounded border-2 bg-transparent p-2 font-medium text-white hover:outline-none"
                      onClick={reset}
                    >
                      Close
                    </button>
                  </div>
                );

              if (!transfers) return null;

              return (
                <>
                  <div
                    className={`col-span-2 flex w-full flex-col ${
                      hasDefaultView ? "items-center" : ""
                    } justify-center`}
                  >
                    <div className="mb-2 self-start text-2xl font-medium text-white">
                      Incoming transfer{" "}
                      {(transfers?.length ?? 0) > 1 ? "s" : ""} requested from{" "}
                      {currentMetadata?.[1].name}
                    </div>
                    <p className="self-start text-sm text-zinc-400">
                      Target bank account is {address ?? ""}
                    </p>

                    <code>{transfers.map((t) => JSON.stringify(t))}</code>
                    {state.currentContract !== address && (
                      <p className="self-start text-sm text-yellow-500">
                        The signing wallet is different from{" "}
                        {state.currentContract ?? ""}
                      </p>
                    )}
                    {!!dapp?.logo && (
                      <a
                        className="mt-4 flex space-x-2 self-start"
                        href={dapp.logoLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <h3>{dapp.dappName}</h3>
                        <img
                          src={dapp.logo}
                          alt={dapp.dappName}
                          className="h-6 w-6"
                        />
                      </a>
                    )}

                    <div className="mt-6 flex w-2/3 justify-between md:mx-auto md:w-1/3">
                      <button
                        className="my-2 rounded border-2 bg-transparent p-2 font-medium text-white hover:outline-none"
                        onClick={async (e) => {
                          if (!currentMetadata) return;

                          e.preventDefault();

                          const metadata = currentMetadata[0];
                          reset();
                          await state.p2pClient?.abortRequest(
                            metadata,
                            "Cancelled by the user"
                          );
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="hover:border-offset-2 hover:border-offset-gray-800 my-2 rounded bg-primary p-2 font-medium text-white hover:bg-red-500 hover:outline-none focus:bg-red-500"
                        type="submit"
                        onClick={async () => {
                          if (!address || !currentMetadata) return;

                          setTransactionLoading(true);

                          let hash;
                          try {
                            const cc: BankAccountWalletType =
                              await state.connection.wallet.at<BankAccountWalletType>(
                                address
                              );

                            const op = await cc.methodsObject
                              .transfer_XTZ({
                                0:
                                  transfers[0].type == "transfer"
                                    ? (transfers[0].values.parameters!["value"]
                                        .args[0].string as address)
                                    : ("" as address),
                                1:
                                  transfers[0].type == "transfer"
                                    ? (new BigNumber(
                                        transfers[0].values.parameters![
                                          "value"
                                        ].args[1].int
                                      ) as mutez)
                                    : (BigNumber(0) as mutez),
                              })
                              .send();

                            await op.confirmation(2);

                            await state.p2pClient?.transactionResponse(
                              currentMetadata[0],
                              op.opHash
                            );

                            setTransfers([]);
                            setOpenPoeModal(false);
                          } catch (e) {
                            console.log("Error", e);

                            state.p2pClient?.abortRequest(
                              currentMetadata[0],
                              "User cancelled the transaction"
                            );
                            setTransactionLoading(false);
                            setTransactionError(
                              "Failed to create the transaction. Please try again later"
                            );

                            return;
                          }

                          setTransactionLoading(false);
                        }}
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </>
              );
            default:
              if (!message) return null;

              return hasTzip27SupportWithPoEChallenge("0.3.4") ? (
                <>
                  <h1 className="text-lg font-medium">
                    Message Signing Request from {message.appMetadata.name}
                  </h1>
                  <p className="mt-4 font-light text-zinc-200">
                    {message.appMetadata.name} requests message signing from{" "}
                    {state.aliases[address ?? ""]}. The payload of the message
                    is as follows:
                  </p>
                  <ul className="mt-2 space-y-1">
                    <li className="truncate">
                      <span className="font-light">Payload:</span>{" "}
                      {state.p2pClient?.proofOfEvent.data?.payload}
                    </li>
                  </ul>

                  <div className="mt-8 flex justify-around">
                    <button
                      className="rounded border-2 bg-transparent px-4 py-2 font-medium text-white hover:outline-none"
                      onClick={async () => {
                        await state.p2pClient?.refusePoeChallenge();
                        reset();
                      }}
                    >
                      Refuse
                    </button>
                    <button
                      className="rounded bg-primary px-4 py-2 font-medium text-white hover:bg-red-500 hover:outline-none focus:bg-red-500"
                      onClick={() => alert("ProposalCall")}
                    >
                      Accept
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-lg font-medium">
                    Does not support message signing {"(TZIP27)"}
                  </h1>
                  <p className="mt-4 font-light text-zinc-200">
                    {state.aliases[address ?? ""]} version is {version};
                    however, version 0.3.4 or higher is required.
                  </p>
                  <div className="mt-8 flex justify-around">
                    <button
                      className="rounded border-2 bg-transparent px-4 py-2 font-medium text-white hover:outline-none"
                      onClick={async () => {
                        await state.p2pClient?.refusePoeChallenge();
                        reset();
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

export default PoeModal;
