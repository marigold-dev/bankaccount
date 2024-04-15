import { PreapplyParams } from "@taquito/rpc";
import { TezosToolkit, WalletContract } from "@taquito/taquito";

import { Versioned } from "./interface";

class Version0_3_3 extends Versioned {
  async generateSpoeOps(
    _payload: string,
    _cc: WalletContract,
    _t: TezosToolkit
  ): Promise<PreapplyParams> {
    throw new Error("Not supported");
  }
}

export default Version0_3_3;
