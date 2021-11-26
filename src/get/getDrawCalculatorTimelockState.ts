import { getJsonRpcProvider } from '.';
import { Config, ContractsBlob } from '../types'
import { getContract } from './getContract';
const debug = require('debug')('pt-autotask-lib')

interface IDrawCalculatorTimelockState {
  status: number;
  data?: any;
  err?: any;
}

export async function getDrawCalculatorTimelockState(contracts: ContractsBlob, config: Config): Promise<IDrawCalculatorTimelockState> {
  try {
    const provider = getJsonRpcProvider(`https://${config.network}.infura.io/v3/${config.apiKey}`)
    const DrawCalculatorTimelock = getContract('DrawCalculatorTimelock', config.chainId, provider, contracts);
    if (!DrawCalculatorTimelock) throw new Error('DrawCalculatorTimelock not found')
    debug('DrawCalculatorTimelock: ', DrawCalculatorTimelock.address)
    const timelock = await DrawCalculatorTimelock.getTimelock()
    const hasElapsed = await DrawCalculatorTimelock.hasElapsed()

    return {
      status: 1,
      data: {
        hasElapsed,
        timelock
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