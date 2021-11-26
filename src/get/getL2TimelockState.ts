import { getJsonRpcProvider } from '.';
import { Config, ContractsBlob } from '../types'
import { getContract } from './getContract';
const debug = require('debug')('pt-autotask-lib')

interface IL2TimelockState {
  status: number;
  data?: any;
  err?: any;
}

export async function getL2TimelockState(contracts: ContractsBlob, config: Config): Promise<IL2TimelockState> {
  try {
    const provider = getJsonRpcProvider(`https://${config.network}.infura.io/v3/${config.apiKey}`)
    const L2TimelockTrigger = getContract('L2TimelockTrigger', config.chainId, provider, contracts);
    if (!L2TimelockTrigger) throw new Error('L2TimelockTrigger not found')
    debug('L2TimelockTrigger: ', L2TimelockTrigger.address)
    const timelock = await L2TimelockTrigger.timelock()
    const drawBuffer = await L2TimelockTrigger.drawBuffer()
    const prizeDistributionBuffer = await L2TimelockTrigger.prizeDistributionBuffer()

    return {
      status: 1,
      data: {
        timelock,
        drawBuffer,
        prizeDistributionBuffer
      },
    }

  } catch (error) {
    return {
      status: 0,
      err: error,
    }
  }
}

export default getL2TimelockState