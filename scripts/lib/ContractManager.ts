
import { IERC20Metadata } from '../../typechain-types';
import { ethers } from "hardhat";
import { AaveV3Ethereum } from "@bgd-labs/aave-address-book";
import { Contract } from 'ethers';
import { MyTokenList } from '../TokenLists/MyTokenList';

/**
 * Interface defining the structure of a contract manager.
 *
 * @template T - The type of the contract being managed.
 */
interface IContractManager<T> {
    /**
     * Initializes the contract, signer, and other dependencies.
     */
    initialize(): Promise<void>;
}


/**
 * Abstract class to manage Ethereum smart contracts with utility functions for ERC20 operations and funding mechanisms.
 *
 * @template T - The type of the contract being managed.
 */
export abstract class ContractManager<T> implements IContractManager<T> {
    signer: any;
    wallet: string = "";
    address: string;
    contract: T = {} as T;
    contractName: string;
    wEth: IERC20Metadata = {} as IERC20Metadata;
    Link: IERC20Metadata = {} as IERC20Metadata;
    wEthAddress: string = AaveV3Ethereum.ASSETS.WETH.UNDERLYING;
    LinkAddress: string = AaveV3Ethereum.ASSETS.LINK.UNDERLYING;
    deployParams: any[];
    tokenList: MyTokenList = new MyTokenList();

    /**
     * Constructor for ContractManager.
     *
     * @param {string} contractName - The name of the contract to manage.
     * @param {string} [address] - The address of the deployed contract.
     * @param {any[]} [deployParams] - Parameters for deploying the contract.
     */
    constructor(contractName: string, address?: string, deployParams?: any[]) {
        this.address = address || "";
        this.contractName = contractName;
        this.deployParams = deployParams || [];
    }

    /**
     * Initializes the contract, signer, and ERC20 tokens (LINK, WETH).
     */
    async initialize() {
        this.signer = await ethers.provider.getSigner();
        this.wallet = await this.signer.getAddress();
        if (this.address === "") {
            this.address = await this.deploy();
        }
        this.contract = await this.getContractInstance(this.contractName, this.address) as T;
        this.Link = await this.getErc20Token(this.LinkAddress);
        this.wEth = await this.getErc20Token(this.wEthAddress);
    }

    /**
     * Deploys a new instance of the contract if no address is provided.
     *
     * @private
     * @returns {Promise<string>} The address of the deployed contract.
     */
    private async deploy(): Promise<string> {
        let factory = await ethers.getContractFactory(this.contractName, this.signer);
        let contract = await factory.deploy(...this.deployParams);
        contract.waitForDeployment();

        let address = await contract.getAddress();
        console.log(`${this.contractName} deployed to:`, address);
        return address;
    }

    /**
     * Gets the balance of LINK tokens.
     *
     * @param {string} [address] - The address to check the balance of. Defaults to the contract address.
     * @returns {Promise<number>} The LINK token balance in standard units.
     */
    async getLinkBalance(address?: string) {
        let LinkDecimals = ethers.getBigInt(10) ** ethers.getBigInt(await this.Link.decimals());
        let balanceLink = Number(await this.Link.balanceOf(address || this.address)) / Number(LinkDecimals)
        return balanceLink;
    }

    /**
     * Gets the balance of WETH tokens.
     *
     * @param {string} [address] - The address to check the balance of. Defaults to the contract address.
     * @returns {Promise<number>} The WETH token balance in standard units.
     */
    async getWEthBalance(address?: string) {
        let wEthDecimals = ethers.getBigInt(10) ** ethers.getBigInt(18);
        let balanceWETH = Number(await this.wEth.balanceOf(address || this.address)) / Number(wEthDecimals);
        return balanceWETH;
    }

    /**
     * Sends a specified amount of ETH to the contract address.
     *
     * @param {string} amount - The amount of ETH to send in standard units.
     */
    async fundWithEth(amount: string) {
        let amountWei = ethers.parseEther(amount);
        console.log(`Sending ${amount} ETH from ${this.signer.address} to ${this.address}`);

        const tx = await this.signer.sendTransaction({
            to: this.address,
            value: amountWei
        });

        await tx.wait();
    }


    /**
     * Funds a specified address with Wrapped ETH (WETH) using the Aave Gateway.
     *
     * @param {string} amount - The amount of WETH to send in standard units.
     * @param {string} [address] - The address to receive the WETH. Defaults to the contract address.
     */
    fundWithWrappedEth = async (amount: string, address?: string) => {
        let amountWei = ethers.parseEther(amount);

        const wEthGatewayAddress = AaveV3Ethereum.WETH_GATEWAY;
        const wEthGateway = await ethers.getContractAt('WrappedTokenGatewayV3', wEthGatewayAddress, this.signer);

        // Setup for Aave interactions. We need to get some aLink tokens to use as collateral
        const poolAddressesProviderAddress = AaveV3Ethereum.POOL_ADDRESSES_PROVIDER;
        const poolAddressesProvider = await ethers.getContractAt("IPoolAddressesProvider", poolAddressesProviderAddress, this.signer);
        const poolAddress = await poolAddressesProvider.getPool();
        const pool = await ethers.getContractAt("IPool", poolAddress, this.signer);

        let tx = await wEthGateway.depositETH(poolAddress, this.signer.address, 0, { value: amountWei });
        await tx.wait();

        let wEthAddress = AaveV3Ethereum.ASSETS.WETH.UNDERLYING;

        if (!address || address === "") {
            address = this.address;
        }

        tx = await pool.withdraw(wEthAddress, amountWei, address);
        await tx.wait();

        console.log(`Sent ${amount} weth to ${address}`);
    }

    /**
     * Retrieves an ERC20 token contract instance.
     *
     * @param {string} address - The address of the ERC20 token.
     * @returns {Promise<IERC20Metadata>} The ERC20 token contract instance.
     */
    getErc20Token = async (address: string) => {
        return await ethers.getContractAt('IERC20Metadata', address, this.signer);
    }

    /**
     * Converts BigInt values to strings for JSON serialization.
     *
     * @param {any} key - The object key.
     * @param {any} value - The object value.
     * @returns {any} The stringified value if it is a BigInt, otherwise the original value.
     */
    replacer = (key: any, value: any) =>
        typeof value === 'bigint' ? value.toString() : value; // Convert BigInt to String

    /**
     * Utility function to get a contract instance.
     *
     * @private
     * @param {string} contractName - The name of the contract interface.
     * @param {string} address - The contract address.
     * @returns {Promise<Contract>} The contract instance.
     */
    private async getContractInstance(contractName: string, address: string): Promise<Contract> {
        return ethers.getContractAt(contractName, address, this.signer);
    }

    /**
     * Utility function to retrieve the Aave Pool address.
     *
     * @private
     * @returns {Promise<string>} The Aave Pool address.
     */
    private async getPoolAddress(): Promise<string> {
        const poolAddressesProviderAddress = AaveV3Ethereum.POOL_ADDRESSES_PROVIDER;
        const poolAddressesProvider = await this.getContractInstance('IPoolAddressesProvider', poolAddressesProviderAddress);
        return poolAddressesProvider.getPool();
    }
}
