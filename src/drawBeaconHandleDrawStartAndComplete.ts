import contracts from '@pooltogether/v4-testnet/testnets.json'
import { Config, ActionState, Relayer } from './types'
import { getContract } from './utils/getContract';
import { getInfuraProvider } from "./utils/getInfuraProvider";

const debug = require('debug')('pt-autotask')

export async function drawBeaconHandleDrawStartAndComplete(config: Config, relayer: Relayer): Promise<ActionState> {
  const provider = getInfuraProvider(config.network, config.apiKey)
  const drawBeacon = getContract('DrawBeacon', config.chainId, provider, contracts);

  try {
    let msg;
    let completedDraw = false;
    const nextDrawId = await drawBeacon.getNextDrawId()
    const beaconPeriodStartedAt = await drawBeacon.getBeaconPeriodStartedAt()
    const isRngRequested = await drawBeacon.isRngRequested()
    const isBeaconPeriodOver = await drawBeacon.isRngRequested()
    const beaconPeriodSeconds = await drawBeacon.getBeaconPeriodSeconds()
    const canStartDraw = await drawBeacon.canStartDraw()
    const canCompleteDraw = await drawBeacon.canCompleteDraw()

    debug('DrawBeacon Beacon PeriodStartedAt:', beaconPeriodStartedAt.toString())
    debug('DrawBeacon Beacon PeriodSeconds:', beaconPeriodSeconds.toString())
    debug('DrawBeacon Beacon PeriodOver:', isBeaconPeriodOver)
    debug('DrawBeacon next Draw.drawId:', nextDrawId)
    debug('Is RNG Requested:', await drawBeacon.isRngRequested())
    debug('Can Start Draw:', await drawBeacon.canStartDraw())
    debug('Can Complete Draw:', await drawBeacon.canCompleteDraw())

    if (await drawBeacon.canStartDraw()) {
      debug(`Starting draw ${nextDrawId}...`)
      const tx = await drawBeacon.populateTransaction.startDraw()
      const txRes = await relayer.sendTransaction({
        data: tx.data,
        to: tx.to,
        speed: config.speed,
        gasLimit: config.gasLimit,
      });
      debug(`Started Draw ${nextDrawId}: ${txRes.hash}`)
      msg = 'DrawBeacon/starting-draw';
    }

    if (await drawBeacon.canCompleteDraw()) {

      debug(`Completing draw ${nextDrawId}...`)
      const tx = await drawBeacon.populateTransaction.completeDraw()
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