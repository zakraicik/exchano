require('@nomicfoundation/hardhat-toolbox')
require('dotenv').config()

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.27',
  networks: {
    hardhat: {
      forking: {
        url: `https://base-sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
      }
    }
  }
}
