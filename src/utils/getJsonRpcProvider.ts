import { ethers } from 'ethers'

export function getJsonRpcProvider(url: string) {
  return new ethers.providers.JsonRpcProvider(url)
}

export default getJsonRpcProvider;