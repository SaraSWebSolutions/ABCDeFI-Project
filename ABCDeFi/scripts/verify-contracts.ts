import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("==================================================");
  console.log("  ABCDeFi Ecosystem — Source Code Verification   ");
  console.log("==================================================");

  const deploymentPath = path.join(__dirname, "../deployments.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `Deployment artifact file not found at ${deploymentPath}. Please run deploy-ecosystem.ts first!`
    );
  }

  const rawData = fs.readFileSync(deploymentPath, "utf8");
  const deploymentData = JSON.parse(rawData);
  const contracts = deploymentData.contracts;

  console.log(`Network: ${deploymentData.network} (Chain ID: ${deploymentData.chainId})`);

  for (const [contractName, info] of Object.entries(contracts) as [string, any][]) {
    const targetAddress = typeof info === "string" ? info : info.address;
    const constructorArgs = typeof info === "string" ? [] : info.args || [];

    console.log(`\n--------------------------------------------------`);
    console.log(`Verifying ${contractName} at ${targetAddress}...`);
    try {
      await hre.run("verify:verify", {
        address: targetAddress,
        constructorArguments: constructorArgs,
      });
      console.log(`✅ ${contractName} verified successfully!`);
    } catch (error: any) {
      if (error.message && error.message.includes("Already Verified")) {
        console.log(`ℹ️ ${contractName} is already verified.`);
      } else {
        console.error(`❌ Verification failed for ${contractName}:`, error.message || error);
      }
    }
  }

  console.log("\n==================================================");
  console.log("  Source Code Verification Finished!              ");
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
