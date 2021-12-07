import { Config, ContractsBlob } from '../types';
import { getContract } from './getContract';
import { getInfuraProvider } from './getInfuraProvider';
const debug = require('debug')('pt-autotask-lib');

interface IDrawBeaconState {
  status: number;
  data?: any;
  err?: any;
}

export async function getDrawBeaconState(
  contracts: ContractsBlob,
  config: Config
): Promise<IDrawBeaconState> {
  try {
    const provider = getInfuraProvider(config.network, config.apiKey);
    const drawBeacon = getContract(
      'DrawBeacon',
      config.chainId,
      provider,
      contracts
    );
    if (!drawBeacon) throw new Error('DrawBeacon contract not found');
    debug('DrawBeacon: ', drawBeacon.address);
    const nextDrawId = await drawBeacon.getNextDrawId();
    const beaconPeriodStartedAt = await drawBeacon.getBeaconPeriodStartedAt();
    const isRngRequested = await drawBeacon.isRngRequested();
    const beaconPeriodSeconds = await drawBeacon.getBeaconPeriodSeconds();
    const canStartDraw = await drawBeacon.canStartDraw();
    const canCompleteDraw = await drawBeacon.canCompleteDraw();

    return {
      status: 1,
      data: {
        nextDrawId,
        beaconPeriodSeconds: beaconPeriodSeconds.toString(),
        beaconPeriodStartedAt: beaconPeriodStartedAt.toString(),
        canStartDraw,
        canCompleteDraw,
        isRngRequested,
      },
    };
  } catch (error) {
    return {
      status: 0,
      err: error,
    };
  }
}

export default getDrawBeaconState;
