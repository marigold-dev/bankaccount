export async function getProposalIdOfCreatedProposal(txHash: string) {
  const [proposal] = await fetch(
    `https://api.ghostnet.tzkt.io/v1/operations/${txHash}`
  ).then((r) => r.json());

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [[_, id, __]] = await fetch(
    `https://api.ghostnet.tzkt.io/v1/contracts/events?select.values=id,payload,tag&transactionId=${proposal.id}&sort.desc=id`
  ).then((r) => r.json());

  return id;
}

export function omit(key: string, obj: Record<string, string>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [key]: omitted, ...rest } = obj;
  return rest;
}
