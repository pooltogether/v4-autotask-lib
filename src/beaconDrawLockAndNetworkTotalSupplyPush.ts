// @ts-nocheck
import { Contract } from '@ethersproject/contracts';
import { Transaction } from '@ethersproject/transactions';
import { ContractsBlob, ProviderOptions } from './types';
import { getContract } from './get/getContract';
import { getJsonRpcProvider } from './get/getJsonRpcProvider';
import {
  getMultiTicketAverageTotalSuppliesBetween,
  sumBigNumbers,
} from './utils';
import { calculateDrawTimestamps } from './helpers';
import { BigNumber } from '@ethersproject/bignumber';
const debug = require('debug')('pt-autotask-lib');

export interface PrizePoolNetworkConfig {
  beaconChain: ProviderOptions;
  targetReceiverChain: ProviderOptions;
  allPrizePoolNetworkChains: ProviderOptions[];
}

export async function beaconDrawLockAndNetworkTotalSupplyPush(
  contracts: ContractsBlob,
  config: PrizePoolNetworkConfig
): Promise<Transaction | undefined> {
  let providerBeaconChain;
  let providerTargetReceiverChain;

  if (config?.beaconChain?.providerUrl) {
    providerBeaconChain = getJsonRpcProvider(config?.beaconChain?.providerUrl);
  }

  if (config?.targetReceiverChain?.providerUrl) {
    providerTargetReceiverChain = getJsonRpcProvider(
      config?.targetReceiverChain?.providerUrl
    );
  }

  // TODO: throw error if no provider?
  if (!providerBeaconChain || !providerTargetReceiverChain) {
    return undefined;
  }

  /* ==========================================================================================*/
  // Initializing Contracts using the Beacon/Receiver/SecondaryReceiver chain configurations
  /* ========================================================================================== */
  const drawBufferBeaconChain = getContract(
    'DrawBuffer',
    config.beaconChain.chainId,
    providerBeaconChain,
    contracts
  );
  const prizeTierHistoryBeaconChain = getContract(
    'PrizeTierHistory',
    config.beaconChain.chainId,
    providerBeaconChain,
    contracts
  );
  const prizeDistributionBufferBeaconChain = getContract(
    'PrizeDistributionBuffer',
    config.beaconChain.chainId,
    providerBeaconChain,
    contracts
  );
  const beaconTimelockAndPushRouter = getContract(
    'BeaconTimelockAndPushRouter',
    config.beaconChain.chainId,
    providerBeaconChain,
    contracts
  );
  const ticketBeaconChain = getContract(
    'Ticket',
    config.beaconChain.chainId,
    providerBeaconChain,
    contracts
  );

  // TODO: throw error if any of the contracts is unavailable?
  if (
    !drawBufferBeaconChain ||
    !prizeTierHistoryBeaconChain ||
    !prizeDistributionBufferBeaconChain ||
    !beaconTimelockAndPushRouter ||
    !ticketBeaconChain
  ) {
    throw new Error('Smart Contracts are unavailable');
  }

  //  Initialize Secondary ReceiverChain contracts
  let otherTicketContracts:
    | Array<Contract | undefined>
    | undefined = config.allPrizePoolNetworkChains?.map(otherTicket => {
    return getContract(
      'Ticket',
      otherTicket.chainId,
      getJsonRpcProvider(otherTicket.providerUrl),
      contracts
    );
  });

  /* ============================================================ */
  // Fetching data from Beacon/SecondaryReceiver Chains
  /* ============================================================ */
  let draw;
  let drawIdToFetch;
  let lastPrizeDistributionDrawId = 0;
  const newestDraw = await drawBufferBeaconChain.getNewestDraw();
  try {
    const {
      drawId,
    } = await prizeDistributionBufferBeaconChain.getOldestPrizeDistribution();
    if (drawId > 0) {
      lastPrizeDistributionDrawId = drawId;
    }
  } catch (error) {}

  console.log('OldestDraw: ', newestDraw);
  if (lastPrizeDistributionDrawId < newestDraw.drawId) {
    drawIdToFetch = lastPrizeDistributionDrawId + 1;
    draw = await drawBufferBeaconChain.getDraw(drawIdToFetch);
    // const prizeTier = await prizeTierHistoryBeaconChain.getPrizeTier(drawIdToFetch)
    const startTimestampOffset = draw.beaconPeriodSeconds;
    const startTime = draw.timestamp - startTimestampOffset;
    const endTime = draw.timestamp - 1000; // Can we calculate the offset without requesting data from the PrizeTierHistory

    const allTicketAverageTotalSupply = await getMultiTicketAverageTotalSuppliesBetween(
      otherTicketContracts,
      startTime,
      endTime
    );
    debug('allTicketAverageTotalSupply', allTicketAverageTotalSupply);

    if (allTicketAverageTotalSupply?.length === 0) {
      throw new Error('No ticket data available');
    }

    const totalNetworkTicketSupply = sumBigNumbers(allTicketAverageTotalSupply);
    // const totalNetworkTicketSupply = BigNumber.from('100000000')

    const drawNew = {
      ...draw,
      drawId: 1,
    };
    console.log('Draw: ', draw);
    console.log('TotalNetworkSupply: ', totalNetworkTicketSupply);

    // @ts-ignore
    return await beaconTimelockAndPushRouter.populateTransaction.push(
      draw,
      totalNetworkTicketSupply
    );
  } else {
    throw new Error('No draw to process');
  }
}
