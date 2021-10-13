// @ts-ignore
import { ethers, Transaction } from 'ethers';
import contracts from '@pooltogether/v4-testnet/testnet.json'
import ERC20 from '@pooltogether/v4-testnet/artifacts/@pooltogether/v4-core/contracts/interfaces/IControlledToken.sol/IControlledToken.json'
import { ActionState, Relayer, Config } from './types'
import getContract from './utils/getContract';
import getInfuraProvider from "./utils/getInfuraProvider";
const debug = require('debug')('pt-autotask')

const APR_PER_MINUTE = 133
const APR_PER_CALL_FIXED_POINT_9 = 5 * APR_PER_MINUTE // APR for 5 minute frequency

export async function GenerateYieldForPrizePool(config: Config, relayer: Relayer): Promise<ActionState> {
  const provider = getInfuraProvider(config.network, config.apiKey)
  const mockYieldSource = getContract('MockYieldSource', config.chainId, provider, contracts)
  const depositToken = new ethers.Contract(await mockYieldSource.getToken(), ERC20.abi, provider)

  let response;
  let status = 0
  let msg = 'MockYieldSource/no-yield';

  try {
    const decimals = await depositToken.decimals()
    const currentBalance = await depositToken.balanceOf(mockYieldSource.address)

    // Calculate a realistic amount of APR given a 5 minute window
    const yieldTokens = currentBalance.mul(APR_PER_CALL_FIXED_POINT_9).div(1e9)
    debug(`Total ${config.network} mock yield source deposits is ${ethers.utils.formatUnits(currentBalance, decimals)}`)
    debug(`Yielding ${ethers.utils.formatUnits(yieldTokens, decimals)} on ${config.network}...`)

    // Populate Transation: encode data without submitting to provider.
    const txData = await mockYieldSource.populateTransaction.yield(yieldTokens)

    // IF executable and Relayer is available.
    if (config.execute && relayer) {
      debug(`Starting MockYieldSource`)
      const txRes = await relayer.sendTransaction({
        data: txData.data,
        to: txData.to,
        speed: 'fast',
        gasLimit: 500000,
      });
      status = 1;
      msg = 'MockYieldSource/distributing-yield';
      response = await provider.getTransaction(txRes.hash);
      debug(`MockYieldSource Complete`)
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
