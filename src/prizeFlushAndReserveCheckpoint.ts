import { ActionState, Config, ContractsBlob, Relayer } from './types'
import { getContract } from './utils/getContract';
import { getInfuraProvider } from "./utils/getInfuraProvider";
const debug = require('debug')('pt-autotask')

export async function PrizeFlushAndReserveCheckpoint(contracts: ContractsBlob, config: Config, relayer?: Relayer): Promise<ActionState> {
  const provider = getInfuraProvider(config.network, config.apiKey)
  const prizeFlush = getContract('PrizeFlush', config.chainId, provider, contracts)

  let response;
  let status = 0
  let msg = 'PrizeFlush/no-flush-and-checkpoint';

  try {
    // Populate Transation: encode data without submitting to provider.
    const txData = await prizeFlush.populateTransaction.flush()

    // IF executable and Relayer is available.
    if (config.execute && relayer) {
      debug(`Starting PrizeFlush`)
      let txRes = await relayer.sendTransaction({
        data: txData.data,
        to: txData.to,
        speed: "fast",
        gasLimit: 500000,
      });
      status = 1;
      msg = 'PrizeFlush/executed-flush-and-checkpoint';
      response = await provider.getTransaction(txRes.hash);
      debug(`PrizeFlush Complete`)
    }

    return {
      err: false,
      msg,
      status,
      response,
      transaction: {
        to: txData.to,
        data: txData.data,
      }
    }
  } catch (error) {
    debug(error)
    return {
      err: error,
      msg,
      status
    }
  }

}
