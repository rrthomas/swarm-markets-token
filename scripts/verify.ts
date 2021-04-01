import hre from 'hardhat';
import path from 'path';
import { promises as fs } from 'fs';

import { getChainId, networkNames } from '@openzeppelin/upgrades-core';

async function main(): Promise<void> {
  const deploymentData = await read(await getDeploymentFile());

  // SwarmMarketsToken
  await hre.run('verify:verify', {
    address: deploymentData.SwarmMarketsToken.address,
    constructorArguments: [deploymentData.SmtVesting.address],
    contract: 'contracts/SwarmMarketsToken.sol:SwarmMarketsToken',
  });

  // SmtVesting
  await hre.run('verify:verify', {
    address: deploymentData.SmtVesting.address,
    constructorArguments: [],
  });

  // SmtDistributor
  await hre.run('verify:verify', {
    address: deploymentData.SmtDistributor.address,
    constructorArguments: [deploymentData.SwarmMarketsToken.address],
  });
}

async function read(filename: string): Promise<any> {
  try {
    return JSON.parse(await fs.readFile(filename, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') {
      return {};
    } else {
      throw e;
    }
  }
}

async function getDeploymentFile() {
  const chainId = await getChainId(hre.network.provider);
  const name = networkNames[chainId] ?? `unknown-${chainId}`;
  return path.join(`deployments/${name}.json`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    // spinner.fail();
    console.error(error);
    process.exit(1);
  });
