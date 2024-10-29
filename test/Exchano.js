const {
  loadFixture
} = require('@nomicfoundation/hardhat-toolbox/network-helpers')
const { expect } = require('chai')
const { ethers } = require('hardhat')
const { bigint } = require('hardhat/internal/core/params/argumentTypes')
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs')

describe('Exchano', function () {
  const initialSupplyA = 1000000
  const initialSupplyB = 50000000
  const initialSupplyC = 75000000
  const initialSupplyD = 65000000

  const addAmountTokenA = 100000
  const addAmountTokenB = 200000
  const addAmountTokenC = 150000
  const addAmountTokenD = 250000

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

    // Deploy a temporary FeeCollector first
    const tempFeeCollector = await ethers.deployContract('FeeCollector', [
      owner.address
    ])
    const tempFeeCollectorAddress = await tempFeeCollector.getAddress()

    const exchano = await ethers.deployContract('Exchano', [
      tempFeeCollectorAddress,
      feeRate
    ])
    const exchanoAddress = await exchano.getAddress()

    const feeCollector = await ethers.deployContract('FeeCollector', [
      exchanoAddress
    ])
    const feeCollectorAddress = await feeCollector.getAddress()

    await exchano.setFeeCollector(feeCollectorAddress)

    // Mint tokens to both addr1 and addr2
    await tokenA.mint(addr1.address, initialSupplyA)
    await tokenB.mint(addr1.address, initialSupplyB)
    await tokenC.mint(addr1.address, initialSupplyC)
    await tokenD.mint(addr1.address, initialSupplyD)

    await tokenA.mint(addr2.address, initialSupplyA)
    await tokenB.mint(addr2.address, initialSupplyB)
    await tokenC.mint(addr2.address, initialSupplyC)
    await tokenD.mint(addr2.address, initialSupplyD)

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
    it('Should set the right owner', async function () {
      const { exchano, owner } = await loadFixture(deployExchanoFixture)
      expect(await exchano.owner()).to.equal(owner.address)
    })

    it('Should set the correct fee collector', async function () {
      const { exchano, feeCollector } = await loadFixture(deployExchanoFixture)
      expect(await exchano.feeCollector()).to.equal(
        await feeCollector.getAddress()
      )
    })

    it('Should set the correct fee rate', async function () {
      const { exchano } = await loadFixture(deployExchanoFixture)
      expect(await exchano.feeRate()).to.equal(feeRate)
    })

    it('Should not allow zero address fee collector', async function () {
      const [owner] = await ethers.getSigners()
      const zeroAddress = '0x0000000000000000000000000000000000000000'

      await expect(
        ethers.deployContract('Exchano', [zeroAddress, feeRate])
      ).to.be.revertedWith('Exchano: zero address collector')
    })

    it('Should not allow fee rate higher than maximum', async function () {
      const { feeCollector } = await loadFixture(deployExchanoFixture)
      const feeCollectorAddress = await feeCollector.getAddress()
      const maxFeeRate = 1001 // MAX_FEE_RATE is 1000

      await expect(
        ethers.deployContract('Exchano', [feeCollectorAddress, maxFeeRate])
      ).to.be.revertedWith('Exchano: fee rate exceeds maximum')
    })

    it('Should initialize with correct constant values', async function () {
      const { exchano } = await loadFixture(deployExchanoFixture)

      expect(await exchano.MAX_FEE_RATE()).to.equal(1000) // 10%
      expect(await exchano.MINIMUM_LIQUIDITY()).to.equal(1000)
      expect(await exchano.BASIS_POINTS()).to.equal(10000)
    })

    it('Should deploy with no initial pools', async function () {
      const { exchano, tokenA, tokenB } = await loadFixture(
        deployExchanoFixture
      )
      const tokenAAddress = await tokenA.getAddress()
      const tokenBAddress = await tokenB.getAddress()

      const pool = await exchano.getPool(tokenAAddress, tokenBAddress)
      expect(pool.isInitialized).to.be.false
      expect(pool.totalLiquidity).to.equal(0)
      expect(pool.tokenABalance).to.equal(0)
      expect(pool.tokenBBalance).to.equal(0)
    })

    it('Should allow owner to update fee collector', async function () {
      const { exchano, owner } = await loadFixture(deployExchanoFixture)
      const oldCollector = await exchano.feeCollector()

      const newFeeCollector = await ethers.deployContract('FeeCollector', [
        await exchano.getAddress()
      ])
      const newFeeCollectorAddress = await newFeeCollector.getAddress()

      await expect(
        exchano.connect(owner).setFeeCollector(newFeeCollectorAddress)
      )
        .to.emit(exchano, 'FeeCollectorUpdated')
        .withArgs(oldCollector, newFeeCollectorAddress)

      expect(await exchano.feeCollector()).to.equal(newFeeCollectorAddress)
    })

    it('Should not allow non-owner to update fee collector', async function () {
      const { exchano, addr1 } = await loadFixture(deployExchanoFixture)

      // Deploy a new valid FeeCollector
      const newFeeCollector = await ethers.deployContract('FeeCollector', [
        await exchano.getAddress()
      ])
      const newFeeCollectorAddress = await newFeeCollector.getAddress()

      await expect(
        exchano.connect(addr1).setFeeCollector(newFeeCollectorAddress)
      )
        .to.be.revertedWithCustomError(exchano, 'OwnableUnauthorizedAccount')
        .withArgs(addr1.address)
    })

    it('Should allow owner to update fee rate', async function () {
      const { exchano, owner } = await loadFixture(deployExchanoFixture)
      const newFeeRate = 200
      const oldFeeRate = await exchano.feeRate()

      await expect(exchano.connect(owner).setFeeRate(newFeeRate))
        .to.emit(exchano, 'FeeRateUpdated')
        .withArgs(oldFeeRate, newFeeRate)

      expect(await exchano.feeRate()).to.equal(newFeeRate)
    })

    it('Should not allow non-owner to update fee rate', async function () {
      const { exchano, addr1 } = await loadFixture(deployExchanoFixture)
      const newFeeRate = 200

      await expect(exchano.connect(addr1).setFeeRate(newFeeRate))
        .to.be.revertedWithCustomError(exchano, 'OwnableUnauthorizedAccount')
        .withArgs(addr1.address)
    })

    it('Should not allow fee rate update above maximum', async function () {
      const { exchano, owner } = await loadFixture(deployExchanoFixture)
      const maxFeeRate = 1001 // MAX_FEE_RATE is 1000

      await expect(
        exchano.connect(owner).setFeeRate(maxFeeRate)
      ).to.be.revertedWith('Exchano: fee rate exceeds maximum')
    })

    it('Should start in unpaused state', async function () {
      const { exchano } = await loadFixture(deployExchanoFixture)
      expect(await exchano.paused()).to.be.false
    })

    it('Should allow owner to pause and unpause', async function () {
      const { exchano, owner } = await loadFixture(deployExchanoFixture)

      await exchano.pause()
      expect(await exchano.paused()).to.be.true

      await exchano.unpause()
      expect(await exchano.paused()).to.be.false
    })

    it('Should not allow non-owner to pause or unpause', async function () {
      const { exchano, addr1 } = await loadFixture(deployExchanoFixture)

      await expect(exchano.connect(addr1).pause())
        .to.be.revertedWithCustomError(exchano, 'OwnableUnauthorizedAccount')
        .withArgs(addr1.address)

      await expect(exchano.connect(addr1).unpause())
        .to.be.revertedWithCustomError(exchano, 'OwnableUnauthorizedAccount')
        .withArgs(addr1.address)
    })
  })

  describe('Add Liquidity', function () {
    describe('Initial Liquidity', function () {
      it('Should correctly initialize a new pool and add initial liquidity', async function () {
        const { exchano, tokenA, tokenB, addr1 } = await loadFixture(
          deployExchanoFixture
        )
        const tokenAAddress = await tokenA.getAddress()
        const tokenBAddress = await tokenB.getAddress()

        const amountA = 10000
        const amountB = 20000

        // Approve tokens
        await tokenA.connect(addr1).approve(exchano.getAddress(), amountA)
        await tokenB.connect(addr1).approve(exchano.getAddress(), amountB)

        // Add initial liquidity
        const tx = await exchano.connect(addr1).addLiquidity(
          tokenAAddress,
          tokenBAddress,
          amountA,
          amountB,
          0 // minLPTokens
        )

        // Get pool info
        const pool = await exchano.getPool(tokenAAddress, tokenBAddress)

        // Verify pool state
        expect(pool.isInitialized).to.be.true
        expect(pool.tokenABalance).to.equal(amountA)
        expect(pool.tokenBBalance).to.equal(amountB)

        // Verify LP tokens
        const expectedLPTokens = Math.floor(Math.sqrt(amountA * amountB)) - 1000 // MINIMUM_LIQUIDITY
        const lpTokenAddress = pool.lpToken
        const lpToken = await ethers.getContractAt('LPToken', lpTokenAddress)
        expect(await lpToken.balanceOf(addr1.address)).to.equal(
          expectedLPTokens
        )

        // Verify minimum liquidity lock at address(1), not address(0)
        expect(
          await lpToken.balanceOf('0x0000000000000000000000000000000000000001')
        ).to.equal(1000)

        // Verify event emission
        await expect(tx)
          .to.emit(exchano, 'LiquidityAdded')
          .withArgs(
            addr1.address,
            tokenAAddress,
            tokenBAddress,
            amountA,
            amountB,
            expectedLPTokens
          )
      })

      it('Should handle reversed token order correctly', async function () {
        const { exchano, tokenA, tokenB, addr1 } = await loadFixture(
          deployExchanoFixture
        )
        const tokenAAddress = await tokenA.getAddress()
        const tokenBAddress = await tokenB.getAddress()

        const amountA = 10000
        const amountB = 20000

        await tokenA.connect(addr1).approve(exchano.getAddress(), amountA)
        await tokenB.connect(addr1).approve(exchano.getAddress(), amountB)

        // Add liquidity with reversed token order
        await exchano
          .connect(addr1)
          .addLiquidity(tokenBAddress, tokenAAddress, amountB, amountA, 0)

        // Get pool info
        const pool = await exchano.getPool(tokenAAddress, tokenBAddress)

        // Pool should store tokens in sorted order
        expect(pool.tokenABalance).to.equal(amountA)
        expect(pool.tokenBBalance).to.equal(amountB)
      })
    })

    describe('Additional Liquidity', function () {
      it('Should correctly calculate LP tokens for subsequent deposits', async function () {
        const { exchano, tokenA, tokenB, addr1, addr2 } = await loadFixture(
          deployExchanoFixture
        )
        const tokenAAddress = await tokenA.getAddress()
        const tokenBAddress = await tokenB.getAddress()

        // First deposit
        const amountA1 = 10000n
        const amountB1 = 20000n
        await tokenA.connect(addr1).approve(exchano.getAddress(), amountA1)
        await tokenB.connect(addr1).approve(exchano.getAddress(), amountB1)
        await exchano
          .connect(addr1)
          .addLiquidity(tokenAAddress, tokenBAddress, amountA1, amountB1, 0)

        minimum_liquidity = await exchano.MINIMUM_LIQUIDITY()

        // Get state after first deposit
        const lpToken = await ethers.getContractAt(
          'LPToken',
          (
            await exchano.getPool(tokenAAddress, tokenBAddress)
          ).lpToken
        )

        // Verify first deposit LP tokens (sqrt(a*b) - MINIMUM_LIQUIDITY)
        const expectedLP1 =
          BigInt(Math.floor(Math.sqrt(Number(amountA1 * amountB1)))) -
          minimum_liquidity

        const addr1Balance = await lpToken.balanceOf(addr1.address)
        expect(addr1Balance).to.equal(expectedLP1)

        // Second deposit
        const amountA2 = 5000n
        const amountB2 = 10000n
        await tokenA.connect(addr2).approve(exchano.getAddress(), amountA2)
        await tokenB.connect(addr2).approve(exchano.getAddress(), amountB2)
        await exchano
          .connect(addr2)
          .addLiquidity(tokenAAddress, tokenBAddress, amountA2, amountB2, 0)

        // Verify final state
        const finalPool = await exchano.getPool(tokenAAddress, tokenBAddress)
        const addr2Balance = await lpToken.balanceOf(addr2.address)
        const totalSupply = await lpToken.totalSupply()

        // Verify pool balances are correct
        expect(finalPool.tokenABalance).to.equal(amountA1 + amountA2)
        expect(finalPool.tokenBBalance).to.equal(amountB1 + amountB2)

        // Verify LP token calculation for second deposit
        // For subsequent deposits: LP = min((dx * L) / X, (dy * L) / Y)
        // where L is total supply, X and Y are current pool balances
        const expectedLP2 = BigInt(
          Math.min(
            Number((amountA2 * totalSupply) / finalPool.tokenABalance),
            Number((amountB2 * totalSupply) / finalPool.tokenBBalance)
          )
        )
        expect(addr2Balance).to.equal(expectedLP2)

        // Verify that token proportions in the pool remain constant
        expect(finalPool.tokenABalance * 2n).to.equal(finalPool.tokenBBalance)

        // Verify total supply equals sum of all LP tokens plus MINIMUM_LIQUIDITY
        expect(totalSupply).to.equal(
          addr1Balance + addr2Balance + minimum_liquidity
        )
      })

      it('Should correctly calculate LP tokens across multiple pools', async function () {
        const { exchano, tokenA, tokenB, tokenC, addr1, addr2 } =
          await loadFixture(deployExchanoFixture)
        const tokenAAddress = await tokenA.getAddress()
        const tokenBAddress = await tokenB.getAddress()
        const tokenCAddress = await tokenC.getAddress()

        // First pool: TokenA-TokenB
        const amountA1 = 10000n
        const amountB1 = 20000n
        await tokenA.connect(addr1).approve(exchano.getAddress(), amountA1)
        await tokenB.connect(addr1).approve(exchano.getAddress(), amountB1)
        const tx1 = await exchano
          .connect(addr1)
          .addLiquidity(tokenAAddress, tokenBAddress, amountA1, amountB1, 0)

        // Second pool: TokenB-TokenC
        const amountB2 = 30000n
        const amountC2 = 40000n
        await tokenB.connect(addr1).approve(exchano.getAddress(), amountB2)
        await tokenC.connect(addr1).approve(exchano.getAddress(), amountC2)
        const tx2 = await exchano
          .connect(addr1)
          .addLiquidity(tokenBAddress, tokenCAddress, amountB2, amountC2, 0)

        // Add liquidity to both pools with addr2
        const amountA3 = 5000n
        const amountB3 = 10000n
        const amountB4 = 15000n
        const amountC4 = 20000n

        await tokenA.connect(addr2).approve(exchano.getAddress(), amountA3)
        await tokenB
          .connect(addr2)
          .approve(exchano.getAddress(), amountB3 + amountB4)
        await tokenC.connect(addr2).approve(exchano.getAddress(), amountC4)

        // Add to first pool
        await exchano
          .connect(addr2)
          .addLiquidity(tokenAAddress, tokenBAddress, amountA3, amountB3, 0)

        // Add to second pool
        await exchano
          .connect(addr2)
          .addLiquidity(tokenBAddress, tokenCAddress, amountB4, amountC4, 0)

        // Get final state
        const finalPool1 = await exchano.getPool(tokenAAddress, tokenBAddress)
        const finalPool2 = await exchano.getPool(tokenBAddress, tokenCAddress)

        // Get LP tokens for both pools
        const lpToken1 = await ethers.getContractAt(
          'LPToken',
          finalPool1.lpToken
        )
        const lpToken2 = await ethers.getContractAt(
          'LPToken',
          finalPool2.lpToken
        )

        // Determine correct token ordering based on addresses
        const isPool1Ordered = tokenAAddress < tokenBAddress
        const isPool2Ordered = tokenBAddress < tokenCAddress

        // Verify final balances for pool 1 (TokenA-TokenB)
        if (isPool1Ordered) {
          expect(finalPool1.tokenABalance).to.equal(amountA1 + amountA3)
          expect(finalPool1.tokenBBalance).to.equal(amountB1 + amountB3)
        } else {
          expect(finalPool1.tokenBBalance).to.equal(amountA1 + amountA3)
          expect(finalPool1.tokenABalance).to.equal(amountB1 + amountB3)
        }

        // Verify final balances for pool 2 (TokenB-TokenC)
        if (isPool2Ordered) {
          expect(finalPool2.tokenABalance).to.equal(amountB2 + amountB4)
          expect(finalPool2.tokenBBalance).to.equal(amountC2 + amountC4)
        } else {
          expect(finalPool2.tokenBBalance).to.equal(amountB2 + amountB4)
          expect(finalPool2.tokenABalance).to.equal(amountC2 + amountC4)
        }

        // Verify proportions are maintained (using raw amounts to avoid ordering issues)
        expect((amountA1 + amountA3) * 2n).to.equal(amountB1 + amountB3)
        expect((amountB2 + amountB4) * 4n).to.equal((amountC2 + amountC4) * 3n)

        // Verify LP tokens total supply includes MINIMUM_LIQUIDITY
        const minimum_liquidity = await exchano.MINIMUM_LIQUIDITY()

        expect(await lpToken1.totalSupply()).to.equal(
          (await lpToken1.balanceOf(addr1.address)) +
            (await lpToken1.balanceOf(addr2.address)) +
            minimum_liquidity
        )

        expect(await lpToken2.totalSupply()).to.equal(
          (await lpToken2.balanceOf(addr1.address)) +
            (await lpToken2.balanceOf(addr2.address)) +
            minimum_liquidity
        )
      })

      it('Should enforce minimum LP tokens requirement', async function () {
        const { exchano, tokenA, tokenB, addr1 } = await loadFixture(
          deployExchanoFixture
        )
        const tokenAAddress = await tokenA.getAddress()
        const tokenBAddress = await tokenB.getAddress()
        await tokenA.connect(addr1).approve(exchano.getAddress(), 10000)
        await tokenB.connect(addr1).approve(exchano.getAddress(), 20000)
        await expect(
          exchano.connect(addr1).addLiquidity(
            tokenAAddress,
            tokenBAddress,
            10000,
            20000,
            100000 // Unreasonably high minLPTokens
          )
        ).to.be.revertedWith('Exchano: insufficient LP tokens')
      })
    })

    describe('Error Conditions', function () {
      it('Should revert with zero amounts', async function () {
        const { exchano, tokenA, tokenB, addr1 } = await loadFixture(
          deployExchanoFixture
        )
        const tokenAAddress = await tokenA.getAddress()
        const tokenBAddress = await tokenB.getAddress()

        await expect(
          exchano
            .connect(addr1)
            .addLiquidity(tokenAAddress, tokenBAddress, 0, 1000, 0)
        ).to.be.revertedWith('Exchano: zero amounts')
      })

      it('Should revert with identical tokens', async function () {
        const { exchano, tokenA, addr1 } = await loadFixture(
          deployExchanoFixture
        )
        const tokenAAddress = await tokenA.getAddress()

        await expect(
          exchano
            .connect(addr1)
            .addLiquidity(tokenAAddress, tokenAAddress, 1000, 1000, 0)
        ).to.be.revertedWith('Exchano: identical tokens')
      })

      it('Should revert when paused', async function () {
        const { exchano, tokenA, tokenB, owner, addr1 } = await loadFixture(
          deployExchanoFixture
        )
        const tokenAAddress = await tokenA.getAddress()
        const tokenBAddress = await tokenB.getAddress()

        await exchano.pause()

        await expect(
          exchano
            .connect(addr1)
            .addLiquidity(tokenAAddress, tokenBAddress, 1000, 1000, 0)
        ).to.be.revertedWithCustomError(exchano, 'EnforcedPause')
      })
    })
  })
  describe('Withdraw Liquidity', function () {
    it('Should allow withdrawal of liquidity', async function () {
      const { exchano, tokenA, tokenB, addr1 } = await loadFixture(
        deployExchanoFixture
      )

      // First add liquidity
      await tokenA.connect(addr1).approve(exchano.getAddress(), addAmountTokenA)
      await tokenB.connect(addr1).approve(exchano.getAddress(), addAmountTokenB)

      await exchano
        .connect(addr1)
        .addLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          addAmountTokenA,
          addAmountTokenB,
          0
        )

      // Get LP token address
      const pool = await exchano.getPool(
        await tokenA.getAddress(),
        await tokenB.getAddress()
      )
      const lpToken = await ethers.getContractAt('LPToken', pool.lpToken)
      const lpBalance = await lpToken.balanceOf(addr1.address)

      // Withdraw all liquidity
      await expect(
        exchano
          .connect(addr1)
          .withdrawLiquidity(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            lpBalance,
            0,
            0
          )
      )
        .to.emit(exchano, 'LiquidityRemoved')
        .withArgs(
          addr1.address,
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          anyValue,
          anyValue,
          lpBalance
        )
    })

    it('Should correctly handle liquidity withdrawal with multiple pools', async function () {
      const { exchano, tokenA, tokenB, tokenC, addr1, addr2 } =
        await loadFixture(deployExchanoFixture)
      const tokenAAddress = await tokenA.getAddress()
      const tokenBAddress = await tokenB.getAddress()
      const tokenCAddress = await tokenC.getAddress()

      // Initial liquidity for Pool1 (TokenA-TokenB)
      const amountA1 = 10000n
      const amountB1 = 20000n // 1:2 ratio
      await tokenA.connect(addr1).approve(exchano.getAddress(), amountA1)
      await tokenB.connect(addr1).approve(exchano.getAddress(), amountB1)
      await exchano
        .connect(addr1)
        .addLiquidity(tokenAAddress, tokenBAddress, amountA1, amountB1, 0)

      // Initial liquidity for Pool2 (TokenB-TokenC)
      const amountB2 = 30000n
      const amountC2 = 40000n // 3:4 ratio
      await tokenB.connect(addr1).approve(exchano.getAddress(), amountB2)
      await tokenC.connect(addr1).approve(exchano.getAddress(), amountC2)
      await exchano
        .connect(addr1)
        .addLiquidity(tokenBAddress, tokenCAddress, amountB2, amountC2, 0)

      // Get LP tokens for both pools
      const pool1 = await exchano.getPool(tokenAAddress, tokenBAddress)
      const pool2 = await exchano.getPool(tokenBAddress, tokenCAddress)
      const lpToken1 = await ethers.getContractAt('LPToken', pool1.lpToken)
      const lpToken2 = await ethers.getContractAt('LPToken', pool2.lpToken)

      // Get LP token balances
      const lpBalance1 = await lpToken1.balanceOf(addr1.address)
      const lpBalance2 = await lpToken2.balanceOf(addr1.address)

      // Record initial state of Pool2
      const initialPool2TokenB = pool2.tokenABalance
      const initialPool2TokenC = pool2.tokenBBalance

      // Determine token ordering for Pool1
      const [token0Pool1, token1Pool1] =
        tokenAAddress < tokenBAddress
          ? [tokenAAddress, tokenBAddress]
          : [tokenBAddress, tokenAAddress]

      // Determine token ordering for Pool2
      const [token0Pool2, token1Pool2] =
        tokenBAddress < tokenCAddress
          ? [tokenBAddress, tokenCAddress]
          : [tokenCAddress, tokenBAddress]

      // Withdraw from Pool1
      await expect(
        exchano
          .connect(addr1)
          .withdrawLiquidity(tokenAAddress, tokenBAddress, lpBalance1, 0, 0)
      )
        .to.emit(exchano, 'LiquidityRemoved')
        .withArgs(
          addr1.address,
          token0Pool1,
          token1Pool1,
          anyValue,
          anyValue,
          lpBalance1
        )

      // Verify Pool2 remained unchanged
      const middlePool2 = await exchano.getPool(tokenBAddress, tokenCAddress)
      expect(middlePool2.tokenABalance).to.equal(initialPool2TokenB)
      expect(middlePool2.tokenBBalance).to.equal(initialPool2TokenC)
      expect(await lpToken2.balanceOf(addr1.address)).to.equal(lpBalance2)

      // Withdraw from Pool2
      await expect(
        exchano
          .connect(addr1)
          .withdrawLiquidity(tokenBAddress, tokenCAddress, lpBalance2, 0, 0)
      )
        .to.emit(exchano, 'LiquidityRemoved')
        .withArgs(
          addr1.address,
          token0Pool2,
          token1Pool2,
          anyValue,
          anyValue,
          lpBalance2
        )

      // Verify final state
      const finalPool1 = await exchano.getPool(tokenAAddress, tokenBAddress)
      const finalPool2 = await exchano.getPool(tokenBAddress, tokenCAddress)

      // Verify LP tokens were burned
      expect(await lpToken1.balanceOf(addr1.address)).to.equal(0)
      expect(await lpToken2.balanceOf(addr1.address)).to.equal(0)

      // Verify minimum liquidity remains
      const minimum_liquidity = await exchano.MINIMUM_LIQUIDITY()
      expect(await lpToken1.totalSupply()).to.equal(minimum_liquidity)
      expect(await lpToken2.totalSupply()).to.equal(minimum_liquidity)

      // Calculate new amounts for adding liquidity
      const newAmountA = 10000n
      const newAmountB1 = 20000n
      const newAmountB2 = 30000n
      const newAmountC = 40000n

      // Approve all tokens for addr2
      await tokenA.connect(addr2).approve(exchano.getAddress(), newAmountA)
      await tokenB
        .connect(addr2)
        .approve(exchano.getAddress(), newAmountB1 + newAmountB2)
      await tokenC.connect(addr2).approve(exchano.getAddress(), newAmountC)

      // Add liquidity to first pool (1:2 ratio)
      await expect(
        exchano
          .connect(addr2)
          .addLiquidity(
            tokenAAddress,
            tokenBAddress,
            newAmountA,
            newAmountB1,
            0
          )
      ).to.not.be.reverted

      // Add liquidity to second pool (3:4 ratio)
      await expect(
        exchano
          .connect(addr2)
          .addLiquidity(
            tokenBAddress,
            tokenCAddress,
            newAmountB2,
            newAmountC,
            0
          )
      ).to.not.be.reverted
    })

    it('Should fail to withdraw with insufficient LP tokens', async function () {
      const { exchano, tokenA, tokenB, addr1, addr2 } = await loadFixture(
        deployExchanoFixture
      )

      // First add liquidity with addr1
      await tokenA.connect(addr1).approve(exchano.getAddress(), addAmountTokenA)
      await tokenB.connect(addr1).approve(exchano.getAddress(), addAmountTokenB)

      await exchano
        .connect(addr1)
        .addLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          addAmountTokenA,
          addAmountTokenB,
          0
        )

      // Try to withdraw with addr2 who has no LP tokens
      await expect(
        exchano
          .connect(addr2)
          .withdrawLiquidity(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            1000,
            0,
            0
          )
      ).to.be.revertedWith('Exchano: insufficient LP tokens')
    })
  })

  describe('Swap', function () {
    beforeEach(async function () {
      const { exchano, tokenA, tokenB, addr1 } = await loadFixture(
        deployExchanoFixture
      )
      // Add initial liquidity
      await tokenA.connect(addr1).approve(exchano.getAddress(), addAmountTokenA)
      await tokenB.connect(addr1).approve(exchano.getAddress(), addAmountTokenB)
      await exchano
        .connect(addr1)
        .addLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          addAmountTokenA,
          addAmountTokenB,
          0
        )
    })
    it('Should execute swap successfully', async function () {
      const { exchano, tokenA, tokenB, addr1 } = await loadFixture(
        deployExchanoFixture
      )
      // Add initial liquidity
      await tokenA.connect(addr1).approve(exchano.getAddress(), addAmountTokenA)
      await tokenB.connect(addr1).approve(exchano.getAddress(), addAmountTokenB)
      await exchano
        .connect(addr1)
        .addLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          addAmountTokenA,
          addAmountTokenB,
          0
        )
      // Approve and execute swap
      await tokenA.connect(addr1).approve(exchano.getAddress(), swapA)
      const initialBalanceB = await tokenB.balanceOf(addr1.address)
      await expect(
        exchano
          .connect(addr1)
          .swap(await tokenA.getAddress(), await tokenB.getAddress(), swapA, 0)
      )
        .to.emit(exchano, 'Swap')
        .withArgs(
          addr1.address,
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          swapA,
          anyValue,
          anyValue
        )
      const finalBalanceB = await tokenB.balanceOf(addr1.address)
      expect(finalBalanceB).to.be.gt(initialBalanceB)
    })
    it('Should fail swap with insufficient input amount', async function () {
      const { exchano, tokenA, tokenB, addr1 } = await loadFixture(
        deployExchanoFixture
      )
      await expect(
        exchano
          .connect(addr1)
          .swap(await tokenA.getAddress(), await tokenB.getAddress(), 0, 0)
      ).to.be.revertedWith('Exchano: zero input amount')
    })
    it('Should fail swap with identical tokens', async function () {
      const { exchano, tokenA, addr1 } = await loadFixture(deployExchanoFixture)
      await expect(
        exchano
          .connect(addr1)
          .swap(await tokenA.getAddress(), await tokenA.getAddress(), swapA, 0)
      ).to.be.revertedWith('Exchano: identical tokens')
    })
    it('Should fail swap with insufficient output amount', async function () {
      const { exchano, tokenA, tokenB, addr1 } = await loadFixture(
        deployExchanoFixture
      )
      // Add initial liquidity
      await tokenA.connect(addr1).approve(exchano.getAddress(), addAmountTokenA)
      await tokenB.connect(addr1).approve(exchano.getAddress(), addAmountTokenB)
      await exchano
        .connect(addr1)
        .addLiquidity(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          addAmountTokenA,
          addAmountTokenB,
          0
        )
      await tokenA.connect(addr1).approve(exchano.getAddress(), swapA)
      // Set unrealistically high minimum output amount
      const unrealisticMinOutput = addAmountTokenB * 2
      await expect(
        exchano
          .connect(addr1)
          .swap(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            swapA,
            unrealisticMinOutput
          )
      ).to.be.revertedWith('Exchano: insufficient output amount')
    })
  })
  describe('Fee Collection and Distribution', function () {
    it('Should collect fees during swaps', async function () {
      const { exchano, feeCollector, tokenA, tokenB, addr1, addr2 } =
        await loadFixture(deployExchanoFixture)
      const tokenAAddress = await tokenA.getAddress()
      const tokenBAddress = await tokenB.getAddress()

      // Add initial liquidity
      await tokenA.connect(addr1).approve(exchano.getAddress(), addAmountTokenA)
      await tokenB.connect(addr1).approve(exchano.getAddress(), addAmountTokenB)
      await exchano
        .connect(addr1)
        .addLiquidity(
          tokenAAddress,
          tokenBAddress,
          addAmountTokenA,
          addAmountTokenB,
          0
        )

      // Perform swap
      const swapAmount = 10000n
      await tokenA.connect(addr2).approve(exchano.getAddress(), swapAmount)

      // Get initial balances
      const initialFeeCollectorBalance = await tokenA.balanceOf(
        await feeCollector.getAddress()
      )

      // Execute swap
      await exchano
        .connect(addr2)
        .swap(tokenAAddress, tokenBAddress, swapAmount, 0)

      // Calculate expected fee
      const feeRate = await exchano.feeRate()
      const expectedFee = (swapAmount * feeRate) / 10000n

      // Verify fee collector received the fee
      const finalFeeCollectorBalance = await tokenA.balanceOf(
        await feeCollector.getAddress()
      )
      expect(finalFeeCollectorBalance - initialFeeCollectorBalance).to.equal(
        expectedFee
      )
    })

    it('Should correctly update user shares when adding liquidity', async function () {
      const { exchano, feeCollector, tokenA, tokenB, addr1 } =
        await loadFixture(deployExchanoFixture)
      const tokenAAddress = await tokenA.getAddress()
      const tokenBAddress = await tokenB.getAddress()

      // Add liquidity
      const amountA = 100000n
      const amountB = 200000n
      await tokenA.connect(addr1).approve(exchano.getAddress(), amountA)
      await tokenB.connect(addr1).approve(exchano.getAddress(), amountB)

      // For first liquidity provider:
      // 1. sqrtK = sqrt(100000 * 200000) ≈ 141421
      // 2. liquidityShare = 141421 - 1000 = 140421
      // 3. share = (140421 * 10000) / (140421 + 1000) = 9929
      const expectedShare = 9929n

      // Get ordered token addresses
      const [token0, token1] =
        tokenAAddress < tokenBAddress
          ? [tokenAAddress, tokenBAddress]
          : [tokenBAddress, tokenAAddress]

      // Add liquidity and check both UserShareUpdated events
      await expect(
        exchano
          .connect(addr1)
          .addLiquidity(tokenAAddress, tokenBAddress, amountA, amountB, 0)
      )
        .to.emit(feeCollector, 'UserShareUpdated')
        .withArgs(addr1.address, token0, expectedShare)
        .to.emit(feeCollector, 'UserShareUpdated')
        .withArgs(addr1.address, token1, expectedShare)

      // Verify share was updated in FeeCollector for both tokens
      const shareInfo0 = await feeCollector.userShares(token0, addr1.address)
      expect(shareInfo0.accumulatedShare).to.equal(expectedShare)
      expect(shareInfo0.lastUpdateBlock).to.equal(
        await ethers.provider.getBlockNumber()
      )

      const shareInfo1 = await feeCollector.userShares(token1, addr1.address)
      expect(shareInfo1.accumulatedShare).to.equal(expectedShare)
      expect(shareInfo1.lastUpdateBlock).to.equal(
        await ethers.provider.getBlockNumber()
      )
    })

    it('Should allow owner to recover tokens', async function () {
      const { feeCollector, tokenA, owner } = await loadFixture(
        deployExchanoFixture
      )
      const tokenAAddress = await tokenA.getAddress()
      const feeCollectorAddress = await feeCollector.getAddress()

      // Mint tokens first
      const amount = ethers.parseUnits('100', 18)
      await tokenA.mint(owner.address, amount)

      // Record initial balances
      const initialOwnerBalance = await tokenA.balanceOf(owner.address)

      // Send tokens to fee collector
      await tokenA.transfer(feeCollectorAddress, amount)

      // Verify fee collector received the tokens
      expect(await tokenA.balanceOf(feeCollectorAddress)).to.equal(amount)

      // Recover tokens
      await expect(feeCollector.recoverTokens(tokenAAddress))
        .to.emit(feeCollector, 'TokensRecovered')
        .withArgs(tokenAAddress, amount)

      // Verify final balances
      expect(await tokenA.balanceOf(feeCollectorAddress)).to.equal(0)
      expect(await tokenA.balanceOf(owner.address)).to.equal(
        initialOwnerBalance
      )
    })

    it('Should not allow non-owner to recover tokens', async function () {
      const { feeCollector, tokenA, owner, addr1 } = await loadFixture(
        deployExchanoFixture
      )
      const tokenAAddress = await tokenA.getAddress()
      const feeCollectorAddress = await feeCollector.getAddress()

      // Mint and transfer tokens
      const amount = ethers.parseUnits('100', 18)
      await tokenA.mint(owner.address, amount)
      await tokenA.transfer(feeCollectorAddress, amount)

      // Try to recover tokens as non-owner
      await expect(feeCollector.connect(addr1).recoverTokens(tokenAAddress))
        .to.be.revertedWithCustomError(
          feeCollector,
          'OwnableUnauthorizedAccount'
        )
        .withArgs(addr1.address)
    })

    it('Should not emit event or transfer if balance is zero', async function () {
      const { feeCollector, tokenA } = await loadFixture(deployExchanoFixture)
      const tokenAAddress = await tokenA.getAddress()

      // Try to recover with zero balance
      const tx = await feeCollector.recoverTokens(tokenAAddress)
      const receipt = await tx.wait()

      // Verify no TokensRecovered event was emitted
      const events = receipt.logs.filter(log => {
        try {
          return feeCollector.interface.parseLog(log).name === 'TokensRecovered'
        } catch {
          return false
        }
      })
      expect(events.length).to.equal(0)
    })

    it('Should revert when trying to recover zero address token', async function () {
      const { feeCollector } = await loadFixture(deployExchanoFixture)

      await expect(
        feeCollector.recoverTokens(ethers.ZeroAddress)
      ).to.be.revertedWith('Zero address token')
    })

    it('Should recover correct amount when multiple tokens present', async function () {
      const { feeCollector, tokenA, tokenB, owner } = await loadFixture(
        deployExchanoFixture
      )
      const tokenAAddress = await tokenA.getAddress()
      const tokenBAddress = await tokenB.getAddress()
      const feeCollectorAddress = await feeCollector.getAddress()

      // Mint tokens
      const amountA = ethers.parseUnits('100', 18)
      const amountB = ethers.parseUnits('200', 18)
      await tokenA.mint(owner.address, amountA)
      await tokenB.mint(owner.address, amountB)

      // Send tokens to fee collector
      await tokenA.transfer(feeCollectorAddress, amountA)
      await tokenB.transfer(feeCollectorAddress, amountB)

      // Record initial balances (make sure to check tokenB for tokenB's balance)
      const initialOwnerBalanceA = await tokenA.balanceOf(owner.address)
      const initialOwnerBalanceB = await tokenB.balanceOf(owner.address) // Fixed: was checking tokenA instead of tokenB

      // Verify initial fee collector balances
      expect(await tokenA.balanceOf(feeCollectorAddress)).to.equal(amountA)
      expect(await tokenB.balanceOf(feeCollectorAddress)).to.equal(amountB)

      // Recover tokenA
      await expect(feeCollector.recoverTokens(tokenAAddress))
        .to.emit(feeCollector, 'TokensRecovered')
        .withArgs(tokenAAddress, amountA)

      // Verify final balances
      expect(await tokenA.balanceOf(feeCollectorAddress)).to.equal(0n)
      expect(await tokenB.balanceOf(feeCollectorAddress)).to.equal(amountB)
      expect(await tokenA.balanceOf(owner.address)).to.equal(
        initialOwnerBalanceA + amountA
      )
      expect(await tokenB.balanceOf(owner.address)).to.equal(
        initialOwnerBalanceB // TokenB balance should remain unchanged
      )
    })

    // it('Should allow users to withdraw accumulated fees', async function () {
    //   const { exchano, feeCollector, tokenA, tokenB, addr1, addr2 } =
    //     await loadFixture(deployExchanoFixture)
    //   const tokenAAddress = await tokenA.getAddress()
    //   const tokenBAddress = await tokenB.getAddress()

    //   // Add initial liquidity
    //   const amountA = 100000n
    //   const amountB = 200000n
    //   await tokenA.connect(addr1).approve(exchano.getAddress(), amountA)
    //   await tokenB.connect(addr1).approve(exchano.getAddress(), amountB)

    //   // Add liquidity and check that the event for share update is emitted
    //   await expect(
    //     exchano
    //       .connect(addr1)
    //       .addLiquidity(tokenAAddress, tokenBAddress, amountA, amountB, 0)
    //   ).to.emit(feeCollector, 'UserShareUpdated')

    //   // Get pool info
    //   const pool = await exchano.getPool(tokenAAddress, tokenBAddress)
    //   const lpToken = await ethers.getContractAt('LPToken', pool.lpToken)

    //   // Verify user's share in fee collector
    //   const userShare = await feeCollector.userShares(
    //     tokenAAddress,
    //     addr1.address
    //   )
    //   console.log('User Share Info:', {
    //     lastUpdateBlock: userShare.lastUpdateBlock.toString(),
    //     accumulatedShare: userShare.accumulatedShare.toString()
    //   })

    //   // Ensure share is registered
    //   expect(userShare.accumulatedShare).to.be.gt(0)

    //   // Perform swaps to accumulate fees
    //   const swapAmount = 10000n
    //   await tokenA.connect(addr2).approve(exchano.getAddress(), swapAmount * 3n)

    //   for (let i = 0; i < 3; i++) {
    //     await exchano
    //       .connect(addr2)
    //       .swap(tokenAAddress, tokenBAddress, swapAmount, 0)
    //   }

    //   // Verify fees were collected
    //   const feeCollectorBalance = await tokenA.balanceOf(
    //     await feeCollector.getAddress()
    //   )
    //   expect(feeCollectorBalance).to.be.gt(0)
    //   console.log('Fee Collector Balance:', feeCollectorBalance.toString())

    //   // Calculate expected fee amount
    //   const feeRate = await exchano.feeRate()
    //   const expectedFeePerSwap = (swapAmount * feeRate) / 10000n
    //   const totalExpectedFees = expectedFeePerSwap * 3n
    //   console.log('Expected Total Fees:', totalExpectedFees.toString())

    //   // Get user's fee share
    //   const userFees = await feeCollector.getUserFeesForToken(
    //     addr1.address,
    //     tokenAAddress
    //   )
    //   console.log('User Fees Available:', userFees.toString())

    //   // Get initial balances
    //   const initialBalance = await tokenA.balanceOf(addr1.address)
    //   const initialFeeCollectorBalance = await tokenA.balanceOf(
    //     await feeCollector.getAddress()
    //   )

    //   // Withdraw fees
    //   await expect(exchano.connect(addr1).withdrawFees(tokenAAddress)).to.emit(
    //     feeCollector,
    //     'FeesWithdrawn'
    //   )

    //   // Verify balances changed correctly
    //   const finalBalance = await tokenA.balanceOf(addr1.address)
    //   const finalFeeCollectorBalance = await tokenA.balanceOf(
    //     await feeCollector.getAddress()
    //   )

    //   expect(finalBalance).to.be.gt(initialBalance)
    //   expect(finalFeeCollectorBalance).to.be.lt(initialFeeCollectorBalance)

    //   // Log the actual fee amounts received
    //   console.log('Fees Received:', (finalBalance - initialBalance).toString())
    // })

    // it('Should correctly handle fee shares across multiple pools', async function () {
    //   const { exchano, feeCollector, tokenA, tokenB, tokenC, addr1, addr2 } =
    //     await loadFixture(deployExchanoFixture)
    //   const tokenAAddress = await tokenA.getAddress()
    //   const tokenBAddress = await tokenB.getAddress()
    //   const tokenCAddress = await tokenC.getAddress()

    //   // Setup two pools with different shares
    //   await tokenA.connect(addr1).approve(exchano.getAddress(), 20000n)
    //   await tokenB.connect(addr1).approve(exchano.getAddress(), 40000n)
    //   await tokenC.connect(addr1).approve(exchano.getAddress(), 40000n)

    //   // Pool 1: 80% share
    //   await exchano
    //     .connect(addr1)
    //     .addLiquidity(tokenAAddress, tokenBAddress, 10000n, 20000n, 0)

    //   // Pool 2: 50% share
    //   await exchano
    //     .connect(addr1)
    //     .addLiquidity(tokenBAddress, tokenCAddress, 20000n, 20000n, 0)

    //   // Add liquidity with addr2 to create different shares
    //   await tokenB.connect(addr2).approve(exchano.getAddress(), 20000n)
    //   await tokenC.connect(addr2).approve(exchano.getAddress(), 20000n)
    //   await exchano
    //     .connect(addr2)
    //     .addLiquidity(tokenBAddress, tokenCAddress, 20000n, 20000n, 0)

    //   // Perform swaps to generate fees
    //   await tokenB.connect(addr2).approve(exchano.getAddress(), 10000n)
    //   await exchano.connect(addr2).swap(tokenBAddress, tokenCAddress, 10000n, 0)

    //   // Withdraw fees should use highest share (80%)
    //   const initialBalance = await tokenB.balanceOf(addr1.address)
    //   await exchano.connect(addr1).withdrawFees(tokenBAddress)
    //   const finalBalance = await tokenB.balanceOf(addr1.address)

    //   // Verify withdrew the correct amount based on highest share
    //   expect(finalBalance).to.be.gt(initialBalance)
    // })

    // describe('Edge Cases and Error Conditions', function () {
    //   it('Should handle zero share updates correctly', async function () {
    //     const { exchano, feeCollector, tokenA, tokenB, addr1 } =
    //       await loadFixture(deployExchanoFixture)
    //     const tokenAAddress = await tokenA.getAddress()
    //     const tokenBAddress = await tokenB.getAddress()

    //     // Add and remove all liquidity
    //     await tokenA.connect(addr1).approve(exchano.getAddress(), addAmountTokenA)
    //     await tokenB.connect(addr1).approve(exchano.getAddress(), addAmountTokenB)

    //     await exchano
    //       .connect(addr1)
    //       .addLiquidity(
    //         tokenAAddress,
    //         tokenBAddress,
    //         addAmountTokenA,
    //         addAmountTokenB,
    //         0
    //       )

    //     const pool = await exchano.getPool(tokenAAddress, tokenBAddress)
    //     const lpToken = await ethers.getContractAt('LPToken', pool.lpToken)
    //     const lpBalance = await lpToken.balanceOf(addr1.address)

    //     await exchano
    //       .connect(addr1)
    //       .withdrawLiquidity(tokenAAddress, tokenBAddress, lpBalance, 0, 0)

    //     // Try to withdraw fees with zero share
    //     await expect(
    //       exchano.connect(addr1).withdrawFees(tokenAAddress)
    //     ).to.be.revertedWith('Exchano: no share in any pool')
    //   })

    //   it('Should handle emergency token recovery by owner', async function () {
    //     const { feeCollector, tokenA, owner } = await loadFixture(
    //       deployExchanoFixture
    //     )
    //     const tokenAAddress = await tokenA.getAddress()

    //     // Send some tokens directly to fee collector
    //     const amount = 1000n
    //     await tokenA.transfer(await feeCollector.getAddress(), amount)

    //     // Recover tokens
    //     await expect(feeCollector.connect(owner).recoverTokens(tokenAAddress)).to
    //       .not.be.reverted

    //     // Verify tokens were recovered
    //     expect(await tokenA.balanceOf(owner.address)).to.be.gt(0)
    //   })

    //   it('Should protect against same-block manipulations', async function () {
    //     const { exchano, tokenA, tokenB, addr1 } = await loadFixture(
    //       deployExchanoFixture
    //     )
    //     const tokenAAddress = await tokenA.getAddress()
    //     const tokenBAddress = await tokenB.getAddress()

    //     // Add initial liquidity
    //     await tokenA.connect(addr1).approve(exchano.getAddress(), addAmountTokenA)
    //     await tokenB.connect(addr1).approve(exchano.getAddress(), addAmountTokenB)

    //     await exchano
    //       .connect(addr1)
    //       .addLiquidity(
    //         tokenAAddress,
    //         tokenBAddress,
    //         addAmountTokenA,
    //         addAmountTokenB,
    //         0
    //       )

    //     // Try multiple operations in same block
    //     await network.provider.send('evm_setAutomine', [false])

    //     const swapAmount = 1000n
    //     await tokenA.connect(addr1).approve(exchano.getAddress(), swapAmount)

    //     await exchano
    //       .connect(addr1)
    //       .swap(tokenAAddress, tokenBAddress, swapAmount, 0)
    //     await expect(
    //       exchano.connect(addr1).swap(tokenAAddress, tokenBAddress, swapAmount, 0)
    //     ).to.be.revertedWith('Exchano: same block protection')

    //     await network.provider.send('evm_setAutomine', [true])
    //   })

    //   it('Should maintain k value during swaps', async function () {
    //     const { exchano, tokenA, tokenB, addr1, addr2 } = await loadFixture(
    //       deployExchanoFixture
    //     )
    //     const tokenAAddress = await tokenA.getAddress()
    //     const tokenBAddress = await tokenB.getAddress()

    //     // Add initial liquidity
    //     await tokenA.connect(addr1).approve(exchano.getAddress(), addAmountTokenA)
    //     await tokenB.connect(addr1).approve(exchano.getAddress(), addAmountTokenB)

    //     await exchano
    //       .connect(addr1)
    //       .addLiquidity(
    //         tokenAAddress,
    //         tokenBAddress,
    //         addAmountTokenA,
    //         addAmountTokenB,
    //         0
    //       )

    //     // Get initial k value
    //     const initialPool = await exchano.getPool(tokenAAddress, tokenBAddress)
    //     const initialK = initialPool.tokenABalance * initialPool.tokenBBalance

    //     // Perform swap
    //     const swapAmount = 1000n
    //     await tokenA.connect(addr2).approve(exchano.getAddress(), swapAmount)
    //     await exchano
    //       .connect(addr2)
    //       .swap(tokenAAddress, tokenBAddress, swapAmount, 0)

    //     // Verify final k value is >= initial k
    //     const finalPool = await exchano.getPool(tokenAAddress, tokenBAddress)
    //     const finalK = finalPool.tokenABalance * finalPool.tokenBBalance
    //     expect(finalK).to.be.gte(initialK)
    //   })
  })
})
