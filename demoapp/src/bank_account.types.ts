
import { ContractAbstractionFromContractType, WalletContractAbstractionFromContractType } from './type-utils';
import { address, mutez, nat, timestamp, unit } from './type-aliases';

export type Storage = {
    owners: Array<address>;
    inheritors: Array<address>;
    status: (
        { aCTIVE: unit }
        | {
            rECOVERING: {
                0: address;
                1: timestamp;
            }
        }
        | { dEAD: unit }
    );
    quick_recovery_stake: mutez;
    quick_recovery_period: nat;
};

type Methods = {
    stop_recovery: () => Promise<void>;
    claim_recovery: () => Promise<void>;
    start_recover: (param: address) => Promise<void>;
    transfer_XTZ: (
        _0: address,
        _1: mutez,
    ) => Promise<void>;
    revoke: (param: address) => Promise<void>;
    enroll: (param: address) => Promise<void>;
};

export type StopRecoveryParams = unit
export type ClaimRecoveryParams = unit
export type StartRecoverParams = address
export type TransferXTZParams = address
export type RevokeParams = address
export type EnrollParams = address

type MethodsObject = {
    stop_recovery: () => Promise<void>;
    claim_recovery: () => Promise<void>;
    start_recover: (param: address) => Promise<void>;
    transfer_XTZ: (params: {
        0: address,
        1: mutez,
    }) => Promise<void>;
    revoke: (param: address) => Promise<void>;
    enroll: (param: address) => Promise<void>;
};

type contractTypes = { methods: Methods, methodsObject: MethodsObject, storage: Storage, code: { __type: 'BankAccountCode', protocol: string, code: object[] } };
export type BankAccountContractType = ContractAbstractionFromContractType<contractTypes>;
export type BankAccountWalletType = WalletContractAbstractionFromContractType<contractTypes>;
