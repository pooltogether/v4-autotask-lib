import { computeCardinality } from './computeCardinality'
import { calculatePicks } from './calculatePicks'
import { Draw } from '../types'
import { Contract } from '@ethersproject/contracts'
const debug = require('debug')('pt:autotask')

interface IPrizeDistribution {
    bitRangeSize: any;
    matchCardinality: any;
    tiers: any;
    maxPicksPerUser: any;
    numberOfPicks: any;
    startTimestampOffset: any;
    prize: any;
    endTimestampOffset: any;
}

export async function computePrizeDistribution(
    draw: Draw,
    prizeTierHistory: Contract,
    ticket: Contract,
    otherTicket: Contract,
    totalSupplyTickets: number,
    totalSupplyDecimals: number
): Promise<IPrizeDistribution> {
    const prizeTier = await prizeTierHistory.getPrizeTier(draw.drawId)

    const beaconPeriod = draw.beaconPeriodSeconds
    const startTimestampOffset = beaconPeriod
    const endTimestampOffset = prizeTier.endTimestampOffset
    const expiryDuration = prizeTier.expiryDuration

    debug('computePrizeDistribution: computing cardinality')
    const matchCardinality = computeCardinality(prizeTier.bitRangeSize, totalSupplyTickets, totalSupplyDecimals)
    debug(`cardinality is ${matchCardinality}`)

    debug('computePrizeDistribution: computing number of picks')
    const numberOfPicks = await calculatePicks(prizeTier.bitRangeSize, matchCardinality, beaconPeriod - startTimestampOffset, beaconPeriod - endTimestampOffset, ticket, otherTicket)
    debug(`number of picks is ${numberOfPicks}`)

    const prizeDistribution = {
        bitRangeSize: prizeTier.bitRangeSize,
        matchCardinality,
        tiers: prizeTier.tiers,
        maxPicksPerUser: prizeTier.maxPicksPerUser,
        expiryDuration,
        numberOfPicks,
        startTimestampOffset,
        prize: prizeTier.prize,
        endTimestampOffset
    }
    debug('prize distribution: ', prizeDistribution)
    return prizeDistribution
}

export default computePrizeDistribution