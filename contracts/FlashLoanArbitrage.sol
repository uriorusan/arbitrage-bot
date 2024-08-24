// contracts/FlashLoan.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {FlashLoanSimpleReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import {IERC20} from "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/IERC20.sol";
import "hardhat/console.sol";

interface ISwapContractUniV3 {
    function swapSingle(
        address _from,
        address _to,
        address _router,
        uint256 _amount,
        uint24 _poolFee
    ) external returns (uint256);
}

interface ISwapContractUniV2 {
    function swapSingle(
        address _from,
        address _to,
        address _router,
        uint256 _amount
    ) external returns (uint256);
}

contract FlashLoanArbitrage is FlashLoanSimpleReceiverBase {
    address payable owner;
    ISwapContractUniV3 swapContractV3;
    ISwapContractUniV2 swapContractV2;

    enum SwapDirection {
        V2ThenV3,
        V3ThenV2
    }

    struct requestFlashLoanArbitrageSimpleParams {
        uint256 amount;
        address[] tokens;
        address[] swapRouters;
        uint24[] poolFees;
        SwapDirection direction;
    }

    requestFlashLoanArbitrageSimpleParams public storedParams;
    ISwapContractUniV3 private swapContract;

    constructor(
        address _addressProvider,
        address _addressSwapContractV3,
        address _addressSwapContractV2
    )
        FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) // Initialize the parent contract with the address provider
    {
        owner = payable(msg.sender); // make the deployer of the contract the owner
        swapContractV3 = ISwapContractUniV3(_addressSwapContractV3);
        swapContractV2 = ISwapContractUniV2(_addressSwapContractV2);
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

        if (storedParams.direction == SwapDirection.V3ThenV2) {
            console.log("Swapping V3 then V2");
            TransferHelper.safeApprove(asset, address(swapContractV3), amount);

            console.log("Approved swapContractV3 to spend %s", amount);

            uint256 amountOut = swapContractV3.swapSingle(
                storedParams.tokens[0],
                storedParams.tokens[1],
                storedParams.swapRouters[0],
                amount,
                storedParams.poolFees[0]
            );

            console.log("Received %s. Going to swap back in V2", amountOut);

            TransferHelper.safeApprove(
                storedParams.tokens[1],
                address(swapContractV2),
                amountOut
            );

            console.log("Approved swapContractV2 to spend %s", amountOut);

            amountOut = swapContractV2.swapSingle(
                storedParams.tokens[1],
                storedParams.tokens[0],
                storedParams.swapRouters[1],
                amountOut
            );
            console.log("Received %s. Paying back the loan", amountOut);
        } else {
            console.log("Swapping V2 then V3");

            TransferHelper.safeApprove(
                storedParams.tokens[0],
                address(swapContractV2),
                amount
            );

            console.log("Approved swapContractV2 to spend %s", amount);

            uint256 amountOut = swapContractV2.swapSingle(
                storedParams.tokens[0],
                storedParams.tokens[1],
                storedParams.swapRouters[0],
                amount
            );
            console.log("Received %s. Going to swap back in V2", amountOut);

            TransferHelper.safeApprove(
                storedParams.tokens[1],
                address(swapContractV3),
                amountOut
            );

            console.log("Approved swapContractV3 to spend %s", amountOut);

            amountOut = swapContractV3.swapSingle(
                storedParams.tokens[1],
                storedParams.tokens[0],
                storedParams.swapRouters[1],
                amountOut,
                storedParams.poolFees[1]
            );

            console.log("Received %s. Paying back the loan", amountOut);
        }

        console.log(
            "Finished swaps, paying back the loan and premium: %s. Current balance: %s. Token1 balance: %s",
            amount + premium,
            IERC20(asset).balanceOf(address(this)),
            IERC20(storedParams.tokens[1]).balanceOf(address(this))
        );

        // Calculate the total amount owed including the premium
        uint256 amountOwed = amount + premium;
        TransferHelper.safeApprove(asset, address(POOL), amountOwed);

        uint256 amountToOwner = IERC20(asset).balanceOf(address(this)) -
            amountOwed;

        console.log(
            "Amount to owner: %s, owner: ",
            amountToOwner,
            address(owner)
        );

        if (amountToOwner > 0) {
            TransferHelper.safeTransfer(asset, address(owner), amountToOwner);
        }

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

        console.log(
            "Storing params. amount %s, token0 %s, token1 %s",
            storedParams.amount,
            storedParams.tokens[0],
            storedParams.tokens[1]
        );

        console.log(
            "Storing params. swapRouter0 %s, swapRouter1 %s",
            storedParams.swapRouters[0],
            storedParams.swapRouters[1]
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

    function getDirectionParam(
        bool v3First
    ) external pure returns (SwapDirection) {
        if (v3First == true) {
            return SwapDirection.V3ThenV2;
        } else {
            return SwapDirection.V2ThenV3;
        }
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
