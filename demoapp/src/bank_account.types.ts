import { BigMap, address, mutez, nat, timestamp, unit } from "./type-aliases";
import {
  ContractAbstractionFromContractType,
  WalletContractAbstractionFromContractType,
} from "./type-utils";

export type STATUS =
  | { aCTIVE: unit }
  | {
      rECOVERING: {
        0: address;
        1: timestamp;
      };
    }
  | { dEAD: unit };

export type FREQUENCY =
  | { sECOND: nat }
  | { mINUTE: nat }
  | { hOUR: nat }
  | { dAY: nat }
  | { wEEK: nat }
  | { mONTH: nat }
  | { yEAR: nat };

export type Storage = {
  owners: Array<address>;
  inheritors: Array<address>;
  status: STATUS;
  quick_recovery_stake: mutez;
  quick_recovery_period: nat;
  direct_debit_mandates: BigMap<
    {
      0: address;
      1: FREQUENCY;
    },
    mutez
  >;
  direct_debit_mandates_history: BigMap<
    {
      0: address;
      1: FREQUENCY;
    },
    timestamp
  >;
};

type Methods = {
  execute_direct_debit_mandate_XTZ: (_0: mutez, _1: FREQUENCY) => Promise<void>;
  revoke_direct_debit_mandate_XTZ: (
    _0: address,
    _1: FREQUENCY
  ) => Promise<void>;
  add_direct_debit_mandate_XTZ: (
    _0: address,
    _1: FREQUENCY,
    _2: mutez
  ) => Promise<void>;
  stop_recovery: () => Promise<void>;
  claim_recovery: () => Promise<void>;
  start_recover: (param: address) => Promise<void>;
  transfer_XTZ: (_0: address, _1: mutez) => Promise<void>;
  revoke: (param: address) => Promise<void>;
  enroll: (param: address) => Promise<void>;
};

export type ExecuteDirectDebitMandateXTZParams = mutez;
export type RevokeDirectDebitMandateXTZParams = address;
export type AddDirectDebitMandateXTZParams = address;
export type StopRecoveryParams = unit;
export type ClaimRecoveryParams = unit;
export type StartRecoverParams = address;
export type TransferXTZParams = address;
export type RevokeParams = address;
export type EnrollParams = address;

type MethodsObject = {
  execute_direct_debit_mandate_XTZ: (params: {
    0: mutez;
    1: FREQUENCY;
  }) => Promise<void>;
  revoke_direct_debit_mandate_XTZ: (params: {
    0: address;
    1: FREQUENCY;
  }) => Promise<void>;
  add_direct_debit_mandate_XTZ: (params: {
    0: address;
    1: FREQUENCY;
    2: mutez;
  }) => Promise<void>;
  stop_recovery: () => Promise<void>;
  claim_recovery: () => Promise<void>;
  start_recover: (param: address) => Promise<void>;
  transfer_XTZ: (params: { 0: address; 1: mutez }) => Promise<void>;
  revoke: (param: address) => Promise<void>;
  enroll: (param: address) => Promise<void>;
};

type contractTypes = {
  methods: Methods;
  methodsObject: MethodsObject;
  storage: Storage;
  code: { __type: "BankAccountCode"; protocol: string; code: object[] };
};
export type BankAccountContractType =
  ContractAbstractionFromContractType<contractTypes>;
export type BankAccountWalletType =
  WalletContractAbstractionFromContractType<contractTypes>;
