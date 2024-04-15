import BigNumber from "bignumber.js";
import { useState } from "react";
import { hexToAscii } from "./bytes";
import { fa1_2Token, fa2Tokens, proposalContent, version } from "./display";

export type data =
  | {
      type: "AddSigner" | "RemoveSigner";
      label: undefined | string;
      metadata: undefined | string;
      amount: undefined | string;
      addresses: undefined | string[];
      entrypoints: undefined | string;
      params: undefined | string;
      rawParams: undefined | string;
    }
  | {
      type: "TransferFA2";
      label: undefined | string;
      metadata: undefined | string;
      amount: undefined | BigNumber;
      addresses: undefined | string;
      entrypoints: undefined | string;
      params: undefined | fa2Tokens;
      rawParams: undefined | string;
    }
  | {
      type: "TransferFA1_2" | "ApproveFA1_2";
      label: undefined | string;
      metadata: undefined | string;
      amount: undefined | BigNumber;
      addresses: undefined | string;
      entrypoints: undefined | string;
      params: undefined | fa1_2Token;
      rawParams: undefined | string;
    }
  | {
      type:
        | "UpdateThreshold" // legacy code
        | "UpdateProposalDuration"
        | "Transfer"
        | "Execute"
        | "ExecuteLambda"
        | "ExecuteContract"
        | "Delegate"
        | "UnDelegate"
        | "AddOrUpdateMetadata"
        | "Poe";
      label: undefined | string;
      metadata: undefined | string;
      amount: undefined | string;
      addresses: undefined | string;
      entrypoints: undefined | string;
      params: undefined | string;
      rawParams: undefined | string;
    };

export type transaction = Extract<
  data,
  {
    addresses: undefined | string;
    params: undefined | string;
    entrypoints: undefined | string;
  }
>;

export const contentToData = (
  version: version,
  content: proposalContent
): data => {
  let data: data = {
    type: "ExecuteLambda",
    label: undefined,
    metadata: undefined,
    amount: undefined,
    addresses: undefined,
    entrypoints: undefined,
    params: undefined,
    rawParams: undefined,
  };
  // "changeThreshold is a legacy."
  if ("transfer" in content) {
    data = {
      ...data,
      type: "Transfer",
      label: "Transfer",
      addresses: content.transfer.destination,
      amount: `${content.transfer.amount} muTez`,
    };
  } else if ("proof_of_event" in content) {
    data = {
      type: "Poe",
      label: "Message Sigining (TZIP27)",
      metadata: undefined,
      amount: undefined,
      addresses: undefined,
      entrypoints: undefined,
      params: hexToAscii(content.proof_of_event),
      rawParams: undefined,
    };
  } else if ("execute" in content) {
    data = {
      ...data,
      type: "Execute",
      label: "Execute",
      metadata: content.execute,
    };
  }
  return data;
};

const RenderProposalContentLambda = ({
  data,
  isOpenToken: isOpenToken = false,
}: {
  data: data;
  isOpenToken?: boolean;
}) => {
  const [hasParam, setHasParam] = useState(
    () =>
      isOpenToken &&
      (data.type == "TransferFA1_2" ||
        data.type == "ApproveFA1_2" ||
        data.type == "TransferFA2")
  );
  return (
    <div className="after:content[''] relative w-full text-xs after:absolute after:-bottom-2 after:left-0 after:right-0 after:h-px after:bg-zinc-500 md:text-base lg:after:hidden">
      <button
        className={`${
          !data.params ? "cursor-default" : ""
        } grid w-full grid-cols-2 gap-4 text-left lg:grid-cols-6`}
        onClick={() => {
          if (!data.params) return;

          setHasParam((v) => !v);
        }}
        type="button"
        title={!!data.params ? "Show parameters" : undefined}
      >
        <span
          className={`${!data.label ? "text-zinc-500" : ""} justify-self-start`}
        >
          <p className="font-medium text-zinc-500 lg:hidden">Function</p>
          {data.label ?? "-"}
        </span>
        <span
          className={`${
            !data.metadata ? "text-zinc-500" : ""
          } w-auto justify-self-end text-right lg:w-auto lg:w-full lg:justify-self-start lg:text-left`}
        >
          {data.metadata ?? "-"}
        </span>
        <span
          className={`${
            !data.amount ? "text-zinc-500" : ""
          } justify-self-start text-left lg:justify-self-center lg:text-right`}
        >
          <p className="font-medium text-zinc-500 lg:hidden">Amount</p>
          {!data.amount
            ? "-"
            : data.params &&
              typeof data.params !== "string" &&
              "fa1_2_address" in data.params &&
              !data.params.hasDecimal
            ? `${data.amount}*`
            : `${data.amount}`}
        </span>
        {!data.addresses ? (
          <span className="lg:text-auto justify-self-end text-right text-zinc-500 lg:justify-self-center">
            <p className="font-medium text-zinc-500 lg:hidden">Address</p>-
          </span>
        ) : data.addresses.length === 1 ? (
          <span className="lg:text-auto justify-self-end text-right lg:justify-self-center">
            <p className="font-medium text-zinc-500 lg:hidden">Address</p>
            {data.addresses[0]}
          </span>
        ) : (
          <ul className="lg:text-auto justify-self-end text-right lg:justify-self-center">
            <li className="font-medium text-zinc-500 lg:hidden">Addresses</li>
            {Array.isArray(data.addresses) ? (
              data.addresses.map((address, i) => <li key={i}>{address}</li>)
            ) : (
              <li>{data.addresses}</li>
            )}
          </ul>
        )}
        <span
          className={`${
            !data.entrypoints ? "text-zinc-500" : ""
          } justify-self-left w-full text-left lg:w-auto lg:justify-self-end lg:text-center`}
          title={data.entrypoints}
        >
          <p className="font-medium text-zinc-500 lg:hidden">Entrypoint</p>
          {!!data.entrypoints ? data.entrypoints : "-"}
        </span>
        <span
          className={`${
            !data.params ? "text-zinc-500" : ""
          } justify-self-end text-right`}
        >
          <p className="font-medium text-zinc-500 lg:hidden">Params/Tokens</p>
          <div>
            {!!data.params
              ? data.type == "TransferFA2" ||
                data.type == "ApproveFA1_2" ||
                data.type == "TransferFA1_2"
                ? hasParam
                  ? "click[+]"
                  : "click[-]"
                : `${
                    typeof data.params === "string"
                      ? data.params.length < 7
                        ? data.params
                        : data.params.substring(0, 7) + "..."
                      : "-"
                  }`
              : "-"}
          </div>
        </span>
      </button>
      <div
        className={`${
          hasParam ? "block" : "hidden"
        } mt-2 overflow-auto whitespace-pre-wrap rounded bg-zinc-900 px-4 py-4 font-light`}
      >
        {!!data.params ? JSON.stringify(data.params) : ""}
      </div>
    </div>
  );
};

export const labelOfProposalContentLambda = (
  version: version,
  content: proposalContent
) => {
  if ("changeThreshold" in content) {
    return "Update threshold";
  } else if ("adjustEffectivePeriod" in content) {
    return "Update proposal duration";
  } else if ("addOwners" in content) {
    return `Add signer${content.addOwners.length > 1 ? "s" : ""}`;
  } else if ("removeOwners" in content) {
    return `Remove signer${content.removeOwners.length > 1 ? "s" : ""}`;
  } else if ("transfer" in content) {
    return `Transfer ${content.transfer.amount} muTez`;
  } else if ("add_or_update_metadata" in content) {
    return "Update metadata (TZIP16)";
  } else if ("proof_of_event" in content) {
    return "Message signing (TZIP27)";
  } else if ("execute" in content) {
    return "Execute";
  } else if ("executeLambda" in content) {
    return "Execute lambda";
  }
};

export default RenderProposalContentLambda;
