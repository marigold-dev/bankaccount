// Currently taquito is not compatible with the latest change, so we need to have a client with the necessary fixes
import {
  DAppClient,
  DAppClientOptions,
  PermissionScope,
  RequestPermissionInput,
  SigningType,
  getDAppClientInstance,
} from "@airgap/beacon-dapp";
import { AccountInfo, BeaconEvent } from "@airgap/beacon-sdk";
import { PermissionDeniedError, UnsupportedActionError } from "@taquito/core";
import {
  WalletDelegateParams,
  WalletIncreasePaidStorageParams,
  WalletOriginateParams,
  WalletProvider,
  WalletTransferParams,
  createIncreasePaidStorageOperation,
  createOriginationOperation,
  createSetDelegateOperation,
  createTransferOperation,
} from "@taquito/taquito";
import { buf2hex, hex2buf, mergebuf } from "@taquito/utils";
import toBuffer from "typedarray-to-buffer";

/**
 *  @category Error
 *  @description Error that indicates the Beacon wallet not being initialized
 */
export class BeaconWalletNotInitialized extends PermissionDeniedError {
  constructor() {
    super();
    this.name = "BeaconWalletNotInitialized";
    this.message =
      'BeaconWallet needs to be initialized by calling `await BeaconWallet.requestPermissions({network: {type: "chosen_network"}})` first.';
  }
}

/**
 *  @category Error
 *  @description Error that indicates missing required persmission scopes
 */
export class MissingRequiredScopes extends PermissionDeniedError {
  constructor(public readonly requiredScopes: PermissionScope[]) {
    super();
    this.name = "MissingRequiredScopes";
    this.message = `Required permissions scopes: ${requiredScopes.join(
      ","
    )} were not granted.`;
  }
}

export class BeaconWallet implements WalletProvider {
  public client: DAppClient;

  constructor(options: DAppClientOptions) {
    this.client = getDAppClientInstance(options);
  }

  private validateRequiredScopesOrFail(
    permissionScopes: PermissionScope[],
    requiredScopes: PermissionScope[]
  ) {
    const mandatoryScope = new Set(requiredScopes);

    for (const scope of permissionScopes) {
      if (mandatoryScope.has(scope)) {
        mandatoryScope.delete(scope);
      }
    }

    if (mandatoryScope.size > 0) {
      throw new MissingRequiredScopes(Array.from(mandatoryScope));
    }
  }

  async requestPermissions(request?: RequestPermissionInput) {
    await this.client.requestPermissions(request);
  }

  async getPKH() {
    const account = await this.client.getActiveAccount();
    if (!account) {
      throw new BeaconWalletNotInitialized();
    }

    return account.address;
  }

  async mapTransferParamsToWalletParams(
    params: () => Promise<WalletTransferParams>
  ) {
    let walletParams: WalletTransferParams;
    await this.client.showPrepare();
    try {
      walletParams = await params();
    } catch (err) {
      await this.client.hideUI(["alert", "toast"]);
      throw err;
    }
    return this.removeDefaultParams(
      walletParams,
      await createTransferOperation(this.formatParameters(walletParams))
    );
  }

  async mapIncreasePaidStorageWalletParams(
    params: () => Promise<WalletIncreasePaidStorageParams>
  ) {
    let walletParams: WalletIncreasePaidStorageParams;
    await this.client.showPrepare();
    try {
      walletParams = await params();
    } catch (err) {
      await this.client.hideUI(["alert", "toast"]);
      throw err;
    }
    return this.removeDefaultParams(
      walletParams,
      await createIncreasePaidStorageOperation(
        this.formatParameters(walletParams)
      )
    );
  }

  async mapOriginateParamsToWalletParams(
    params: () => Promise<WalletOriginateParams>
  ) {
    let walletParams: WalletOriginateParams;
    await this.client.showPrepare();
    try {
      walletParams = await params();
    } catch (err) {
      await this.client.hideUI(["alert", "toast"]);
      throw err;
    }
    return this.removeDefaultParams(
      walletParams,
      await createOriginationOperation(this.formatParameters(walletParams))
    );
  }

  async mapDelegateParamsToWalletParams(
    params: () => Promise<WalletDelegateParams>
  ) {
    let walletParams: WalletDelegateParams;
    await this.client.showPrepare();
    try {
      walletParams = await params();
    } catch (err) {
      await this.client.hideUI(["alert", "toast"]);
      throw err;
    }
    return this.removeDefaultParams(
      walletParams,
      await createSetDelegateOperation(this.formatParameters(walletParams))
    );
  }

  formatParameters(params: any) {
    if (params.fee) {
      params.fee = params.fee.toString();
    }
    if (params.storageLimit) {
      params.storageLimit = params.storageLimit.toString();
    }
    if (params.gasLimit) {
      params.gasLimit = params.gasLimit.toString();
    }
    return params;
  }

  removeDefaultParams(
    params: WalletTransferParams | WalletOriginateParams | WalletDelegateParams,
    operatedParams: any
  ) {
    // If fee, storageLimit or gasLimit is undefined by user
    // in case of beacon wallet, dont override it by
    // defaults.
    if (!params.fee) {
      delete operatedParams.fee;
    }
    if (!params.storageLimit) {
      delete operatedParams.storage_limit;
    }
    if (!params.gasLimit) {
      delete operatedParams.gas_limit;
    }
    return operatedParams;
  }

  async sendOperations(params: any[]) {
    console.log("sendOperations", params);

    const account = await this.client.getActiveAccount();
    if (!account) {
      throw new BeaconWalletNotInitialized();
    }
    const permissions = account.scopes;
    this.validateRequiredScopesOrFail(permissions, [
      PermissionScope.OPERATION_REQUEST,
    ]);

    console.log("this.client.requestOperation", params);

    const { transactionHash } = await this.client.requestOperation({
      operationDetails: params,
    });
    return transactionHash;
  }

  /**
   *
   * @description Removes all beacon values from the storage. After using this method, this instance is no longer usable.
   * You will have to instantiate a new BeaconWallet.
   */
  async disconnect() {
    await this.client.destroy();
  }

  /**
   *
   * @description This method removes the active account from local storage by setting it to undefined.
   */
  async clearActiveAccount() {
    await this.client.setActiveAccount();
  }

  async sign(bytes: string, watermark?: Uint8Array) {
    let bb = hex2buf(bytes);
    if (typeof watermark !== "undefined") {
      bb = mergebuf(watermark, bb);
    }
    const watermarkedBytes = buf2hex(toBuffer(bb));
    const signingType = this.getSigningType(watermark);
    if (signingType !== SigningType.OPERATION) {
      throw new UnsupportedActionError(
        `Taquito Beacon Wallet currently only supports signing operations, not ${signingType}`
      );
    }
    const { signature } = await this.client.requestSignPayload({
      payload: watermarkedBytes,
      signingType,
    });
    return signature;
  }

  private getSigningType(watermark?: Uint8Array) {
    if (!watermark || watermark.length === 0) {
      return SigningType.RAW;
    }
    if (watermark.length === 1) {
      if (watermark[0] === 5) {
        return SigningType.MICHELINE;
      }
      if (watermark[0] === 3) {
        return SigningType.OPERATION;
      }
    }
    throw new Error(`Invalid watermark ${JSON.stringify(watermark)}`);
  }

  async getPK() {
    const account = await this.client.getActiveAccount();
    if (!account) {
      throw new BeaconWalletNotInitialized();
    }
    return account.publicKey ?? "";
  }

  async requestSimulatedProofOfEvent() {
    const { operationsList, errorMessage } =
      await this.client.requestSimulatedProofOfEventChallenge({
        payload: "test",
      });

    if (errorMessage === "") return operationsList;

    throw new Error(errorMessage);
  }

  async requestProofOfEvent(payload: string) {
    const result = await this.client.requestProofOfEventChallenge({
      payload,
    });
    return result;
  }

  subscribeToActiveAccount(listener: (acc: AccountInfo) => void) {
    this.client.subscribeToEvent(BeaconEvent.ACTIVE_ACCOUNT_SET, listener);
  }
}
