import { getJsonRpcProvider } from '.';
import { Config, ContractsBlob } from '../types'
import { getContract } from './getContract';
const debug = require('debug')('pt-autotask')

interface IDrawCalculatorTimelockState {
  status: number;
  data?: any;
  err?: any;
}

export async function getDrawCalculatorTimelockState(contracts: ContractsBlob, config: Config): Promise<IDrawCalculatorTimelockState> {
  try {
    const provider = getJsonRpcProvider(`https://${config.network}.infura.io/v3/${config.apiKey}`)
    const DrawCalculatorTimelock = getContract('DrawCalculatorTimelock', config.chainId, provider, contracts);
    debug('DrawCalculatorTimelock: ', DrawCalculatorTimelock.address)
    const timelock = await DrawCalculatorTimelock.getTimelock()
    const timelockDuration = await DrawCalculatorTimelock.getTimelockDuration()
    const hasElapsed = await DrawCalculatorTimelock.hasElapsed()

    return {
      status: 1,
      data: {
        hasElapsed,
        timelock,
        timelockDuration
      },
    }

  } catch (error) {
    return {
      status: 0,
      err: error,
    }
  }
}

export default getDrawCalculatorTimelockState