import { Contract, PopulatedTransaction } from '@ethersproject/contracts';
import { ContractsBlob, PrizePoolNetworkConfig } from './types';
import {
  calculateDrawTimestamps,
  calculateBeaconDrawToPushToTimelock,
  getContract,
  getJsonRpcProvider,
  getMultiTicketAverageTotalSuppliesBetween,
  sumBigNumbers,
} from './utils';

const debug = require('debug')('pt-autotask-lib');

export async function beaconDrawLockAndNetworkTotalSupplyPush(
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

  // TODO: throw error if no provider?
  if (!providerBeaconChain || !providerReceiverChain) {
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
    'BeaconTimelockTrigger',
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
    const drawFromBeaconChainToPush = await drawBufferBeaconChain.getDraw(
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
      throw new Error('No Ticket data available');
    }

    const totalNetworkTicketSupply = sumBigNumbers(allTicketAverageTotalSupply);
    console.log('Draw: ', drawFromBeaconChainToPush);
    console.log('TotalNetworkSupply: ', totalNetworkTicketSupply);

    return await beaconTimelockAndPushRouter.populateTransaction.push(
      drawFromBeaconChainToPush,
      totalNetworkTicketSupply
    );
  } else {
    throw new Error('No Draw to LockAndPush');
  }
}
