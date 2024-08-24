// contracts/FlashLoan.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {FlashLoanSimpleReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IERC20} from "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SwapUniV3} from "./SwapUniV3.sol";
import "hardhat/console.sol";

contract FlashLoanMultiple is FlashLoanSimpleReceiverBase {
    address payable owner;

    uint256 public loanAmount;
    address[] public tokens;
    address[] public swapRouters;
    uint24[] public poolFees;
    SwapUniV3 private swapContract;

    constructor(
        address _addressProvider,
        address _dexContractAddress
    )
        FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) // Initialize the parent contract with the address provider
    {
        owner = payable(msg.sender); // make the deployer of the contract the owner
        swapContract = SwapUniV3(_dexContractAddress);
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
        require(asset == tokens[0], "Asset must match the loan token");
        params; // to silence the warning

        uint256 n = tokens.length - 1;
        console.log(
            "current token amount: %s",
            IERC20(tokens[0]).balanceOf(address(this))
        );
        uint256 amountOut = amount;

        for (uint i = 0; i < n; i++) {
            IERC20(tokens[i]).approve(address(swapContract), amountOut);

            console.log(
                "going to swap %s for %s, trading an amount of the first token %s",
                IERC20Metadata(tokens[i]).symbol(),
                IERC20Metadata(tokens[i + 1]).symbol(),
                amountOut
            );

            amountOut = swapContract.swapSingle(
                tokens[i],
                tokens[i + 1],
                swapRouters[i],
                amountOut,
                poolFees[i]
            );

            console.log(
                "Ended up with %s of %s",
                IERC20(tokens[i + 1]).balanceOf(address(this)),
                IERC20Metadata(tokens[i + 1]).symbol()
            );
        }

        console.log(
            "going to swap %s for %s, trading an amount of the first token %s",
            IERC20Metadata(tokens[n]).symbol(),
            IERC20Metadata(tokens[0]).symbol(),
            amountOut
        );

        IERC20(tokens[n]).approve(address(swapContract), amountOut);

        swapContract.swapSingle(
            tokens[n],
            tokens[0],
            swapRouters[n],
            amountOut,
            poolFees[n]
        );

        console.log(
            "Ended up with %s of %s",
            IERC20(tokens[0]).balanceOf(address(this)),
            IERC20Metadata(tokens[0]).symbol()
        );

        // Calculate the total amount owed including the premium
        uint256 amountOwed = amount + premium;
        console.log("amountOwed: %s", amountOwed);

        IERC20(asset).approve(address(POOL), amountOwed);

        IERC20(asset).transfer(
            address(owner),
            IERC20(asset).balanceOf(address(this)) - amountOwed
        );

        return true;
    }

    /**
     * requestFlashLoanArbitrageMultiple is the entry point for the contract.
     * it will store the arbitrage details and initiate the flash loan
     * @param _amount amount to borrow
     * @param _tokens array of token addresses to swap
     * @param _swapRouters array of swap router addresses. Correlated with _tokens
     * @param _poolFees array of pool fees. Correlated with _tokens
     */
    function requestFlashLoanArbitrageMultiple(
        uint256 _amount,
        address[] calldata _tokens,
        address[] calldata _swapRouters,
        uint24[] calldata _poolFees
    ) public onlyOwner {
        require(_tokens.length > 2, "Array length must greater than 2");
        require(
            _tokens.length == _swapRouters.length &&
                _tokens.length == _poolFees.length,
            "Array lengths must match"
        );

        // Store the details for use in executeOperation
        loanAmount = _amount;
        tokens = _tokens;
        swapRouters = _swapRouters;
        poolFees = _poolFees;

        // Initiate flash loan request
        POOL.flashLoanSimple(address(this), _tokens[0], loanAmount, "", 0);
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
