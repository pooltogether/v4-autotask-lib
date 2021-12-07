import { PopulatedTransaction } from '@ethersproject/contracts';
import { ContractsBlob, ProviderOptions } from './types';
import { getContract } from './get/getContract';
import { getJsonRpcProvider } from './get/getJsonRpcProvider';
const debug = require('debug')('pt-autotask-lib');

export interface BeaconChainConfig {
  beaconChain: ProviderOptions;
}

export async function drawBeaconHandleDrawStartAndComplete(
  contracts: ContractsBlob,
  config: BeaconChainConfig
): Promise<PopulatedTransaction | undefined> {
  let providerBeaconChain;
  if (config?.beaconChain?.providerUrl) {
    providerBeaconChain = getJsonRpcProvider(config?.beaconChain?.providerUrl);
  } else {
    throw new Error('No Beacon chain provider url provided');
  }

  const drawBeacon = getContract(
    'DrawBeacon',
    config.beaconChain.chainId,
    providerBeaconChain,
    contracts
  );
  if (!drawBeacon) throw new Error('DrawBeacon: Contract not found');

  const nextDrawId = await drawBeacon.getNextDrawId();
  const beaconPeriodStartedAt = await drawBeacon.getBeaconPeriodStartedAt();
  const isRngRequested = await drawBeacon.isRngRequested();
  const isBeaconPeriodOver = await drawBeacon.isRngRequested();
  const beaconPeriodSeconds = await drawBeacon.getBeaconPeriodSeconds();
  const canStartDraw = await drawBeacon.canStartDraw();
  const canCompleteDraw = await drawBeacon.canCompleteDraw();

  // Debug Contract Request Parameters
  debug('DrawBeacon next Draw.drawId:', nextDrawId);
  debug('DrawBeacon Beacon PeriodStartedAt:', beaconPeriodStartedAt.toString());
  debug('DrawBeacon Beacon PeriodSeconds:', beaconPeriodSeconds.toString());
  debug('DrawBeacon Beacon PeriodOver:', isBeaconPeriodOver);
  debug('Is RNG Requested:', isRngRequested);
  debug('Can Start Draw:', canStartDraw);
  debug('Can Complete Draw:', canCompleteDraw);

  let transactionPopulated: PopulatedTransaction | undefined;
  // Action : Can Start Draw
  if (await drawBeacon.canStartDraw()) {
    console.log('DrawBeacon: Starting Draw');
    transactionPopulated = await drawBeacon.populateTransaction.startDraw();
  }

  // Action : Can Complete Draw
  if (await drawBeacon.canCompleteDraw()) {
    console.log('DrawBeacon: Completing Draw');
    transactionPopulated = await drawBeacon.populateTransaction.completeDraw();
  }

  return transactionPopulated;
}
