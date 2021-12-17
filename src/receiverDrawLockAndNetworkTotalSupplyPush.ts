import { Contract, PopulatedTransaction } from '@ethersproject/contracts';
import { ContractsBlob, PrizePoolNetworkConfig } from './types';
import {
  calculateDrawTimestamps,
  calculateReceiverDrawToPushToTimelock,
  getContract,
  getJsonRpcProvider,
  getMultiTicketAverageTotalSuppliesBetween,
  sumBigNumbers,
} from './utils';

const debug = require('debug')('pt-autotask-lib');

export async function receiverDrawLockAndNetworkTotalSupplyPush(
  contracts: ContractsBlob,
  config: PrizePoolNetworkConfig
): Promise<PopulatedTransaction | undefined> {
  let providerBeaconChain;
  let providerReceiverChain;

  if (config?.beaconChain?.providerUrl) {
    providerBeaconChain = getJsonRpcProvider(config?.beaconChain?.providerUrl);
  }

  if (config?.receiverChain?.providerUrl) {
    providerReceiverChain = getJsonRpcProvider(
      config?.receiverChain?.providerUrl
    );
  }

  if (!providerBeaconChain || !providerReceiverChain) {
    throw new Error('Providers Unavailable: check providerUrl configuration');
  }

  /* ==========================================================================================*/
  // Initializing Contracts using the Beacon/Receiver/SecondaryReceiver chain configurations
  /* ========================================================================================== */

  //  Beacon Chain Contracts
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

  //  Receiver Chain Contracts
  const ticketReceiverChain = getContract(
    'Ticket',
    config.receiverChain.chainId,
    providerReceiverChain,
    contracts
  );
  const prizeDistributionBufferReceiverChain = getContract(
    'PrizeDistributionBuffer',
    config.receiverChain.chainId,
    providerReceiverChain,
    contracts
  );
  const drawCalculatorTimelockReceiverChain = getContract(
    'DrawCalculatorTimelock',
    config.receiverChain.chainId,
    providerReceiverChain,
    contracts
  );
  const receiverTimelockTrigger = getContract(
    'ReceiverTimelockTrigger',
    config.receiverChain.chainId,
    providerReceiverChain,
    contracts
  );

  // TODO: throw error if any of the contracts is unavailable?
  if (
    !drawBufferBeaconChain ||
    !prizeTierHistoryBeaconChain ||
    !prizeDistributionBufferBeaconChain ||
    !prizeDistributionBufferReceiverChain ||
    !drawCalculatorTimelockReceiverChain ||
    !receiverTimelockTrigger ||
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

    if (
      !allTicketAverageTotalSupply ||
      allTicketAverageTotalSupply.length === 0
    ) {
      throw new Error('No Ticket data available');
    }

    const totalNetworkTicketSupply = sumBigNumbers(allTicketAverageTotalSupply);
    return await receiverTimelockTrigger.populateTransaction.push(
      drawFromBeaconChainToPush,
      totalNetworkTicketSupply
    );
  } else {
    throw new Error('No Draw to LockAndPush');
  }
}
