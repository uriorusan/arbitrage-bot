## 29th April 2024 - 5th of May 2024

Most of the progress has been in changing the code so that it runs against a fork of the Ethereum network instead of Sepolia using manual interaction with Remix. Instead, all code now runs directly from the terminal without any human interaction by running `npm run setup` followed by `npm run main`.

This allows me to test and develop my contract again and again without having to:
- Change the code
- Copy the code to remix
- Deploy the contract in Sepolia
- If I don't have funds, use a faucet
- Fund the contract
- Execute the contract function that I want to test

Repeat for every small modification in the contract.

As this was not scalable, I looked around until I found the following tutorial:
https://blog.uniswap.org/your-first-uniswap-integration

And set up the hardhat environment with the localhost network and forked the ethereum current state, and then created a few scripts to:

- Deploy the FlashLoan contract
- Change some ETH for WETH ERC20 Token
- Fund the Contract
- Call the contract functions

This was tested and developed using a simple FlashLoan contract that only requests the Loan and immidiately returns it, copied from here:
https://github.com/jspruance/aave-flash-loan-tutorial

## 6th of May - 12th of May 2024

Most of the progress has been on trying to develop a Contract to Swap two tokens on Uniswap. To do this, you basically have to
implement an interface that is already provided by Uniswap, deploy it and then call it's functions.

In general terms, if you can interact with a contract through a UI it will be much easier to understand how to use the contract
using code; you just need to read the transactions they are preparing for you!

So I navigated a bit through the Uniswap interface, which I had done before, but this time looking at the transaction fields and
method calls in Metamask, and saw that it was a relatevely easy:

- Approve the spending of the ERC20. This is a standard function shared in all ERC20 tokens that basically gives permission to another
address to spend your wallet's token when you call a function from that wallet in the next block.

- Choose an amount in or an amount out that you want (you can't choose both) of the pool and prepare an input JSON for the corresponding function.

- Call the function `exactInputSingle` or `exactOutputSingle` of the swapRouter contract. This will give you your other token.

- Check the new balance of the new token in your wallet.


So then I implemented a new script, `src/executeSwapUniswapV3.ts` that does this process on WETH-LINK pair, and it works!

I then tried it from inside the blockchain by creating the contract `SwapContract.sol` and calling IT, but it didn't work.

I'm in the process of finding out why, adding logs and events to the contract.

## 13th of May - 19th of May 2024

After a long session with Jordi Guirao, my professor, we managed to get it running from Remix, but not locally. We didn't understand why this was the case, but he helped me point in the right direction!

Debugging session:
- Realised that the deployment address of the contract when running main.ts was always the same. After a quick google search, I found that this is
expected due to how the contract deployment addresses are calculated [link](https://ethereum.stackexchange.com/questions/17927/how-to-deploy-smart-contract-in-predefined-contract-address-in-private-ethereum). In summary, the contract address is calculated from a deterministic pseudorandom formula that receives as input the wallet address of the deployer and the nonce (number of times this wallet has transacted). Since the nonce is 0 for the predifined wallet addresses, the deployment address is always the same.

- After running the code from zero, the fact that the contract address was "new" allowed it to work.

From there, I modified the FlashLoanOriol contract to receive three arrays of two values each:

- requestFlashLoan is the entry point for the contract.
- it will store the arbitrage details and initiate the flash loan
- @param _amount amount to borrow
- @param _tokens array of token addresses to swap. [0] will be the one loaned, traded for [1] and traded back for [0]
- @param _swapRouters array of swap router addresses. Correlated with _tokens
- param _poolFees array of pool fees. Correlated with _tokens

This allows us to indicate a list of swaps as a three arrays:

- Start by swapping token 0 for 1 on swapRouter 0 with poolFee 0.
- End by swapping n for 0 on swapRouter n with poolFee n.
- in between, token t for t+1, on swapRouter t+1 with poolFee t+1.
- Always trade the max amount of token t available at that step.

I divided this in two contracts for minimal fees, one that allows only one trade and another that allows n trades, called Simple and Multiple


I've been debugging further, and apparently I can only trade with Uniswap. I've tried both Sushiswap and PancakeSwap and both failed.
I'm trying to figure out why this is the case, as they are direct clones of Uniswap:
- apparently sushi had a hack a while back and did something to the Ethereum SwapRouter?
- Pancakeswap should work, I have no idea why it doesn't.

After a bit of debugging, I discovered that Pancake swap has different default "poolFee" tiers, as opposed to Uniswap's 0.05%, 0.30%, and 1% (500, 3000 & 10000 in Eth's units), pancake uses 0.01%, 0.05%, 0.25%, and 1% (100, 500, 2500 & 10000).

It also uses a differently named callback function when doing swaps, but after testing, swapContract works with both pancake and uni.

After adding logging and changing an incorrect contract address, I've managed to do an arbitrage trade with the funds from a Flash Loan!! Finally!

At first I saw that I was netting 0.13Eth of profit with a 1 ETH transaction, and I got curious. Upon further inspection it looks like Pancake V3 WETH-LINK pools is basically empty of liquidity. I was also miscalculating, and actually losing 0.87Eth instead of gaining 1.13!


## 20th of May - 26th of May 2024

During the beggining of the week, I've dedicated time to refactoring the whole code base, which was a bit of a mess. I've now created the Contract Manager abstract class, which handles the deployment, initialisation and funding of the contracts. Other classes then implement this abstract class and have a whol lot of functionality baked in.

This should help explaining in the documentation how everything actually works, which is nice!

I've also refactored the swapContract, flashLoanSimple and flashLoanOriol to use the ContractManager, and they look much nicer now.

Also, main.ts is also much more readable, for example:

```
  let swapContract = new SwapContractManager();
  await swapContract.initialize();
  await swapContract.fundWithWrappedEth("1", wallet);
  await swapContract.executeOnUni();
```

I'll dedicate the rest of the week on writing the actual documentation of how the code works, and once that is done I'll try to find arbitrage opportunities, which I've left for last because I feel (although I might be wrong) that it's a solved problem. I'm sure that there are libraries out there that compute the arbitrage opportunities perfectly and quickly. I've seen [MEV-Inspect](https://docs.flashbots.net/flashbots-data/mev-inspect-py/quick-start), which should be a nice starting point for this.

After a lot of investigation, I've found that finding arbitrage opportunities using FlashBots relies on having an Ethereum node running in a local server. This is obviously out of scope for this project and we'll have to find some alternative.

So to start, I've implemented two classes to get the prices from any UniswapV2 and V3 pairs.

This has allowed me to check for triangular arbitrage prices within UniswapV3, i.e. weth -> USDC -> dai -> weth

To support this triangular arbitrage paths, I've also added a new class in the FlashLoanOriol file to handle more than two trades, which handles requesting a FlashLoan, doing 3 or more trades and then repaying the loan.

I discovered that USDT does not comply with the ERC-20 standard, which is annoying, and used DAI instead.

Then, I managed to execute the trade described above, but for some reason, trading dai for USDC results in a high slippage loss, from ~$3700 to ~$200. Currently investigating why that's the case.


## 27th of May - 2nd of June 2024

Two more weeks to go!

Most of my week will be dedicated to finishing the actual deliverable document, but I've had a look at this code:

https://github.com/flashbots/simple-blind-arbitrage/blob/main/src/BlindBackrunLogic.sol

To try to find the specific formula used to get the exact arbitrage amounts to equilise the prize of two different liquidity pools.

After this, I've reestructured the code to ensure that all the code that remains is useful, and cleaned up a little bit the folder structure for usability.

I've also dedicated time to creating a new contract to trade with UniswapV2, which literally took me less than 10 minutes, it was nice to see how I've improved! We can now find disparities in price between Uniswap V2 & V3 and try to exploit these differences.

Now, with the new getPrice.ts, we can find when there is a difference in price in the two pools and try to exploit them. I'm not sure how to find the exact formula yet, but for now we can just trade a little bit and see how much we profit, if anything. I think we can start with 1 WETH and see.

I'm looking at the USDC/WETH pair as those were the two most borrowed tokens from AAVE v3.

Calculating the exact amount to borrow and trade will require maths and time, and I don't have any more time.

## 3rd of June - 9th of June 2024

This week I've mostly dedicated to writing the report, as the delivery date is the 11th.


## 24th of August
First day I want to dedicate time to this project since delivering it. Will basically just run the code and try to get up to speed where I left.

I really want to start over and try to clean up the project, starting over using bun, since I npm is super slow and each deployment took about 30s. Yeah let's do that.

### The new repo
I created the a repo, called "arbitrage_bot", which is the current repo.

I've ran the following commands to set it up:

- mkdir arbitrage_bot
- cd arbitrage_bot/
- curl -fsSL https://bun.sh/install | bash
- source ~/.bashrc
- bun install hardhat
- bun hardhat init
- bun install @nomicfoundation/hardhat-toolbox@^4.0.0
- bun install @typechain/hardhat
- bun install ethers
- bun install @typechain/ethers-v6

Then copied over the .env and the package.json scripts JSON, as well as the "Imports.sol" and the scripts/lib/ContractManager that I built for my TFM project, then decided to delete the Lock contract that comes by default with hardhat.

Tried to build with "bun run build" but apparently I'm missing to install all of the dependencies, so just went one by one:

- bun install @uniswap/v3-periphery @aave/periphery-v3 @aave/core-v3 @uniswap/v3-core @openzeppelin/contracts @bgd-labs/aave-address-book dotenv

But now it's complaining about not having the correct compilers so let's download them... (setting up is always such a shitty process). I need to import the hardhat.config.ts which should contain all the necessary versions:
```
const solidityConfig: SolidityUserConfig = {
  compilers: [
    {
      version: "0.8.20",
    },
    {
      version: "0.8.10",
    },
    ...,
  ]
};

const config: HardhatUserConfig = {
  solidity: solidityConfig
}
```

### Playing around again
I've just spent quite a bit of time refactoring and deleting unnecessary code. Not perfect but much better now. I still have issues renaming things.

First thing I'd like to try is to get uniswap V3 prices of the same pair of tokens but with different pool fees, and see which one contains the most liquidity and which one has lower price.


Then, I'm trying to fetch liquidity and tick pricing and all that stuff.

