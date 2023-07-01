import {ethers, upgrades} from 'hardhat';
import TokenConfig from '../config/TokenConfig';
import {TokenContractType} from "../lib/ContractProvider";

async function main() {
  console.log('Preparing upgrade...');

  // We get the contract to upgrade
  const Contract = await ethers.getContractFactory(TokenConfig.contractName);
  const contract = await upgrades.upgradeProxy(TokenConfig.proxyAdminAddress, Contract) as TokenContractType;

  console.log('Contract upgraded, address:', contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
