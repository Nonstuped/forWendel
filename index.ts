import { ethers, providers, Wallet, utils, Transaction } from "ethers";
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
} from "@flashbots/ethers-provider-bundle";
import { exit } from "process";

const TOKEN_ADDRESS = "0x326C977E6efc84E512bB9C30f76E30c160eD06FB";
require('dotenv').config();

const main = async () => {
  if (
    process.env.SPONSOR_KEY === undefined ||
    process.env.VICTIM_KEY === undefined
  ) {
    console.error("Please set both SPONSOR_KEY and VICTIM_KEY env");
    exit(1);
  }

  const provider = new providers.JsonRpcProvider(
    "https://rpc.goerli.mudit.blog/"
  );

  const authSigner = Wallet.createRandom();

  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    'https://relay-goerli.flashbots.net',
    "goerli"
  );

  const sponsor = new Wallet(process.env.SPONSOR_KEY).connect(provider);
  console.log(process.env.SPONSOR_KEY)
  const victim = new Wallet(process.env.VICTIM_KEY).connect(provider);
  console.log(process.env.VICTIM_KEY)

  const abi = ["function transfer(address,uint256) external"];
  const iface = new utils.Interface(abi);

  provider.on("block", async (blockNumber) => {
    console.log(blockNumber);
    const targetBlockNumber = blockNumber + 1;
    const resp = await flashbotsProvider.sendBundle(
      [
        {
          signer: sponsor,
          transaction: {
            chainId: 5,
            type: 2,
            to: victim.address,
            value: utils.parseEther("0.02"),
            maxFeePerGas: utils.parseUnits("3", "gwei"),
            maxPriorityFeePerGas: utils.parseUnits("3", "gwei"),
          },
        },
        {
          signer: victim,
          transaction: {
            chainId: 5,
            type: 2,
            to: TOKEN_ADDRESS,
            gasLimit: "21000",
            data: iface.encodeFunctionData("transfer", [
              sponsor.address,
              utils.parseEther("10"),
            ]),
            maxFeePerGas: utils.parseUnits("3", "gwei"),
            maxPriorityFeePerGas: utils.parseUnits("3", "gwei"),
          },
        },
      ],
      targetBlockNumber
    );
    console.log(resp);

    if ("error" in resp) {
      console.log(resp.error.message);
      return;
    }

    const resolution = await resp.wait();
    if (resolution === FlashbotsBundleResolution.BundleIncluded) {
      console.log(`Congrats, included in ${targetBlockNumber}`);
      exit(0);
    } else if (
      resolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion
    ) {
      console.log(`Not included in ${targetBlockNumber}`);
    } else if (resolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
      console.log("Nonce too high, bailing");
      exit(1);
    }
  });
};

main();