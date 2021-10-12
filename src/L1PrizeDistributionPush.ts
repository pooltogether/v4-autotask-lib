// @ts-ignore
import { ethers } from 'ethers';
import contracts from '@pooltogether/v4-testnet/testnets.json'
import { ActionState, Relayer } from './types'
import getContract from './utils/getContract';
import getInfuraProvider from "./utils/getInfuraProvider";
import computePrizeDistribution from './utils/computePrizeDistribution';
const debug = require('debug')('pt-autotask')

interface L1PrizeDistributionPushConfig {
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

export async function L1PrizeDistributionPush(config: L1PrizeDistributionPushConfig, relayer: Relayer): Promise<ActionState> {
  // Connects to Infura provider. @TODO // Handle support for multiple networks if neccesary
  const provider = getInfuraProvider(config.network, config.apiKey)

  // INITIALIZE Contracts
  const reserveL1 = getContract('Reserve', config.L1.chainId, provider, contracts)
  const reserveL2 = getContract('Reserve', config.L2.chainId, provider, contracts)
  const drawBuffer = getContract('DrawBuffer', config.L1.chainId, provider, contracts)
  const prizeDistributionBuffer = getContract('PrizeDistributionBuffer', config.L1.chainId, provider, contracts)
  const drawCalculatorTimelock = getContract('DrawCalculatorTimelock', config.L1.chainId, provider, contracts)
  const l1TimelockTrigger = getContract('L1TimelockTrigger', config.L1.chainId, provider, contracts)
  const ticketL1 = getContract('Ticket', config.L1.chainId, provider, contracts)
  const ticketL2 = getContract('Ticket', config.L2.chainId, provider, contracts)
  const prizeTierHistory = getContract('PrizeTierHistory', config.L1.chainId, provider, contracts)

  let msg;
  let newestDraw
  try {
    newestDraw = await drawBuffer.getNewestDraw()
    const totalSupplyTickets = (await ticketL2.totalSupply()).add(await ticketL1.totalSupply())
    const decimals = await ticketL2.decimals()
    debug(`Total supply of tickets: ${ethers.utils.formatUnits(totalSupplyTickets, decimals)}`)

    /// Rinkeby Prize Distribution (L1 Trigger)
    let lastRinkebyPrizeDistributionDrawId = 0
    try {
      const { drawId } = await prizeDistributionBuffer.getNewestPrizeDistribution()
      lastRinkebyPrizeDistributionDrawId = drawId
    } catch (e) {

    }

    const rinkebyTimelockElapsed = await drawCalculatorTimelock.hasElapsed()
    debug(`Last Rinkeby prize distribution draw id is ${lastRinkebyPrizeDistributionDrawId}`)

    // If the prize distribution hasn't propagated and we're allowed to push
    if (lastRinkebyPrizeDistributionDrawId < newestDraw.drawId && rinkebyTimelockElapsed) {
      const drawId = lastRinkebyPrizeDistributionDrawId + 1
      const draw = await drawBuffer.getDraw(drawId)
      const prizeDistribution = await computePrizeDistribution(
        draw,
        prizeTierHistory,
        reserveL1,
        reserveL2,
        totalSupplyTickets,
        decimals
      )

      const txData = await l1TimelockTrigger.populateTransaction.push(draw.drawId, prizeDistribution)
      debug(`Pushing rinkeby prize distrubtion for draw ${drawId}...`)
      const tx = await relayer.sendTransaction({
        data: txData.data,
        to: draw.address,
        speed: 'fast',
        gasLimit: 500000,
      });

      debug(`Propagated prize distribution for draw ${draw.drawId} to Rinkeby: `, tx)
    }

    return {
      err: false,
      msg: msg,
      data: {

      },
    }
  } catch (error) {
    debug(error)
    debug("Draw Unavailable")
    return {
      err: error,
      msg: 'Error',
    }
  }
}

export default L1PrizeDistributionPush