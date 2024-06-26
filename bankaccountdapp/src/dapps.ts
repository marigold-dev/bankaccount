import { TezosToolkit } from "@taquito/taquito";
import { ReactNode } from "react";
import { transaction } from "./RenderProposalContentLambda";

export type contracts = {
  mainnet: { [k: string]: true };
  ghostnet: { [k: string]: true };
};

export type CustomViewData = {
  image?: string;
  action: string;
  description: ReactNode;
  price?: string;
  link?: string;
};
export type CustomView =
  | {
      logo: string;
      logoLink: string;
      dappName: string;
      label: string;
      data: Array<CustomViewData> | undefined;
    }
  | { logo: undefined; label: undefined; data: undefined }
  | undefined;

// Import matcher function here to support new dapp
export const customViewMatchers: Array<
  (transactions: Array<transaction>, Tezos: TezosToolkit) => CustomView
> = [];
