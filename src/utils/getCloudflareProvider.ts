import { ethers } from 'ethers'

export function getCloudflareProvider() {
  return new ethers.providers.CloudflareProvider();
}