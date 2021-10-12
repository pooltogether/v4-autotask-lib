import contracts from '@pooltogether/v4-testnet/testnets.json'
import { Config, ActionState, Relayer } from './types'
import { getContract } from './utils/getContract';
import { getInfuraProvider } from "./utils/getInfuraProvider";

const debug = require('debug')('pt-autotask')

export async function drawBeaconHandleDrawStartAndComplete(config: Config, relayer: Relayer): Promise<ActionState> {
  const provider = getInfuraProvider(config.network, config.apiKey)
  const DrawBeacon_Contract = getContract('DrawBeacon', config.chainId, provider, contracts);

  try {
    let msg;
    let completedDraw = false;
    const nextDrawId = await DrawBeacon_Contract.getNextDrawId()
    const beaconPeriodStartedAt = await DrawBeacon_Contract.getBeaconPeriodStartedAt()
    const isRngRequested = await DrawBeacon_Contract.isRngRequested()
    const isBeaconPeriodOver = await DrawBeacon_Contract.isRngRequested()
    const beaconPeriodSeconds = await DrawBeacon_Contract.getBeaconPeriodSeconds()
    const canStartDraw = await DrawBeacon_Contract.canStartDraw()
    const canCompleteDraw = await DrawBeacon_Contract.canCompleteDraw()

    debug('DrawBeacon Beacon PeriodStartedAt:', beaconPeriodStartedAt.toString())
    debug('DrawBeacon Beacon PeriodSeconds:', beaconPeriodSeconds.toString())
    debug('DrawBeacon Beacon PeriodOver:', isBeaconPeriodOver)
    debug('DrawBeacon next Draw.drawId:', nextDrawId)
    debug('Is RNG Requested:', await DrawBeacon_Contract.isRngRequested())
    debug('Can Start Draw:', await DrawBeacon_Contract.canStartDraw())
    debug('Can Complete Draw:', await DrawBeacon_Contract.canCompleteDraw())

    if (await DrawBeacon_Contract.canStartDraw()) {
      debug(`Starting draw ${nextDrawId}...`)
      const tx = await DrawBeacon_Contract.populateTransaction.startDraw()
      const txRes = await relayer.sendTransaction({
        data: tx.data,
        to: tx.to,
        speed: config.speed,
        gasLimit: config.gasLimit,
      });
      debug(`Started Draw ${nextDrawId}: ${txRes.hash}`)
      msg = 'DrawBeacon/starting-draw';
    }

    if (await DrawBeacon_Contract.canCompleteDraw()) {

      debug(`Completing draw ${nextDrawId}...`)
      const tx = await DrawBeacon_Contract.populateTransaction.completeDraw()
      const txRes = await relayer.sendTransaction({
        data: tx.data,
        to: tx.to,
        speed: config.speed,
        gasLimit: config.gasLimit,
      });
      debug(`Completed Draw ${nextDrawId}: ${txRes.hash}`)
      completedDraw = true
      msg = 'DrawBeacon/complete-draw';
    }

    return {
      err: false,
      msg: msg,
      data: {
        isBeaconPeriodOver: isBeaconPeriodOver.toString(),
        beaconPeriodSeconds: beaconPeriodSeconds.toString(),
        canStartDraw,
        canCompleteDraw,
        isRngRequested,
        completedDraw,
      },
    }
  } catch (error) {
    return {
      err: error,
      msg: 'Error',
    }
  }

}