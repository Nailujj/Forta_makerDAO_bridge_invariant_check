import { ethers, Contract, BigNumber } from "ethers";
import { Finding, FindingSeverity, FindingType, Alert } from "forta-agent";
import { L2_FUNCTION_SIGNATURE, L2_TOKEN_ADDRESS_MAKER_DAO, PreviousBalances } from "./constants";

export const getL1Finding = async (
  daiContract: Contract,
  blockNumber: number,
  escrowAddressArbitrum: string,
  escrowAddressOptimism: string,
  previousBalances: PreviousBalances
): Promise<Finding[]> => {
  // Return type changed to Promise<Finding[]>
  const [arbitrumBalance, optimismBalance] = await Promise.all([
    daiContract.balanceOf(escrowAddressArbitrum, { blockTag: blockNumber }),
    daiContract.balanceOf(escrowAddressOptimism, { blockTag: blockNumber }),
  ]);

  if (
    !BigNumber.from(previousBalances.prevArbitrumBalance).eq(BigNumber.from(arbitrumBalance)) ||
    !BigNumber.from(previousBalances.prevOptimismBalance).eq(BigNumber.from(optimismBalance))
  ) {
    previousBalances.prevArbitrumBalance = arbitrumBalance;
    previousBalances.prevOptimismBalance = optimismBalance;
    previousBalances.previousBlockNumber = blockNumber;

    return [
      Finding.fromObject({
        name: `Combined DAI balance of Optimism and Arbitrum MakerDao escrows on layer 1`,
        description: `escrow-balance-arbitrum: ${arbitrumBalance}, escrow-balance-optimism: ${optimismBalance}`,
        alertId: "balance-change-layer1",
        severity: FindingSeverity.Info,
        type: FindingType.Info,
        protocol: "Ethereum",
        metadata: {
          escrowBalanceOptimism: `${optimismBalance}`,
          escrowBalanceArbitrum: `${arbitrumBalance}`,
        },
      }),
    ];
  }
  return [];
};

export const checkBlock = async (
  provider: ethers.providers.Provider,
  blockNumber: number,
  chainId: number,
  alert: Alert[]
): Promise<Array<Finding>> => {
  const l2Contract = new Contract(L2_TOKEN_ADDRESS_MAKER_DAO, L2_FUNCTION_SIGNATURE, provider);
  const l2Balance = await l2Contract.totalSupply({ blockTag: blockNumber });

  if (alert.length == 0) {
    return [];
  }

  const l2Network = chainId === 42161 ? "Arbitrum" : "Optimism";
  const l1Balance =
    chainId === 42161 ? alert[0].metadata.escrowBalanceArbitrum : alert[0].metadata.escrowBalanceOptimism;

  if (l2Balance.gt(l1Balance)) {
    return [
      Finding.fromObject({
        name: `${l2Network} layer 2 DAI supply is more than the layer 1 escrow DAI balance`,
        description: `l1-escrow-balance: ${l1Balance}, ${l2Network.toLowerCase()}-l2-supply-balance: ${l2Balance}`,
        alertId: `supply-imbalance-layer2`,
        severity: FindingSeverity.High,
        type: FindingType.Degraded,
        protocol: `${l2Network}`,
        metadata: {
          L1Bal: `${l1Balance}`,
          L2Bal: `${l2Balance}`,
        },
      }),
    ];
  }

  return [];
};
