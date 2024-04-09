
import { ContractAbstractionFromContractType, WalletContractAbstractionFromContractType } from './type-utils';
import { address, mutez, timestamp, unit } from './type-aliases';

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
};

type Methods = {
    transfer_XTZ: (
        _0: address,
        _1: mutez,
    ) => Promise<void>;
    revoke: (param: address) => Promise<void>;
    enroll: (param: address) => Promise<void>;
};

export type TransferXTZParams = address
export type RevokeParams = address
export type EnrollParams = address

type MethodsObject = {
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
