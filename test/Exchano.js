const {
  loadFixture
} = require('@nomicfoundation/hardhat-toolbox/network-helpers')
const { expect } = require('chai')
const { ethers } = require('hardhat')
const { bigint } = require('hardhat/internal/core/params/argumentTypes')

describe('Exchano', function () {
  const initialSupplyA = 1000000
  const initialSupplyB = 50000000
  const initialSupplyC = 75000000
  const initialSupplyD = 65000000

  const addAmountTokenA = 100000
  const addAmountTokenB = 200000
  const swapA = 10000
  const swapB = 15000
  const feeRate = 100
  const withdrawFee = 10

  async function deployExchanoFixture () {
    const [owner, addr1, addr2] = await ethers.getSigners()

    const tokenA = await ethers.deployContract('ERC20Mock', [initialSupplyA])
    const tokenB = await ethers.deployContract('ERC20Mock', [initialSupplyB])
    const tokenC = await ethers.deployContract('ERC20Mock', [initialSupplyC])
    const tokenD = await ethers.deployContract('ERC20Mock', [initialSupplyD])

    const feeCollector = await ethers.deployContract('FeeCollector')

    const feeCollectorAddress = await feeCollector.getAddress()

    const exchano = await ethers.deployContract('Exchano', [
      feeCollectorAddress,
      feeRate
    ])

    await tokenA.mint(addr1.address, initialSupplyA)
    await tokenB.mint(addr1.address, initialSupplyB)
    await tokenC.mint(addr1.address, initialSupplyC)
    await tokenD.mint(addr1.address, initialSupplyD)

    return {
      feeCollector,
      tokenA,
      tokenB,
      tokenC,
      tokenD,
      exchano,
      owner,
      addr1,
      addr2
    }
  }

  describe('Deployment', function () {
    it('Should correctly deploy the tokenFlow contract and assign tokens to owner', async function () {
      const { feeCollector, tokenA, tokenB, exchano, owner } =
        await loadFixture(deployExchanoFixture)

      const ownerABalance = await tokenA.balanceOf(owner.address)
      expect(ownerABalance).to.equal(initialSupplyA)

      const ownerBBalance = await tokenB.balanceOf(owner.address)
      expect(ownerBBalance).to.equal(initialSupplyB)

      const feeRate = await exchano.feeRate()
      expect(feeRate).to.equal(feeRate)

      const feeCollectorOwner = await feeCollector.owner()
      expect(feeCollectorOwner).to.equal(owner.address)

      const exchanoOwner = await exchano.owner()
      expect(exchanoOwner).to.equal(owner.address)

      const feeCollectorontractAddress = await feeCollector.getAddress()
      const exchanoContractAddress = await exchano.getAddress()

      const feeCollectorABalance = await tokenA.balanceOf(
        feeCollectorontractAddress
      )
      const feeCollectorBBalance = await tokenB.balanceOf(
        feeCollectorontractAddress
      )
      expect(feeCollectorABalance).to.equal(0)
      expect(feeCollectorBBalance).to.equal(0)

      const exchanoABalance = await tokenA.balanceOf(exchanoContractAddress)
      const exchanoBBalance = await tokenB.balanceOf(exchanoContractAddress)

      expect(exchanoABalance).to.equal(0)
      expect(exchanoBBalance).to.equal(0)
    })
    it('Should fail to deploy with zero address as feeCollector', async function () {
      await expect(
        ethers.deployContract('Exchano', [ethers.ZeroAddress, feeRate])
      ).to.be.revertedWith('Invalid feeCollector address')
    })
  })

  describe('Add Liquidity', function () {
    it('Should allow user to create liquidity pool and add liquidity to it', async function () {
      const { tokenA, tokenB, exchano, owner } = await loadFixture(
        deployExchanoFixture
      )

      const exchanoContractAddress = await exchano.getAddress()
      const tokenAAddress = await tokenA.getAddress()
      const tokenBAddress = await tokenB.getAddress()

      const initialOwnerBalanceA = await tokenA.balanceOf(owner.address)
      const initialOwnerBalanceB = await tokenB.balanceOf(owner.address)

      await tokenA.approve(exchanoContractAddress, addAmountTokenA)
      await tokenB.approve(exchanoContractAddress, addAmountTokenB)

      await expect(
        exchano.addLiquidity(
          tokenAAddress,
          tokenBAddress,
          addAmountTokenA,
          addAmountTokenB
        )
      ).to.not.be.reverted

      const pairKey = ethers.keccak256(
        ethers.solidityPacked(
          ['address', 'address'],
          [tokenAAddress, tokenBAddress]
        )
      )

      const pool = await exchano.liquidityPools(pairKey)
      expect(pool.lpToken).to.not.equal(ethers.ZeroAddress)
      expect(pool.tokenABalance).to.equal(addAmountTokenA)
      expect(pool.tokenBBalance).to.equal(addAmountTokenB)
      expect(pool.totalLiquidity).to.be.gt(0)

      const LPToken = await ethers.getContractFactory('LPToken')
      const lpToken = LPToken.attach(pool.lpToken)

      const ownerLPBalance = await lpToken.balanceOf(owner.address)

      const expectedInitialLiquidity = BigInt(
        Math.floor(Math.sqrt(Number(addAmountTokenA) * Number(addAmountTokenB)))
      )

      expect(ownerLPBalance).to.equal(expectedInitialLiquidity)

      expect(await tokenA.balanceOf(owner.address)).to.equal(
        initialOwnerBalanceA - BigInt(addAmountTokenA)
      )

      expect(await tokenB.balanceOf(owner.address)).to.equal(
        initialOwnerBalanceB - BigInt(addAmountTokenB)
      )
    })

    it('Should allow users to add liquidity to existing pools', async function () {
      const { tokenA, tokenB, exchano, owner, addr1 } = await loadFixture(
        deployExchanoFixture
      )

      const exchanoContractAddress = await exchano.getAddress()
      const tokenAAddress = await tokenA.getAddress()
      const tokenBAddress = await tokenB.getAddress()

      const initialOwnerBalanceA = await tokenA.balanceOf(owner.address)
      const initialOwnerBalanceB = await tokenB.balanceOf(owner.address)

      const initialAddr1BalanceA = await tokenA.balanceOf(addr1.address)
      const initialAddr1BalanceB = await tokenB.balanceOf(addr1.address)

      await tokenA.approve(exchanoContractAddress, addAmountTokenA)
      await tokenB.approve(exchanoContractAddress, addAmountTokenB)

      await exchano.addLiquidity(
        tokenAAddress,
        tokenBAddress,
        addAmountTokenA,
        addAmountTokenB
      )

      const pairKey = ethers.keccak256(
        ethers.solidityPacked(
          ['address', 'address'],
          [tokenAAddress, tokenBAddress]
        )
      )
      const pool = await exchano.liquidityPools(pairKey)
      const LPToken = await ethers.getContractFactory('LPToken')
      const lpToken = LPToken.attach(pool.lpToken)

      const ownerInitialLPBalance = await lpToken.balanceOf(owner.address)
      const expectedInitialLiquidity = BigInt(
        Math.floor(Math.sqrt(Number(addAmountTokenA) * Number(addAmountTokenB)))
      )
      expect(ownerInitialLPBalance).to.equal(expectedInitialLiquidity)

      await tokenA
        .connect(addr1)
        .approve(exchanoContractAddress, addAmountTokenA)
      await tokenB
        .connect(addr1)
        .approve(exchanoContractAddress, addAmountTokenB)

      const totalSupplyBefore = await lpToken.totalSupply()

      await exchano
        .connect(addr1)
        .addLiquidity(
          tokenAAddress,
          tokenBAddress,
          addAmountTokenA,
          addAmountTokenB
        )

      const share0 =
        (BigInt(addAmountTokenA) * totalSupplyBefore) /
        BigInt(pool.tokenABalance)
      const share1 =
        (BigInt(addAmountTokenB) * totalSupplyBefore) /
        BigInt(pool.tokenBBalance)
      const expectedAddr1Liquidity = share0 < share1 ? share0 : share1

      const ownerFinalLPBalance = await lpToken.balanceOf(owner.address)
      const addr1LPBalance = await lpToken.balanceOf(addr1.address)
      const totalSupplyAfter = await lpToken.totalSupply()

      expect(ownerFinalLPBalance).to.equal(ownerInitialLPBalance)
      expect(addr1LPBalance).to.equal(expectedAddr1Liquidity)
      expect(totalSupplyAfter).to.equal(ownerFinalLPBalance + addr1LPBalance)

      expect(await tokenA.balanceOf(owner.address)).to.equal(
        initialOwnerBalanceA - BigInt(addAmountTokenA)
      )
      expect(await tokenB.balanceOf(owner.address)).to.equal(
        initialOwnerBalanceB - BigInt(addAmountTokenB)
      )
      expect(await tokenA.balanceOf(addr1.address)).to.equal(
        initialAddr1BalanceA - BigInt(addAmountTokenA)
      )
      expect(await tokenB.balanceOf(addr1.address)).to.equal(
        initialAddr1BalanceB - BigInt(addAmountTokenB)
      )

      const updatedPool = await exchano.liquidityPools(pairKey)
      expect(updatedPool.tokenABalance).to.equal(
        BigInt(addAmountTokenA) * BigInt(2)
      )
      expect(updatedPool.tokenBBalance).to.equal(
        BigInt(addAmountTokenB) * BigInt(2)
      )

      const ownerShare = (ownerFinalLPBalance * BigInt(100)) / totalSupplyAfter
      const addr1Share = (addr1LPBalance * BigInt(100)) / totalSupplyAfter

      expect(ownerShare).to.be.closeTo(BigInt(50), BigInt(1))
      expect(addr1Share).to.be.closeTo(BigInt(50), BigInt(1))

      expect(updatedPool.lpToken).to.not.equal(ethers.ZeroAddress)
      expect(updatedPool.totalLiquidity).to.equal(
        BigInt(addAmountTokenA) * BigInt(2) +
          BigInt(addAmountTokenB) * BigInt(2)
      )
    })
    it('Should allow support for multiple liquidity pools', async function () {
      const { tokenA, tokenB, tokenC, tokenD, exchano, owner, addr1 } =
        await loadFixture(deployExchanoFixture)
    })
  })

  // describe('Swap', function () {
  //   it('Should allow the owner to swap tokenA for tokenB', async function () {
  //     const { feeCollector, tokenA, tokenB, tokenFlow, owner, addr1 } =
  //       await loadFixture(deployTokenFlowFixture)

  //     const feeCollectorontractAddress = await feeCollector.getAddress()
  //     const tokenFlowContractAddress = await tokenFlow.getAddress()

  //     const tokenAAddres = await tokenA.getAddress()
  //     const tokenBAddress = await tokenB.getAddress()

  //     const feeRate = await tokenFlow.feeRate()

  //     await tokenA.approve(tokenFlowContractAddress, addAmountTokenA)
  //     await tokenB.approve(tokenFlowContractAddress, addAmountTokenB)

  //     await tokenFlow.addLiquidity(
  //       tokenAAddres,
  //       tokenBAddress,
  //       addAmountTokenA,
  //       addAmountTokenB
  //     )

  //     initialOwnerBalanceA = await tokenA.balanceOf(owner.address)
  //     initialOwnerBalanceB = await tokenB.balanceOf(owner.address)
  //     initialFeeCollectorBalanceA = await tokenB.balanceOf(
  //       feeCollectorontractAddress
  //     )

  //     await tokenA.approve(tokenFlowContractAddress, swapA)
  //     await tokenFlow.swap(tokenAAddres, tokenBAddress, swapA)

  //     const expectedFee = (BigInt(swapA) * BigInt(feeRate)) / BigInt(10000)

  //     expect(await tokenA.balanceOf(owner.address)).to.equal(
  //       initialOwnerBalanceA - BigInt(swapA)
  //     )

  //     expect(await tokenB.balanceOf(owner.address)).to.equal(
  //       initialOwnerBalanceB + BigInt(swapA) - expectedFee
  //     )

  //     expect(await tokenA.balanceOf(feeCollectorontractAddress)).to.equal(
  //       initialFeeCollectorBalanceA + expectedFee
  //     )
  //   })
  //   it('Should allow the owner to swap tokenB for tokenA', async function () {
  //     const { feeCollector, tokenA, tokenB, tokenFlow, owner, addr1 } =
  //       await loadFixture(deployTokenFlowFixture)

  //     const feeCollectorontractAddress = await feeCollector.getAddress()
  //     const tokenFlowContractAddress = await tokenFlow.getAddress()

  //     const tokenAAddres = await tokenA.getAddress()
  //     const tokenBAddress = await tokenB.getAddress()

  //     const feeRate = await tokenFlow.feeRate()

  //     await tokenA.approve(tokenFlowContractAddress, addAmountTokenA)
  //     await tokenB.approve(tokenFlowContractAddress, addAmountTokenB)

  //     await tokenFlow.addLiquidity(
  //       tokenAAddres,
  //       tokenBAddress,
  //       addAmountTokenA,
  //       addAmountTokenB
  //     )

  //     initialOwnerBalanceA = await tokenA.balanceOf(owner.address)
  //     initialOwnerBalanceB = await tokenB.balanceOf(owner.address)
  //     initialFeeCollectorBalanceB = await tokenB.balanceOf(
  //       feeCollectorontractAddress
  //     )

  //     await tokenB.approve(tokenFlowContractAddress, swapB)
  //     await tokenFlow.swap(tokenBAddress, tokenAAddres, swapB)

  //     const expectedFee = (BigInt(swapB) * BigInt(feeRate)) / BigInt(10000)

  //     expect(await tokenB.balanceOf(owner.address)).to.equal(
  //       initialOwnerBalanceB - BigInt(swapB)
  //     )

  //     expect(await tokenA.balanceOf(owner.address)).to.equal(
  //       initialOwnerBalanceA + BigInt(swapB) - expectedFee
  //     )

  //     expect(await tokenB.balanceOf(feeCollectorontractAddress)).to.equal(
  //       initialFeeCollectorBalanceB + expectedFee
  //     )
  //   })
  //   it('Should fail swap if transferFrom fails due to insufficient approval', async function () {
  //     const { tokenA, tokenB, tokenFlow, addr1 } = await loadFixture(
  //       deployTokenFlowFixture
  //     )

  //     const tokenFlowContractAddress = await tokenFlow.getAddress()
  //     const tokenAAddress = await tokenA.getAddress()
  //     const tokenBAddress = await tokenB.getAddress()

  //     await expect(
  //       tokenFlow.connect(addr1).swap(tokenAAddress, tokenBAddress, swapA)
  //     ).to.be.reverted
  //   })
  // })

  // describe('Withdraw Fees', function () {
  //   it('Should allow the owner to withdraw fees', async function () {
  //     const { feeCollector, tokenA, tokenB, tokenFlow, owner, addr1, addr2 } =
  //       await loadFixture(deployTokenFlowFixture)

  //     const feeCollectorontractAddress = await feeCollector.getAddress()
  //     const tokenFlowContractAddress = await tokenFlow.getAddress()
  //     const tokenAAddress = await tokenA.getAddress()
  //     const tokenBAddress = await tokenB.getAddress()

  //     await tokenA.approve(tokenFlowContractAddress, addAmountTokenA)
  //     await tokenB.approve(tokenFlowContractAddress, addAmountTokenB)

  //     await expect(
  //       tokenFlow.addLiquidity(
  //         tokenAAddress,
  //         tokenBAddress,
  //         addAmountTokenA,
  //         addAmountTokenB
  //       )
  //     ).to.not.be.reverted

  //     await tokenA.connect(addr1).approve(tokenFlowContractAddress, swapA)
  //     await tokenFlow.connect(addr1).swap(tokenAAddress, tokenBAddress, swapA)

  //     initialFeeCollectorBalanceA = await tokenA.balanceOf(
  //       feeCollectorontractAddress
  //     )

  //     await tokenFlow.withdrawFees(tokenAAddress, withdrawFee)

  //     expect(await tokenA.balanceOf(feeCollectorontractAddress)).to.equal(
  //       initialFeeCollectorBalanceA - BigInt(withdrawFee)
  //     )
  //   })
  //   it('Should not alow other accounts to withdraw fees', async function () {
  //     const { feeCollector, tokenA, tokenB, tokenFlow, owner, addr1, addr2 } =
  //       await loadFixture(deployTokenFlowFixture)

  //     const feeCollectorontractAddress = await feeCollector.getAddress()
  //     const tokenFlowContractAddress = await tokenFlow.getAddress()
  //     const tokenAAddress = await tokenA.getAddress()
  //     const tokenBAddress = await tokenB.getAddress()

  //     await tokenA.approve(tokenFlowContractAddress, addAmountTokenA)
  //     await tokenB.approve(tokenFlowContractAddress, addAmountTokenB)

  //     await expect(
  //       tokenFlow.addLiquidity(
  //         tokenAAddress,
  //         tokenBAddress,
  //         addAmountTokenA,
  //         addAmountTokenB
  //       )
  //     ).to.not.be.reverted

  //     await tokenA.connect(addr1).approve(tokenFlowContractAddress, swapA)
  //     await tokenFlow.connect(addr1).swap(tokenAAddress, tokenBAddress, swapA)

  //     await expect(
  //       tokenFlow.connect(addr2).withdrawFees(tokenAAddress, withdrawFee)
  //     ).to.be.revertedWith('Not the owner')
  //   })
  // })
})
