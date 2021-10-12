import { ethers, Provider } from 'ethers'

export function getProvider(url: string): Provider {
  return new ethers.providers.InfuraProvider('rinkeby', infuraApiKey)
}