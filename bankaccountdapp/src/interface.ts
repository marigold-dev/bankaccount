import { Parser, unpackDataBytes } from "@taquito/michel-codec";
import { Schema } from "@taquito/michelson-encoder";
import { PreapplyParams } from "@taquito/rpc";
import { TezosToolkit, WalletContract } from "@taquito/taquito";
import { ValidationResult, validateAddress } from "@taquito/utils";
import { contractStorage } from "./Proposal0_3_4";
import { version } from "./display";
import { hasTzip27Support, hasTzip27SupportWithPoEChallenge } from "./util";

const TZKT_API_URL = "https://api.ghostnet.tzkt.io";

type proofOfEvent = {
  payload: {
    payload: string;
    challenge_id: string;
  };
};

export type timeoutAndHash = [boolean, string];

export type p2pData = {
  appUrl: string;
  id: string;
  name: string;
  publicKey: string;
  relayServer: string;
  type: string;
  version: string;
};

type common = {
  fields: {
    field: string;
    label: string;
    path: string;
    placeholder: string;
    kind?: "textarea" | "input-complete" | "autocomplete";
    validate: (p: string) => string | undefined;
  }[];
};

export type transfer =
  | {
      type: "transfer";
      values: {
        to: string;
        amount: string;
        parameters?: { [k: string]: any };
      };
    }
  | {
      type: "lambda";
      values: {
        lambda: string;
        metadata: any;
      };
    }
  | ({
      type: "poe";
      values: {
        payload: string;
      };
    } & common)
  | ({
      type: "update_metadata";
      values: {
        tzip16_metadata: string;
      };
    } & common)
  | {
      type: "contract";
      values: {
        lambda: string;
        metadata: any;
      };
    }
  | ({
      type: "fa2";
      values: { [key: string]: string }[];
    } & common);

abstract class Versioned {
  readonly version: version;
  readonly contractAddress: string;

  public static FETCH_COUNT = 10;

  constructor(version: version, contractAddress: string) {
    this.version = version;
    this.contractAddress = contractAddress;
  }

  abstract generateSpoeOps(
    payload: string,
    cc: WalletContract,
    t: TezosToolkit
  ): Promise<PreapplyParams>;

  private static decodePoE(schema: Schema) {
    return (events: Array<proofOfEvent>) =>
      events.flatMap((event) => {
        try {
          const value = schema.Execute(
            unpackDataBytes({
              bytes: event.payload.payload,
            })
          );

          return [
            {
              key: event.payload.challenge_id,
              value,
            },
          ];
        } catch (e) {
          return [];
        }
      });
  }

  static signers(c: contractStorage): string[] {
    if (typeof c == "undefined") {
      return [];
    }

    return c.owners;
  }

  static lambdaForm(c: contractStorage): {
    values: { [key: string]: string };
    fields: {
      field: string;
      label: string;
      path: string;
      kind?: "textarea";
      placeholder: string;
      validate: (p: string) => string | undefined;
    }[];
  } {
    return {
      values: {
        metadata: "",
        lambda: "",
      },
      fields: [
        {
          field: "metadata",
          label: "Note to save",
          path: ".metadata",
          placeholder: "Write your note here",
          validate: (x?: string) => {
            return undefined;
          },
        },
        {
          field: "lambda",
          label: "Lambda to execute",
          kind: "textarea",
          path: ".lambda",
          placeholder: "Write your lambda here",
          validate: (x?: string) => {
            if (!x) {
              return;
            }
            const p = new Parser();
            try {
              p.parseScript(x);
            } catch {
              return "Unable to parse the lambda";
            }
          },
        },
      ],
    };
  }

  static transferForm(c: contractStorage): {
    values: { [key: string]: string };
    fields: {
      field: string;
      label: string;
      path: string;
      kind?: "input-complete";
      placeholder: string;
      validate: (p: string) => string | undefined;
    }[];
  } {
    return {
      values: {
        amount: "",
        to: "",
      },
      fields: [
        {
          field: "amount",
          label: "Amount (Tez)",
          path: ".amount",
          placeholder: "1",
          validate: (x: string) => {
            const amount = Number(x);
            if (isNaN(amount) || amount <= 0) {
              return `Invalid amount ${x}`;
            }
          },
        },
        {
          field: "to",
          label: "Transfer to",
          path: ".to",
          kind: "input-complete",
          placeholder: "Destination address",
          validate: (x: string) =>
            validateAddress(x) !== ValidationResult.VALID
              ? `Invalid address ${x}`
              : undefined,
        },
      ],
    };
  }

  static fa2(c: contractStorage): {
    values: { [key: string]: string }[];
    fields: {
      field: string;
      label: string;
      path: string;
      kind?: "input-complete" | "autocomplete";
      placeholder: string;
      validate: (p: string) => string | undefined;
    }[];
  } {
    return {
      values: [
        {
          token: "",
          amount: "",
          targetAddress: "",
        },
      ],
      fields: [
        {
          field: "token",
          label: "Token",
          path: ".token",
          placeholder: "Token",
          validate: (x: string) => {
            return !x ? "Please select a token" : undefined;
          },
        },
        {
          field: "amount",
          label: "Amount",
          path: ".amount",
          placeholder: "1",
          validate: (x: string) => {
            const amount = Number(x);
            if (isNaN(amount) || amount <= 0 || !Number.isInteger(amount)) {
              return `Invalid amount ${x}`;
            }
          },
        },
        {
          field: "targetAddress",
          label: "Transfer to",
          path: ".targetAddress",
          kind: "input-complete",
          placeholder: "Destination address",
          validate: (x: string) =>
            validateAddress(x) !== ValidationResult.VALID
              ? `Invalid address ${x}`
              : undefined,
        },
      ],
    };
  }

  static fa1_2_approve(c: contractStorage): {
    values: { [key: string]: string };
    fields: {
      field: string;
      label: string;
      path: string;
      kind?: "input-complete" | "autocomplete";
      placeholder: string;
      validate: (p: string) => string | undefined;
    }[];
  } {
    return {
      values: {
        token: "",
        amount: "",
        targetAddress: "",
      },
      fields: [
        {
          field: "token",
          label: "Token",
          path: ".token",
          placeholder: "Token",
          validate: (x: string) => {
            return !x ? "Please select a token" : undefined;
          },
        },
        {
          field: "amount",
          label: "Amount",
          path: ".amount",
          placeholder: "1",
          validate: (x: string) => {
            const amount = Number(x);
            if (isNaN(amount) || amount < 0) {
              return `Invalid amount ${x}`;
            }
          },
        },
        {
          field: "spenderAddress",
          label: "Transfer to",
          path: ".spenderAddress",
          kind: "input-complete",
          placeholder: "Spender address",
          validate: (x: string) =>
            validateAddress(x) !== ValidationResult.VALID
              ? `Invalid address ${x}`
              : undefined,
        },
      ],
    };
  }

  static fa1_2_transfer(c: contractStorage): {
    values: { [key: string]: string };
    fields: {
      field: string;
      label: string;
      path: string;
      kind?: "input-complete" | "autocomplete";
      placeholder: string;
      validate: (p: string) => string | undefined;
    }[];
  } {
    return {
      values: {
        token: "",
        amount: "",
        targetAddress: "",
      },
      fields: [
        {
          field: "token",
          label: "Token",
          path: ".token",
          placeholder: "Token",
          validate: (x: string) => {
            return !x ? "Please select a token" : undefined;
          },
        },
        {
          field: "amount",
          label: "Amount",
          path: ".amount",
          placeholder: "1",
          validate: (x: string) => {
            const amount = Number(x);
            if (isNaN(amount) || amount <= 0) {
              return `Invalid amount ${x}`;
            }
          },
        },
        {
          field: "targetAddress",
          label: "Transfer to",
          path: ".targetAddress",
          kind: "input-complete",
          placeholder: "Destination address",
          validate: (x: string) =>
            validateAddress(x) !== ValidationResult.VALID
              ? `Invalid address ${x}`
              : undefined,
        },
      ],
    };
  }

  static poe(version: version): {
    values: { [key: string]: string };
    fields: {
      field: string;
      label: string;
      path: string;
      placeholder: string;
      validate: (p: string) => string | undefined;
    }[];
  } {
    if (!hasTzip27SupportWithPoEChallenge(version)) {
      return { fields: [], values: {} };
    }

    return {
      values: {
        payload: "",
      },
      fields: [
        {
          field: "payload",
          label: "Payload",
          path: ".payload",
          placeholder: "Payload",
          validate: (v: string) =>
            v.trim() === "" ? "Payload is empty" : undefined,
        },
      ],
    };
  }

  static update_metadata(version: version): {
    values: { [key: string]: string };
    fields: {
      field: string;
      label: string;
      path: string;
      placeholder: string;
      validate: (p: string) => string | undefined;
    }[];
  } {
    if (!hasTzip27Support(version)) {
      return { fields: [], values: {} };
    }

    return {
      values: {
        tzip16_metadata: "",
      },
      fields: [
        {
          field: "tzip16_metadata",
          label: "Metadata (TZIP16)",
          path: ".tzip16_metadata",
          placeholder: "Metadata",
          validate: (v: string) =>
            v.trim() === "" ? "Metadata is empty" : undefined,
        },
      ],
    };
  }
}

export { Versioned };
