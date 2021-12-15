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
  calculateReceiverDrawToPushToTimelock,
} from './helpers';
const debug = require('debug')('pt-autotask-lib');

export interface PrizePoolNetworkConfig {
  beaconChain: ProviderOptions;
  targetReceiverChain: ProviderOptions;
  allPrizePoolNetworkChains: ProviderOptions[];
}

export async function receiverDrawLockAndNetworkTotalSupplyPush(
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

  //  Initialize BeaconChain contracts
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

  //  Initialize ReceiverChain contracts
  const ticketReceiverChain = getContract(
    'Ticket',
    config.targetReceiverChain.chainId,
    providerTargetReceiverChain,
    contracts
  );
  const prizeDistributionBufferReceiverChain = getContract(
    'PrizeDistributionBuffer',
    config.targetReceiverChain.chainId,
    providerTargetReceiverChain,
    contracts
  );
  const drawCalculatorTimelockReceiverChain = getContract(
    'DrawCalculatorTimelock',
    config.targetReceiverChain.chainId,
    providerTargetReceiverChain,
    contracts
  );
  const receiverTimelockAndPushRouter = getContract(
    'ReceiverTimelockAndPushRouter',
    config.targetReceiverChain.chainId,
    providerTargetReceiverChain,
    contracts
  );

  // TODO: throw error if any of the contracts is unavailable?
  if (
    !drawBufferBeaconChain ||
    !prizeTierHistoryBeaconChain ||
    !prizeDistributionBufferBeaconChain ||
    !prizeDistributionBufferReceiverChain ||
    !drawCalculatorTimelockReceiverChain ||
    !receiverTimelockAndPushRouter ||
    !ticketReceiverChain
  )
    return undefined;

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
  // Fetching data from Beacon/Receiver/SecondaryReceiver Chains
  /* ============================================================ */
  const {
    drawFromBeaconChainToPush,
    drawIdToFetch,
    lockAndPush,
  } = await calculateReceiverDrawToPushToTimelock(
    drawBufferBeaconChain,
    prizeDistributionBufferBeaconChain,
    prizeDistributionBufferReceiverChain,
    drawCalculatorTimelockReceiverChain
  );

  if (lockAndPush) {
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

    if (!allTicketAverageTotalSupply) {
      throw new Error('No ticket data available');
    }

    const totalNetworkTicketSupply = sumBigNumbers(allTicketAverageTotalSupply);

    return await receiverTimelockAndPushRouter.populateTransaction.push(
      drawFromBeaconChainToPush,
      totalNetworkTicketSupply
    );
  } else {
    console.log('No Draw to lock and push');
    return undefined;
  }
}
