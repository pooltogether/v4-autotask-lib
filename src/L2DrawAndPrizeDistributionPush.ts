// @ts-nocheck
import contracts from '@pooltogether/v4-testnet/testnet.json'
import { Config, ActionState, Relayer } from '../types'
import { getContract } from './utils/getContract';
import { getInfuraProvider } from "./utils/getInfuraProvider";

const debug = require('debug')('pt-autotask')

interface L2DrawAndPrizeDistributionPushConfig {
  chainId: number;
  network: string;
  apiKey: string | undefined;
  speed?: "slow" | "normal" | "fast";
  gasLimit?: number | string;
  L1: {
    chainId: number;
    network: string;
  },
  L2: {
    chainId: number;
    network: string;
  }
}

export async function L2DrawAndPrizeDistributionPush(config: L2DrawAndPrizeDistributionPushConfig, relayer: Relayer): Promise<ActionState> {

}
