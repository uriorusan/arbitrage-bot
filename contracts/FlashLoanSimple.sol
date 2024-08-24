// contracts/FlashLoan.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {FlashLoanSimpleReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IERC20} from "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SwapUniV3} from "./SwapUniV3.sol";

contract FlashLoanSimple is FlashLoanSimpleReceiverBase {
    address payable owner;

    struct requestFlashLoanArbitrageSimpleParams {
        uint256 amount;
        address[] tokens;
        address[] swapRouters;
        uint24[] poolFees;
    }

    requestFlashLoanArbitrageSimpleParams public storedParams;
    SwapUniV3 private swapContract;

    // events
    event FlashLoanReceived(
        address indexed asset,
        uint256 amount,
        uint256 premium,
        address indexed initiator
    );
    event StoredTransactions(
        uint256 amount,
        address[] tokens,
        address[] swapRouters,
        uint24[] poolFees
    );

    constructor(
        address _addressProvider,
        address _addressSwapContract
    )
        FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) // Initialize the parent contract with the address provider
    {
        owner = payable(msg.sender); // make the deployer of the contract the owner
        swapContract = SwapUniV3(_addressSwapContract);
    }

    /**
        This function is called after your contract has received the flash loaned amount.
        Here we execute the trades as per the directions provided.
     */
    function executeOperation(
        address asset, // address of asset borrowed
        uint256 amount, // amount borrowed
        uint256 premium, // fee to be paid
        address initiator, // initiator of the loan
        bytes calldata params // other params
    ) external override returns (bool) {
        require(initiator == address(this), "Initiator must be this contract");
        require(msg.sender == address(POOL), "Call must come from POOL");
        require(
            asset == storedParams.tokens[0],
            "Asset must match the loan token"
        );
        params; // to silence the warning

        emit FlashLoanReceived(asset, amount, premium, initiator);

        // approve the dex contract to spend the loaned amount and all other tokens
        IERC20(storedParams.tokens[0]).approve(address(swapContract), amount);

        uint256 amountOut = swapContract.swapSingle(
            storedParams.tokens[0],
            storedParams.tokens[1],
            storedParams.swapRouters[0],
            amount,
            storedParams.poolFees[0]
        );

        // approve the dex contract to spend the loaned amount and all other tokens
        IERC20(storedParams.tokens[1]).approve(
            address(swapContract),
            amountOut
        );

        swapContract.swapSingle(
            storedParams.tokens[1],
            storedParams.tokens[0],
            storedParams.swapRouters[1],
            amountOut,
            storedParams.poolFees[1]
        );

        // Calculate the total amount owed including the premium
        uint256 amountOwed = amount + premium;
        IERC20(asset).approve(address(POOL), amountOwed);

        IERC20(asset).transferFrom(
            address(this),
            address(owner),
            IERC20(asset).balanceOf(address(this)) - amountOwed
        );

        return true;
    }

    /**
     * requestFlashLoanArbitrageSimple is the entry point for the contract.
     * it will store the arbitrage details and initiate the flash loan
     * @param _params - requestFlashLoanArbitrageSimpleParams
     */
    function requestFlashLoanArbitrageSimple(
        requestFlashLoanArbitrageSimpleParams calldata _params
    ) public onlyOwner {
        require(_params.tokens.length == 2, "Array length must be 2");
        require(
            _params.tokens.length == _params.swapRouters.length &&
                _params.tokens.length == _params.poolFees.length,
            "Array lengths must match"
        );

        // Store the details for use in executeOperation
        storedParams = _params;

        emit StoredTransactions(
            storedParams.amount,
            storedParams.tokens,
            storedParams.swapRouters,
            storedParams.poolFees
        );

        // Initiate flash loan request
        POOL.flashLoanSimple(
            address(this),
            storedParams.tokens[0],
            storedParams.amount,
            "",
            0
        );
    }

    function getBalance(address _tokenAddress) external view returns (uint256) {
        return IERC20(_tokenAddress).balanceOf(address(this));
    }

    function withdraw(address _tokenAddress) external onlyOwner {
        IERC20 token = IERC20(_tokenAddress);
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }

    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "Only the contract owner can call this function"
        );
        _;
    }

    receive() external payable {}
}
