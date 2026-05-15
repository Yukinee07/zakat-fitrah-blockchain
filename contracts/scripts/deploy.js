const { ethers, network, artifacts } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ZakatFitrah with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  const ZakatFitrah = await ethers.getContractFactory("ZakatFitrah");
  const contract    = await ZakatFitrah.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("ZakatFitrah deployed to:", address);

  // ── Build the shared artefact ──────────────────────────────────────────────
  const artifact = await artifacts.readArtifact("ZakatFitrah");

  const output = {
    address,
    abi:        artifact.abi,
    network:    network.name,
    chainId:    network.config.chainId ?? 31337,
    deployedAt: new Date().toISOString(),
  };

  // ── Write to client and server abi directories ─────────────────────────────
  const destinations = [
    path.join(__dirname, "../../client/src/abi/ZakatFitrah.json"),
    path.join(__dirname, "../../server/src/abi/ZakatFitrah.json"),
  ];

  for (const dest of destinations) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(output, null, 2));
    console.log("ABI written to:", dest);
  }

  console.log("\n--- Deployment Summary ---");
  console.log("Network:     ", network.name);
  console.log("Address:     ", address);
  console.log("Deployer:    ", deployer.address);
  console.log("Deployed at: ", output.deployedAt);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
