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

  // Connects to Infura provider. @TODO // Handle support for multiple networks if neccesary
  const provider = getInfuraProvider(config.network, config.apiKey)

  // INITIALIZE Contracts
  const reserveL1 = getContract('Reserve', config.L1.chainId, provider, contracts)
  const reserveL2 = getContract('Reserve', config.L2.chainId, provider, contracts)
  const drawBuffer = getContract('DrawBuffer', config.L1.chainId, provider, contracts)
  const prizeDistributionBuffer = getContract('PrizeDistributionBuffer', config.L1.chainId, provider, contracts)
  const drawCalculatorTimelock = getContract('DrawCalculatorTimelock', config.L1.chainId, provider, contracts)
  const l2TimelockTrigger = getContract('L2TimelockTrigger', config.L1.chainId, provider, contracts)
  const ticketL1 = getContract('Ticket', config.L1.chainId, provider, contracts)
  const ticketL2 = getContract('Ticket', config.L2.chainId, provider, contracts)
  const prizeTierHistory = getContract('PrizeTierHistory', config.L1.chainId, provider, contracts)

  try {
    let tx;
    let txRes;
    let status = 0;
    let newestDraw
    let msg = 'L2TimelockTrigger/no-action-required';

    newestDraw = await drawBuffer.getNewestDraw()
    const totalSupplyTickets = (await ticketL2.totalSupply()).add(await ticketL1.totalSupply())
    const decimals = await ticketL2.decimals()
    debug(`Total supply of tickets: ${ethers.utils.formatUnits(totalSupplyTickets, decimals)}`)

    /// L1 Prize Distribution (L1 Trigger)
    let lastPrizeDistributionDrawId = 0
    try {
      const { drawId } = await prizeDistributionBuffer.getNewestPrizeDistribution()
      lastPrizeDistributionDrawId = drawId
    } catch (e) {

    }

    const timelockElapsed = await drawCalculatorTimelock.hasElapsed()
    debug(`Last L1 prize distribution draw id is ${lastPrizeDistributionDrawId}`)

    // If the prize distribution hasn't propagated and we're allowed to push
    if (lastPrizeDistributionDrawId < newestDraw.drawId && timelockElapsed) {
      const drawId = lastPrizeDistributionDrawId + 1
      const draw = await drawBuffer.getDraw(drawId)
      const prizeDistribution = await computePrizeDistribution(
        draw,
        prizeTierHistory,
        ticketL1,
        ticketL2,
        totalSupplyTickets,
        decimals
      )

      // IF executable and Relayer is available.
      if (config.execute && relayer) {
        tx = await l2TimelockTrigger.populateTransaction.push(draw.drawId, prizeDistribution)
        debug(`Pushing L1 prize distrubtion for draw ${drawId}...`)
        txRes = await relayer.sendTransaction({
          data: tx.data,
          to: draw.address,
          speed: 'fast',
          gasLimit: 500000,
        });
        debug(`Propagated prize distribution for draw ${draw.drawId} to L1: `, txRes.hash)
        status = 1;
      }
    }

    return {
      status: status,
      err: false,
      msg: msg,
      transaction: {
        data: tx?.data,
        to: tx?.to,
      },
      data: {

      },
    }
  } catch (error) {
    debug(error)
    return {
      status: 0,
      err: error,
      msg: 'Error',
    }
  }
}
