import { Config, ContractsBlob } from '../types';
import { getContract } from './getContract';
import { getInfuraProvider } from './getInfuraProvider';
const debug = require('debug')('pt-autotask-lib');

interface IL1TimelockState {
  status: number;
  data?: any;
  err?: any;
}

export async function getL1TimelockState(
  contracts: ContractsBlob,
  config: Config
): Promise<IL1TimelockState> {
  try {
    const provider = getInfuraProvider(config.network, config.apiKey);
    const L1TimelockTrigger = getContract(
      'L1TimelockTrigger',
      config.chainId,
      provider,
      contracts
    );
    if (!L1TimelockTrigger)
      throw new Error('L1TimelockTrigger contract not found');
    debug('L1TimelockTrigger: ', L1TimelockTrigger.address);
    const timelock = await L1TimelockTrigger.timelock();
    const prizeDistributionBuffer = await L1TimelockTrigger.prizeDistributionBuffer();
    return {
      status: 1,
      data: {
        timelock,
        prizeDistributionBuffer,
      },
    };
  } catch (error) {
    return {
      status: 0,
      err: error,
    };
  }
}

export default getL1TimelockState;
