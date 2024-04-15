import { AccountInfo } from "@airgap/beacon-sdk";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { PollingSubscribeProvider, TezosToolkit } from "@taquito/taquito";
import { Context, Dispatch, createContext } from "react";
import P2PClient from "./P2PClient";
import { Storage } from "./bank_account.types";
import { BeaconSigner } from "./signer";

type tezosState = {
  connection: TezosToolkit;
  beaconWallet: BeaconWallet | null;
  p2pClient: P2PClient | null;
  address: string | null;
  balance: string | null;
  currentContract: string | null;
  currentStorage: Storage | null;
  accountInfo: AccountInfo | null;
  contracts: { [address: string]: [Storage, number] };
  aliases: { [address: string]: string };
  hasBanner: boolean;
  delegatorAddresses: string[] | undefined;
  connectedDapps: {
    [address: string]: {
      [id: string]: p2pData;
    };
  };
  // Increasing this number will trigger a useEffect in the proposal page
  proposalRefresher: number;
  attemptedInitialLogin: boolean;
};

type p2pData = {
  appUrl: string;
  id: string;
  name: string;
  publicKey: string;
  relayServer: string;
  type: string;
  version: string;
};

let AppStateContext: Context<tezosState | null> =
  createContext<tezosState | null>(null);

let emptyState = (): tezosState => {
  const connection = new TezosToolkit("https://ghostnet.tezos.marigold.dev");

  connection.setStreamProvider(
    connection.getFactory(PollingSubscribeProvider)({
      shouldObservableSubscriptionRetry: true,
      pollingIntervalMilliseconds: 500,
    })
  );

  return {
    beaconWallet: null,
    p2pClient: null,
    contracts: {},
    aliases: {},
    balance: null,
    address: null,
    currentContract: null,
    currentStorage: null,
    accountInfo: null,
    connection,
    hasBanner: true,
    delegatorAddresses: undefined,
    connectedDapps: {},
    proposalRefresher: 0,
    attemptedInitialLogin: false,
  };
};

type storage = {
  contracts: { [address: string]: Storage };
  aliases: { [address: string]: string };
};

type action =
  | { type: "beaconConnect"; payload: BeaconWallet }
  | { type: "p2pConnect"; payload: P2PClient }
  | {
      type: "login";
      accountInfo: AccountInfo;
      address: string;
      balance: string;
      contracts: { [address: string]: [Storage, number] };
    }
  | { type: "logout" }
  | { type: "loadStorage"; payload: storage }
  | { type: "writeStorage"; payload: storage }
  | { type: "setDelegatorAddresses"; payload: string[] }
  | {
      type: "updateAliases";
      payload: {
        aliases: { address: string; name: string }[];
        keepOld: boolean;
      };
    }
  | {
      type: "setBanner";
      payload: boolean;
    }
  | {
      type: "addDapp";
      payload: {
        data: p2pData;
        address: string;
      };
    }
  | {
      type: "removeDapp";
      payload: string;
    }

  | {
      type: "refreshContracts";
      payload: {
        contracts: { [address: string]: [Storage, number] };
      };
    }
  | {
      type: "setAttemptedInitialLogin";
      payload: boolean;
    };

const saveState = (state: tezosState) => {
  localStorage.setItem(
    `app_state:${state.address}`,
    JSON.stringify({
      contracts: state.contracts,
      aliases: state.aliases,
      currentContract: state.currentContract,
      connectedDapps: state.connectedDapps,
    })
  );
};

function reducer(state: tezosState, action: action): tezosState {
  switch (action.type) {
    case "beaconConnect": {
      state.connection.setProvider({
        rpc: "https://ghostnet.tezos.marigold.dev/",
        wallet: action.payload,
      });
      state.connection.setSignerProvider(new BeaconSigner(action.payload));
      return { ...state, beaconWallet: action.payload };
    }
    case "p2pConnect": {
      return { ...state, p2pClient: action.payload };
    }
    case "addDapp": {
      if (!state.address) return state;

      state.connectedDapps[action.payload.address] ??= {};

      state.connectedDapps[action.payload.address][action.payload.data.appUrl] =
        action.payload.data;

      state.currentContract = action.payload.address;

      saveState(state);

      return state;
    }
    case "removeDapp": {
      if (
        !state.currentContract ||
        !state.connectedDapps[state.currentContract][action.payload]
      )
        return state;

      const newState = { ...state };

      delete newState.connectedDapps[state.currentContract][action.payload];

      saveState(newState);

      return newState;
    }

    case "login": {
      const rawStorage = window!.localStorage.getItem(
        `app_state:${action.address}`
      )!;
      const storage: storage = JSON.parse(rawStorage);
      return {
        ...state,
        ...storage,
        balance: action.balance,
        accountInfo: action.accountInfo,
        address: action.address,
        contracts: action.contracts,
        attemptedInitialLogin: true,
      };
    }
    case "logout": {
      let { connection } = emptyState();

      const newState: tezosState = {
        ...state,
        beaconWallet: null,
        balance: null,
        accountInfo: null,
        address: null,
        connection: connection,
        p2pClient: null,
      };

      return newState;
    }

    case "setBanner":
      return {
        ...state,
        hasBanner: action.payload,
      };
    case "setDelegatorAddresses":
      return { ...state, delegatorAddresses: action.payload };


    case "refreshContracts":
      return { ...state, contracts: action.payload.contracts };

    case "setAttemptedInitialLogin":
      return { ...state, attemptedInitialLogin: action.payload };
    default: {
      throw `notImplemented: ${action.type}`;
    }
  }
}

let AppDispatchContext: Context<Dispatch<action> | null> =
  createContext<Dispatch<action> | null>(null);

export {
  AppDispatchContext,
  AppStateContext,
  emptyState,
  reducer,
  type Storage,
  type action,
  type tezosState,
};
