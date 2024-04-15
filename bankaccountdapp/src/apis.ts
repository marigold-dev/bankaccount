import {
  BytesLiteral,
  Expr,
  IntLiteral,
  Parser,
  Prim,
} from "@taquito/michel-codec";
import { ParameterSchema } from "@taquito/michelson-encoder";
import { MichelsonMap } from "@taquito/taquito";
import { encodePubKey } from "@taquito/utils";
import { BigNumber } from "bignumber.js";
import { contractStorage } from "./Proposal0_3_4";
import { version } from "./display";
import { Versioned } from "./interface";
import Version0_3_4 from "./version0_3_4";

function signers(c: contractStorage): string[] {
  return Versioned.signers(c);
}
const dispatch: {
  [key in version]: (version: version, address: string) => Versioned;
} = {
  "0.3.4": (version, address) => new Version0_3_4(version, address),
  "unknown version": () => {
    throw new Error("not implemented!");
  },
};

const dispatchUi: {
  [key in version]: () => typeof Versioned;
} = {
  "0.3.4": () => Version0_3_4,
  "unknown version": () => {
    throw Error("not implemented!");
  },
};
function VersionedApi(version: version, contractAddress: string): Versioned {
  return dispatch[version](version, contractAddress);
}

function map2Object(x: any): any {
  if (Array.isArray(x)) {
    return x.map((x) => map2Object(x));
  }
  if (
    typeof x === "object" &&
    Object.keys(x).length === 1 &&
    typeof x[Object.keys(x)[0]] === "symbol"
  ) {
    return { [Object.keys(x)[0]]: {} };
  }
  if (x instanceof MichelsonMap) {
    return Object.fromEntries([...x.entries()]);
  }
  if (x instanceof BigNumber) {
    return x.toString();
  }
  if (typeof x == "object" && !isNaN(Number(Object.keys(x)[0]))) {
    return Object.entries(x).map(([_, v]) => map2Object(v));
  }
  if (typeof x == "object") {
    return Object.fromEntries(
      Object.entries(x).map(([k, v]) => [map2Object(k), map2Object(v)])
    );
  }

  return x;
}

let lambdaTable: {
  [key: string]: <acc, t extends Expr>(acc: acc, item: t) => acc;
} = {
  "0.DROP": (acc) => acc,
  "1.PUSH": (acc, item) => {
    let expr = cast<Prim>(item).args![1];
    let addr = cast<BytesLiteral>(expr).bytes;
    return {
      ...acc,
      contract_address: encodePubKey(addr),
    };
  },
  "2.CONTRACT": (acc, item) => {
    let expr = cast<Prim>(item).args![0];
    let rest = cast<Prim>(item).annots
      ? { ...acc, entrypoint: (cast<Prim>(item).annots as any)[0] }
      : acc;
    return {
      ...rest,
      typ: new ParameterSchema(expr),
    };
  },
  "3.IF_NONE": (acc) => acc,
  "4.PUSH": (acc, item) => {
    let expr = cast<Prim>(item).args![1];
    let amount = cast<IntLiteral>(expr).int;
    return {
      ...acc,
      mutez_amount: amount,
    };
  },
  "5.PUSH": (acc, item) => {
    let expr = cast<Prim>(item).args![1];
    let payload = cast<Prim>(expr);
    let { typ, ...rest } = cast<{ typ: ParameterSchema } & any>(acc);
    let data = typ.Execute(payload);
    return {
      ...rest,
      payload: map2Object(data),
    };
  },
  "6.TRANSFER_TOKENS": (acc, item) => {
    if ("args" in item) {
      throw new Error("invalid");
    }
    return acc;
  },
};
function cast<A>(x: any): A {
  return x as A;
}
function matchLambda<acc extends { [key: string]: acc[typeof key] }>(
  acc: acc,
  items: []
): { [key: string]: any } | null {
  try {
    let p = new Parser();
    let lam = cast<Array<Expr>>(p.parseJSON(items));

    let result = lam.reduce(
      (acc, item, idx) =>
        lambdaTable[`${idx}.${cast<Prim>(item).prim}`](acc, item),
      acc
    );
    return result;
  } catch {
    return null;
  }
}

export { VersionedApi, map2Object, matchLambda, signers };
