import BigNumber from "bignumber.js";

type lambda = { executeLambda: { metadata?: string; content?: string } };
type execute = { execute: string };
type transfer = { transfer: { amount: number; destination: string } };
type removeOwners = { removeOwners: string[] };
type addOwners = { addOwners: string[] };
type changeThreshold = { changeThreshold: number };
type adjustExpirationPeriod = { adjustEffectivePeriod: number };
type add_or_update_metadata = {
  add_or_update_metadata: { key: string; value: string };
};
type proof_of_event = { proof_of_event: string };
type proposalContent =
  | changeThreshold
  | adjustExpirationPeriod
  | addOwners
  | removeOwners
  | transfer
  | execute
  | lambda
  | add_or_update_metadata
  | proof_of_event;

type mutezTransfer = {
  timestamp: string;
  amount: number; //mutez
  target: {
    address: string;
  };
  parameter: object;
  initiator: {
    address: string;
  };
  sender: {
    address: string;
  };
};
export type tokenTransfer = {
  id: number;
  level: number;
  timestamp: string;
  token: {
    id: number;
    contract: {
      address: string;
    };
    tokenId: string;
    standard: string;
    totalSupply: string;
    metadata: {
      name: string;
      symbol: string;
      decimals: string;
    };
  };
  from: {
    address: string;
  };
  to: {
    address: string;
  };
  amount: number;
  transactionId: number;
};

type status = "Proposing" | "Executed" | "Rejected" | "Expired";
type proposal = {
  author: string;
  status: status;
  timestamp: string;
  resolvedBy?: string;
  signatures: { signer: string; result: boolean }[];
  content: proposalContent[];
};
type version = "0.3.4" | "unknown version";

export enum TransferType {
  MUTEZ = -1,
  FA2 = -2,
  FA1_2 = -3,
  UNKNOWN = -9999,
}

export type fa2Tokens = {
  fa2_address: string | undefined;
  name: string | undefined;
  token_id: number;
  to: string | undefined;
  imageUri: string | undefined;
  amount: BigNumber;
  hasDecimal: boolean;
}[];

export type fa1_2Token = {
  fa1_2_address: string;
  name: string | undefined;
  imageUri: string | undefined;
  hasDecimal: boolean;
};

export {
  type addOwners,
  type changeThreshold,
  type lambda,
  type mutezTransfer,
  type proposal,
  type proposalContent,
  type removeOwners,
  type status,
  type transfer,
  type version,
};
