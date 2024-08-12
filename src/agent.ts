import { Finding, HandleBlock, getEthersProvider, BlockEvent, getAlerts, GetAlerts } from "forta-agent";
import {
  DAI_ADDRESS,
  L1_ESCROW_ARBITRUM,
  L1_ESCROW_FUNCTION_SIGNATURE,
  L1_ESCROW_OPTIMISM,
  BOT_ID,
  PreviousBalances,
} from "./constants";
import { ethers, Contract, BigNumber } from "ethers";
import { getL1Finding, checkBlock } from "./utils";
let chainId: number;
let prevBal: PreviousBalances = {
  previousBlockNumber: 0,
  prevArbitrumBalance: BigNumber.from(0),
  prevOptimismBalance: BigNumber.from(0),
};

export function provideInitialize(provider: ethers.providers.Provider) {
  return async function initialize() {
    const networkInfo = await provider.getNetwork();
    chainId = networkInfo.chainId;
  };
}
export function provideHandleBlock(provider: ethers.providers.Provider, getAlerts: GetAlerts): HandleBlock {
  return async function handleBlock(block: BlockEvent): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      if (chainId == 1) {
        const daiContract = new Contract(DAI_ADDRESS, L1_ESCROW_FUNCTION_SIGNATURE, provider);
        const result = await getL1Finding(
          daiContract,
          block.blockNumber,
          L1_ESCROW_ARBITRUM,
          L1_ESCROW_OPTIMISM,
          prevBal
        );

        findings.push(...result); // Spread the result array
      } else {
        const alerts = await getAlerts({
          botIds: [BOT_ID],
          alertId: "balance-change-layer1",
          chainId: 1,
        });

        const blockFindings = await checkBlock(provider, block.blockNumber, chainId, alerts.alerts);

        if (blockFindings.length > 0) {
          findings.push(...blockFindings);
        }
      }
    } catch (e) {
      return findings;
    }

    return findings;
  };
}
