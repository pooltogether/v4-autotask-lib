import { Contract, PopulatedTransaction } from '@ethersproject/contracts';
import { ContractsBlob, ProviderOptions } from './types';
import { getContract } from './get/getContract';
import { getJsonRpcProvider } from './get/getJsonRpcProvider';
import {
  getMultiTicketAverageTotalSuppliesBetween,
  sumBigNumbers,
} from './utils';
import {
  calculateDrawTimestamps,
  calculateBeaconDrawToPushToTimelock,
} from './helpers';
const debug = require('debug')('pt-autotask-lib');

export interface PrizePoolNetworkConfig {
  beaconChain: ProviderOptions;
  targetReceiverChain: ProviderOptions;
  allPrizePoolNetworkChains: ProviderOptions[];
}

export async function beaconDrawLockAndNetworkTotalSupplyPush(
  contracts: ContractsBlob,
  config: PrizePoolNetworkConfig
): Promise<PopulatedTransaction | undefined> {
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

  const {
    lockAndPush,
    drawIdToFetch,
  } = await calculateBeaconDrawToPushToTimelock(
    drawBufferBeaconChain,
    prizeDistributionBufferBeaconChain
  );
  if (lockAndPush) {
    let drawFromBeaconChainToPush;
    drawFromBeaconChainToPush = await drawBufferBeaconChain.getDraw(
      drawIdToFetch
    );
    const prizeTier = await prizeTierHistoryBeaconChain.getPrizeTier(
      drawIdToFetch
    );
    const [startTime, endTime] = calculateDrawTimestamps(
      prizeTier,
      drawFromBeaconChainToPush
    );
    const allTicketAverageTotalSupply = await getMultiTicketAverageTotalSuppliesBetween(
      otherTicketContracts,
      startTime,
      endTime
    );
    debug('allTicketAverageTotalSupply', allTicketAverageTotalSupply);

    if (
      !allTicketAverageTotalSupply ||
      allTicketAverageTotalSupply.length === 0
    ) {
      throw new Error('No ticket data available');
    }

    const totalNetworkTicketSupply = sumBigNumbers(allTicketAverageTotalSupply);

    console.log('Draw: ', drawFromBeaconChainToPush);
    console.log('TotalNetworkSupply: ', totalNetworkTicketSupply);
    return await beaconTimelockAndPushRouter.populateTransaction.push(
      drawFromBeaconChainToPush,
      totalNetworkTicketSupply
    );
  } else {
    console.log('No Draw to lock and push');
    return undefined;
  }
}
