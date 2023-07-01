import {ethers, upgrades} from 'hardhat';
import TokenConfig from '../config/TokenConfig';

async function main() {
  console.log('Preparing upgrade...');

  // We get the contract to deploy
  const Contract = await ethers.getContractFactory(TokenConfig.contractName);
  const contractAddress = await upgrades.prepareUpgrade(TokenConfig.proxyAdminAddress, Contract) as string;

  console.log('Contract at:', contractAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
